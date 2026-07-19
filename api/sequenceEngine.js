/**
 * sequenceEngine.js
 * Core sequential signal trigger engine.
 *
 * Called by tvWebhook.js after each incoming TradingView alert.
 * Responsibilities:
 *  - Load all enabled sequence rules for the user
 *  - For each rule, check if the incoming signal advances its state machine
 *  - Handle M1 reset, timeout expiry, and sequence completion
 *  - On completion: write a trigger log + send notifications
 */

const STATES_COLLECTION = 'sequenceStates';
const RULES_COLLECTION  = 'sequenceRules';
const LOGS_COLLECTION   = 'sequenceTriggerLogs';
const PREFS_DOC         = 'preferences';
const SETTINGS_COLL     = 'settings';

// ─── Timeframe → milliseconds ───────────────────────────────────────────────
const TF_REGEX = /^(\d+)([mMhHdDwW]?)$/;

function timeframeToMs(tf) {
  if (!tf) return null;
  const str = String(tf).trim().toUpperCase();

  // Common TradingView timeframe strings
  const map = {
    '1':    1  * 60 * 1000,
    '3':    3  * 60 * 1000,
    '5':    5  * 60 * 1000,
    '10':   10 * 60 * 1000,
    '15':   15 * 60 * 1000,
    '30':   30 * 60 * 1000,
    '45':   45 * 60 * 1000,
    '60':   60 * 60 * 1000,
    '1H':   60 * 60 * 1000,
    '2H':   2  * 60 * 60 * 1000,
    '3H':   3  * 60 * 60 * 1000,
    '4H':   4  * 60 * 60 * 1000,
    '6H':   6  * 60 * 60 * 1000,
    '8H':   8  * 60 * 60 * 1000,
    '12H':  12 * 60 * 60 * 1000,
    '1D':   24 * 60 * 60 * 1000,
    'D':    24 * 60 * 60 * 1000,
    '1W':   7  * 24 * 60 * 60 * 1000,
    'W':    7  * 24 * 60 * 60 * 1000,
  };

  if (map[str] !== undefined) return map[str];

  // Generic numeric parse with optional suffix
  const m = TF_REGEX.exec(str);
  if (m) {
    const n = parseInt(m[1], 10);
    const unit = m[2] || 'M'; // default to minutes
    if (unit === 'M') return n * 60 * 1000;
    if (unit === 'H') return n * 60 * 60 * 1000;
    if (unit === 'D') return n * 24 * 60 * 60 * 1000;
    if (unit === 'W') return n * 7 * 24 * 60 * 60 * 1000;
  }
  return null;
}

// ─── Telegram notification ────────────────────────────────────────────────────
async function sendTelegramNotification(botToken, chatId, text) {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
    }),
  });
  if (!resp.ok) {
    const body = await resp.text();
    console.error('Telegram send failed:', resp.status, body);
  }
}

// ─── Format price for display ─────────────────────────────────────────────────
function formatPrice(price) {
  if (price == null) return '—';
  return Number(price).toLocaleString('en-IN');
}

// ─── Format date/time IST ────────────────────────────────────────────────────
function formatIST(date) {
  return date.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

// ─── Main engine entry point ──────────────────────────────────────────────────
/**
 * @param {FirebaseFirestore.Firestore} db
 * @param {string} uid
 * @param {string} keyword     - signal identifier (first token of message)
 * @param {string} symbol      - trading symbol e.g. "BTCUSDT"
 * @param {string} timeframe   - e.g. "1H", "15", "4H"
 * @param {number|null} price
 */
async function runSequenceEngine(db, uid, keyword, symbol, timeframe, price) {
  if (!keyword || !uid) return;

  const userRef  = db.collection('users').doc(uid);
  const rulesRef = userRef.collection(RULES_COLLECTION);
  const statesRef = userRef.collection(STATES_COLLECTION);
  const logsRef  = userRef.collection(LOGS_COLLECTION);

  // Load user preferences (Telegram config + timeout multiplier)
  let telegramToken = null;
  let telegramChatId = null;
  let timeoutMultiplier = 6; // default

  try {
    const prefsDoc = await userRef.collection(SETTINGS_COLL).doc(PREFS_DOC).get();
    if (prefsDoc.exists) {
      const prefs = prefsDoc.data();
      if (prefs.telegram) {
        telegramToken  = prefs.telegram.botToken  || null;
        telegramChatId = prefs.telegram.chatId    || null;
      }
      if (prefs.sequenceTimeoutMultiplier != null) {
        timeoutMultiplier = Number(prefs.sequenceTimeoutMultiplier) || 6;
      }
    }
  } catch (err) {
    console.error('sequenceEngine: failed to load prefs', err);
  }

  // Load all enabled rules
  let rules = [];
  try {
    const snap = await rulesRef.where('enabled', '==', true).get();
    rules = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error('sequenceEngine: failed to load rules', err);
    return;
  }

  if (rules.length === 0) return;

  const now = new Date();

  // Process each rule
  for (const rule of rules) {
    if (!rule.steps || rule.steps.length === 0) continue;

    const stateKey = `${rule.id}_${symbol}`;
    const stateDocRef = statesRef.doc(stateKey);

    let stateData = null;
    try {
      const stateSnap = await stateDocRef.get();
      if (stateSnap.exists) {
        stateData = stateSnap.data();
      }
    } catch (err) {
      console.error(`sequenceEngine: failed to read state for ${stateKey}`, err);
      continue;
    }

    // ── Check timeout expiry ──────────────────────────────────────────────────
    if (stateData) {
      const m1TfMs = timeframeToMs(stateData.m1Timeframe);
      if (m1TfMs) {
        const lastMatchedAt = stateData.lastMatchedAt?.toDate
          ? stateData.lastMatchedAt.toDate()
          : new Date(stateData.lastMatchedAt);
        const expiryMs = m1TfMs * timeoutMultiplier;
        if ((now.getTime() - lastMatchedAt.getTime()) > expiryMs) {
          // Expired — delete and treat as fresh
          try {
            await stateDocRef.delete();
          } catch (e) {
            console.error('sequenceEngine: timeout delete failed', e);
          }
          stateData = null;
        }
      }
    }

    // ── Determine if this keyword matches the next expected step ─────────────
    const expectedStepIndex = stateData ? stateData.stepIndex : 0;
    const expectedKeyword   = rule.steps[expectedStepIndex];

    const isMatch = keyword.toLowerCase() === expectedKeyword.toLowerCase();

    if (!isMatch) {
      // Not a match for this rule's current expected step.
      // But check: if this matches step[0] (M1), always reset.
      if (
        expectedStepIndex !== 0 &&
        keyword.toLowerCase() === rule.steps[0].toLowerCase()
      ) {
        // M1 re-arrived — reset
        try {
          await stateDocRef.set({
            ruleId:            rule.id,
            ruleName:          rule.name,
            symbol,
            stepIndex:         1,
            m1Timeframe:       timeframe || null,
            m1Price:           price     || null,
            lastMatchedAt:     now,
            lastMatchedPrice:  price     || null,
            lastMatchedTF:     timeframe || null,
          });
        } catch (err) {
          console.error('sequenceEngine: M1 reset failed', err);
        }
      }
      continue;
    }

    // ── Matched ───────────────────────────────────────────────────────────────
    const newStepIndex = expectedStepIndex + 1;

    if (newStepIndex >= rule.steps.length) {
      // ── SEQUENCE COMPLETE ─────────────────────────────────────────────────
      try {
        await stateDocRef.delete();
      } catch (e) {
        console.error('sequenceEngine: state delete on complete failed', e);
      }

      // Write trigger log
      let logId = null;
      try {
        const logRef = logsRef.doc();
        logId = logRef.id;
        await logRef.set({
          ruleId:      rule.id,
          ruleName:    rule.name,
          symbol:      symbol    || null,
          timeframe:   timeframe || null,
          price:       price     || null,
          triggeredAt: now,
          outcome:     null,
          notes:       '',
        });
      } catch (err) {
        console.error('sequenceEngine: trigger log write failed', err);
      }

      // Send Telegram notification
      if (telegramToken && telegramChatId) {
        const msg = [
          `🎯 <b>${rule.name}</b> triggered!`,
          `Symbol: <b>${symbol || '—'}</b>  |  TF: ${timeframe || '—'}  |  Price: ₹${formatPrice(price)}`,
          `Time: ${formatIST(now)} IST`,
          `Steps: ${rule.steps.join(' → ')}`,
        ].join('\n');

        sendTelegramNotification(telegramToken, telegramChatId, msg)
          .catch(err => console.error('sequenceEngine: Telegram notify failed', err));
      }

      console.log(`sequenceEngine: TRIGGERED rule "${rule.name}" for ${symbol} | log ${logId}`);

    } else {
      // ── Advance to next step ──────────────────────────────────────────────
      try {
        await stateDocRef.set({
          ruleId:           rule.id,
          ruleName:         rule.name,
          symbol,
          stepIndex:        newStepIndex,
          m1Timeframe:      expectedStepIndex === 0 ? (timeframe || null) : (stateData?.m1Timeframe || null),
          m1Price:          expectedStepIndex === 0 ? (price     || null) : (stateData?.m1Price     || null),
          lastMatchedAt:    now,
          lastMatchedPrice: price     || null,
          lastMatchedTF:    timeframe || null,
        });
      } catch (err) {
        console.error(`sequenceEngine: advance step failed for ${stateKey}`, err);
      }

      console.log(`sequenceEngine: rule "${rule.name}" ${symbol} → step ${newStepIndex}/${rule.steps.length}`);
    }
  }
}

module.exports = { runSequenceEngine, sendTelegramNotification, timeframeToMs };

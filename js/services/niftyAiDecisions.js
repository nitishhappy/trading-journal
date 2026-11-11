/**
 * ==============================================================================
 * NIFTY 50 — AI TRADE DECISIONS ENGINE & OUTCOME LOGGER
 * ==============================================================================
 * Implements:
 * 1. Directional 5M Candle Close Crossing Detection:
 *    - BUY level ([B1],[B2],[KB1],[KB2] / bullish): 5M candle crosses & closes >= level
 *    - SELL level ([S1],[S2],[KS1],[KS2] / bearish): 5M candle crosses & closes <= level
 *    - Triggers on First-Time directional close OR after configurable cooldown
 *      (AI_EVAL_COOLDOWN_MINS = 30 mins from config_nifty.txt) since last AI call.
 * 2. Multimodal AI Call (Screenshot of current 5M chart + full SMC/Price Action telemetry).
 * 3. Persistent Decision & Outcome Logging:
 *    - Decision: YES / NO
 *    - Type: BUY / SELL
 *    - Outcome: TP (as soon as TP1 is hit) or SL (or PENDING)
 *    - Points Captured / Lost: +TP1 pts or -SL pts
 *    - Logic behind decision + chart snapshot saved for review in Levels tab.
 * ==============================================================================
 */

(function (root) {
  'use strict';

  const STORAGE_KEY_DECISIONS = 'niftyAiTradeDecisionsLog_v1';
  const STORAGE_KEY_COOLDOWNS = 'niftyAiLastCallTimestamps_v1';
  const STORAGE_KEY_SCHEMA = 'niftyAiDecisionsSchemaVersion';
  const CURRENT_SCHEMA_VERSION = 'v2_min_rr2';
  const IST_OFFSET_SEC = 19800; // +05:30
  const FALLBACK_GEMINI_KEY = (typeof localStorage !== 'undefined' && localStorage.getItem('geminiApiKey')) || '';

  let inFlightEvaluations = new Set();

  function getNiftyAssetParams() {
    return (root.APP_CONFIG && root.APP_CONFIG.assetParamsConfig && root.APP_CONFIG.assetParamsConfig.nifty)
      || (root.assetParamsConfig && root.assetParamsConfig.nifty)
      || {};
  }

  function getCooldownMinutes() {
    const cfg = getNiftyAssetParams();
    const val = Number(cfg.AI_EVAL_COOLDOWN_MINS);
    return (!isNaN(val) && val > 0) ? val : 30;
  }

  function getMinRiskReward() {
    const cfg = getNiftyAssetParams();
    const val = Number(cfg.MIN_AI_TRADE_RR);
    return (!isNaN(val) && val > 0) ? val : 2.0;
  }

  function ensureSchemaUpToDate() {
    if (typeof localStorage === 'undefined') return;
    try {
      if (localStorage.getItem(STORAGE_KEY_SCHEMA) !== CURRENT_SCHEMA_VERSION) {
        localStorage.removeItem(STORAGE_KEY_DECISIONS);
        localStorage.removeItem(STORAGE_KEY_COOLDOWNS);
        localStorage.setItem(STORAGE_KEY_SCHEMA, CURRENT_SCHEMA_VERSION);
      }
    } catch (e) {}
  }

  function loadDecisionsLog() {
    ensureSchemaUpToDate();
    try {
      const raw = localStorage.getItem(STORAGE_KEY_DECISIONS);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.warn('[NiftyAiDecisions] Failed to load decisions log:', e);
      return [];
    }
  }

  function saveDecisionsLog(list) {
    try {
      const trimmed = Array.isArray(list) ? list.slice(0, 150) : [];
      localStorage.setItem(STORAGE_KEY_DECISIONS, JSON.stringify(trimmed));
      notifyListeners();
    } catch (e) {
      // If quota exceeded due to base64 screenshots, strip older screenshots and retry
      try {
        const compact = (Array.isArray(list) ? list.slice(0, 100) : []).map((item, idx) => {
          if (idx > 15 && item.screenshotDataUrl) {
            return { ...item, screenshotDataUrl: null };
          }
          return item;
        });
        localStorage.setItem(STORAGE_KEY_DECISIONS, JSON.stringify(compact));
        notifyListeners();
      } catch (e2) {
        console.error('[NiftyAiDecisions] Storage quota error:', e2);
      }
    }
  }

  function loadCooldownMap() {
    ensureSchemaUpToDate();
    try {
      const raw = localStorage.getItem(STORAGE_KEY_COOLDOWNS);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function saveCooldownMap(map) {
    try {
      localStorage.setItem(STORAGE_KEY_COOLDOWNS, JSON.stringify(map || {}));
    } catch (e) {}
  }

  function clearDecisionsLog() {
    localStorage.removeItem(STORAGE_KEY_DECISIONS);
    localStorage.removeItem(STORAGE_KEY_COOLDOWNS);
    try {
      const todayIst = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      localStorage.setItem('niftyAiUserClearedDate', todayIst);
    } catch (e) {}
    notifyListeners();
  }

  function notifyListeners() {
    try {
      root.dispatchEvent(new CustomEvent('nifty-ai-decisions-updated'));
    } catch (e) {}
    try {
      if (root.parent && root.parent !== root) {
        root.parent.postMessage({ type: 'NIFTY_AI_DECISIONS_UPDATED' }, '*');
      }
    } catch (e) {}
  }

  function formatCandleTimeIST(epochSec) {
    if (!epochSec) return '--:--';
    const d = new Date(Number(epochSec) * 1000);
    return d.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  }

  function formatCandleClockOnlyIST(epochSec) {
    if (!epochSec) return '--:--';
    const d = new Date(Number(epochSec) * 1000);
    return d.toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  }

  function getCandleSessionDateKey(epochSec) {
    if (!epochSec) return '';
    const d = new Date(Number(epochSec) * 1000);
    return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  }

  function parseTp1AndSl(entryPrice, tpStr, slStr, tradeType) {
    const entry = Number(entryPrice) || 0;
    let tp1 = null;
    let sl = null;

    if (tpStr && String(tpStr).toLowerCase() !== 'na' && String(tpStr).toLowerCase() !== 'open') {
      const rawParts = String(tpStr).split(/<br\s*\/?>|\n|[\/|]/i);
      for (const p of rawParts) {
        const cleanPart = p.replace(/\*\*TP\d*:?\s*\*?/gi, '').replace(/TP\d*:?\s*/gi, '').trim();
        const cleaned = cleanPart.split(/[-–]/)[0].replace(/,/g, '').trim();
        const m = cleaned.match(/([0-9]{4,6}(?:\.[0-9]+)?)/);
        if (m) {
          const val = parseFloat(m[1]);
          if (!isNaN(val) && val > 10000) {
            tp1 = val;
            break;
          }
        }
      }
    }

    if (slStr && String(slStr).toLowerCase() !== 'na' && String(slStr).toLowerCase() !== 'manual') {
      const cleanedSl = String(slStr).replace(/,/g, '');
      const m = cleanedSl.match(/([0-9]{4,6}(?:\.[0-9]+)?)/);
      if (m) {
        const val = parseFloat(m[1]);
        if (!isNaN(val) && val > 10000) {
          sl = val;
        }
      }
    }

    // Fallback sensible structural TP1 / SL if level text had "Open"/"Manual"
    if (!sl && entry > 10000) {
      sl = tradeType === 'BUY' ? Math.round(entry - 25) : Math.round(entry + 25);
    }
    if (!tp1 && entry > 10000) {
      const risk = Math.abs(entry - (sl || (entry - 25))) || 25;
      tp1 = tradeType === 'BUY' ? Math.round(entry + risk * 2) : Math.round(entry - risk * 2);
    }

    const isBuy = (tradeType || 'BUY').toUpperCase() === 'BUY';
    const risk = isBuy ? (entry - sl) : (sl - entry);
    const reward = isBuy ? (tp1 - entry) : (entry - tp1);
    const rrRatio = (risk > 0 && reward > 0) ? Number((reward / risk).toFixed(2)) : 0;

    return { tp1, sl, rrRatio };
  }

  function classify5mCandleAnatomy(c) {
    const open = Number(c.open);
    const high = Number(c.high);
    const low = Number(c.low);
    const close = Number(c.close);
    const range = Math.max(0.01, high - low);
    const body = Math.abs(close - open);
    const bodyPct = Number(((body / range) * 100).toFixed(1));
    const upperWick = high - Math.max(open, close);
    const lowerWick = Math.min(open, close) - low;
    const upperWickPct = Number(((upperWick / range) * 100).toFixed(1));
    const lowerWickPct = Number(((lowerWick / range) * 100).toFixed(1));
    const isBull = close >= open;

    let archetype = isBull ? 'Bullish Standard Close' : 'Bearish Standard Close';
    if (bodyPct >= 65) {
      archetype = isBull ? 'Bullish Displacement Marubozu' : 'Bearish Displacement Marubozu';
    } else if (lowerWickPct >= 45 && bodyPct <= 40) {
      archetype = 'Bullish Demand Absorption Pinbar';
    } else if (upperWickPct >= 45 && bodyPct <= 40) {
      archetype = 'Bearish Supply Rejection Pinbar';
    } else if (bodyPct <= 18) {
      archetype = 'Indecision Doji';
    }

    return {
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
      rangePts: Number(range.toFixed(2)),
      bodyPct,
      upperWickPct,
      lowerWickPct,
      archetype
    };
  }

  function computeMarketContext(candlesUpToClose, closedCandle) {
    if (!candlesUpToClose || candlesUpToClose.length === 0) {
      return {};
    }
    // 1. 9 EMA calculation
    const period = 9;
    const k = 2 / (period + 1);
    let ema = candlesUpToClose[0].close;
    for (let i = 1; i < candlesUpToClose.length; i++) {
      ema = (candlesUpToClose[i].close - ema) * k + ema;
    }
    const ema9 = Number(ema.toFixed(2));
    const diffEma = Number((closedCandle.close - ema9).toFixed(2));
    const closeVsEma9 = diffEma >= 0 ? `+${diffEma} pts ABOVE 9 EMA` : `${diffEma} pts BELOW 9 EMA`;

    // 2. Session candles for Day High/Low & 15M ORB
    const sessionKey = getCandleSessionDateKey(closedCandle.time);
    const sessionCandles = candlesUpToClose.filter(c => getCandleSessionDateKey(c.time) === sessionKey);
    const activeSet = sessionCandles.length > 0 ? sessionCandles : candlesUpToClose.slice(-30);

    const dayHigh = Number(Math.max(...activeSet.map(c => c.high)).toFixed(2));
    const dayLow = Number(Math.min(...activeSet.map(c => c.low)).toFixed(2));

    const orbBars = activeSet.slice(0, 3);
    const orbHigh = orbBars.length > 0 ? Number(Math.max(...orbBars.map(c => c.high)).toFixed(2)) : dayHigh;
    const orbLow = orbBars.length > 0 ? Number(Math.min(...orbBars.map(c => c.low)).toFixed(2)) : dayLow;

    const last6 = candlesUpToClose.slice(-6).map(c => {
      const dir = c.close >= c.open ? '🟢' : '🔴';
      return `${dir}${c.close.toFixed(0)}(H:${c.high.toFixed(0)}/L:${c.low.toFixed(0)})`;
    }).join(' -> ');

    return {
      ema9,
      closeVsEma9,
      orbHigh,
      orbLow,
      dayHigh,
      dayLow,
      recent5mSummary: last6
    };
  }

  /**
   * Renders a clean 5M candlestick snapshot with 9 EMA + Level/TP1/SL lines onto an offscreen canvas,
   * or captures from LightweightCharts chartInstance if available.
   */
  function captureOrRenderChartScreenshot(candlesUpToClose, levelInfo, chartInstance) {
    try {
      if (chartInstance && typeof chartInstance.takeScreenshot === 'function') {
        const rawCanvas = chartInstance.takeScreenshot();
        if (rawCanvas && rawCanvas.width > 0) {
          const maxW = 850;
          const scale = Math.min(1, maxW / rawCanvas.width);
          const outCanvas = document.createElement('canvas');
          outCanvas.width = Math.round(rawCanvas.width * scale);
          outCanvas.height = Math.round(rawCanvas.height * scale);
          const ctx = outCanvas.getContext('2d');
          ctx.drawImage(rawCanvas, 0, 0, outCanvas.width, outCanvas.height);
          return outCanvas.toDataURL('image/jpeg', 0.8);
        }
      }
    } catch (e) {
      console.warn('[NiftyAiDecisions] chartInstance.takeScreenshot fallback:', e);
    }

    // Fallback / Synthetic High-Clarity 5M Candlestick Renderer (used when triggered from Levels tab or headless scan)
    try {
      const bars = (candlesUpToClose || []).slice(-36);
      if (bars.length < 2) return null;

      const canvas = document.createElement('canvas');
      const W = 800;
      const H = 420;
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      // Background
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, W, H);

      const padL = 16, padR = 78, padT = 36, padB = 28;
      const plotW = W - padL - padR;
      const plotH = H - padT - padB;

      let minP = Math.min(...bars.map(b => b.low));
      let maxP = Math.max(...bars.map(b => b.high));
      [levelInfo.price, levelInfo.tp1, levelInfo.sl].forEach(p => {
        if (p && !isNaN(p)) {
          minP = Math.min(minP, Number(p));
          maxP = Math.max(maxP, Number(p));
        }
      });
      const padRange = Math.max(15, (maxP - minP) * 0.08);
      minP -= padRange;
      maxP += padRange;

      const priceToY = (p) => padT + plotH - ((p - minP) / Math.max(1, maxP - minP)) * plotH;

      // Grid lines
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.12)';
      ctx.lineWidth = 1;
      for (let i = 0; i <= 5; i++) {
        const p = minP + ((maxP - minP) * i) / 5;
        const y = priceToY(p);
        ctx.beginPath();
        ctx.moveTo(padL, y);
        ctx.lineTo(W - padR, y);
        ctx.stroke();
        ctx.fillStyle = '#94a3b8';
        ctx.font = '10px JetBrains Mono, monospace';
        ctx.fillText(p.toFixed(0), W - padR + 6, y + 3);
      }

      // Draw Level, TP1, SL horizontal lines
      const drawHLine = (price, color, label, dashed = false) => {
        if (!price || isNaN(price)) return;
        const y = priceToY(Number(price));
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.8;
        if (dashed) ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.moveTo(padL, y);
        ctx.lineTo(W - padR, y);
        ctx.stroke();
        ctx.fillStyle = color;
        ctx.font = 'bold 10px Inter, sans-serif';
        ctx.fillText(`${label}: ₹${Number(price).toFixed(0)}`, padL + 6, y - 5);
        ctx.restore();
      };

      drawHLine(levelInfo.price, '#f59e0b', `${levelInfo.tag} ENTRY`, false);
      drawHLine(levelInfo.tp1, '#10b981', 'TP1', true);
      drawHLine(levelInfo.sl, '#f43f5e', 'SL', true);

      // Draw 5M Candlesticks & 9 EMA
      const stepX = plotW / bars.length;
      const bodyW = Math.max(4, Math.min(14, stepX * 0.65));
      const k = 2 / 10;
      let ema = bars[0].close;
      const emaPts = [];

      bars.forEach((b, idx) => {
        const cx = padL + (idx + 0.5) * stepX;
        ema = idx === 0 ? b.close : (b.close - ema) * k + ema;
        emaPts.push({ x: cx, y: priceToY(ema) });

        const isUp = b.close >= b.open;
        const color = isUp ? '#10b981' : '#f43f5e';
        const yHigh = priceToY(b.high);
        const yLow = priceToY(b.low);
        const yOpen = priceToY(b.open);
        const yClose = priceToY(b.close);

        ctx.strokeStyle = color;
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(cx, yHigh);
        ctx.lineTo(cx, yLow);
        ctx.stroke();

        ctx.fillStyle = color;
        const topY = Math.min(yOpen, yClose);
        const bh = Math.max(2, Math.abs(yClose - yOpen));
        ctx.fillRect(cx - bodyW / 2, topY, bodyW, bh);
      });

      // 9 EMA Line
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      emaPts.forEach((pt, idx) => {
        if (idx === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      });
      ctx.stroke();

      // Title Banner
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 12px Inter, sans-serif';
      const lastBar = bars[bars.length - 1];
      ctx.fillText(
        `NIFTY 50 • 5M Chart • ${levelInfo.tag} (${levelInfo.tradeType}) Close @ ₹${lastBar.close.toFixed(1)} (${formatCandleTimeIST(lastBar.time)})`,
        padL,
        22
      );

      return canvas.toDataURL('image/jpeg', 0.82);
    } catch (err) {
      console.warn('[NiftyAiDecisions] Offscreen chart render error:', err);
      return null;
    }
  }

  async function resolveOptionalApiKey() {
    try {
      const lsKey = localStorage.getItem('geminiApiKey');
      if (lsKey && lsKey.trim()) return lsKey.trim();
    } catch (e) {}
    try {
      if (typeof root.loadGoogleApiKey === 'function') {
        const gKey = await root.loadGoogleApiKey();
        if (gKey && gKey.trim()) return gKey.trim();
      }
    } catch (e) {}
    return FALLBACK_GEMINI_KEY || '';
  }

  function applyMinRiskRewardGate(aiResult, lvl) {
    const minRR = Number((lvl && lvl.minRR) || getMinRiskReward());
    const rawRR = lvl && lvl.rrRatio !== undefined ? Number(lvl.rrRatio) : 0;
    const effectiveRR = isFinite(rawRR) ? rawRR : 0;

    if (aiResult && aiResult.decision === 'YES' && effectiveRR < minRR) {
      return {
        ...aiResult,
        decision: 'NO',
        confidence: Math.min(Number(aiResult.confidence || 45), 45),
        logic: `[R:R Filter: 1:${effectiveRR.toFixed(2)} < min 1:${minRR.toFixed(1)}] Planned Reward to TP1 (₹${lvl.tp1 || 'N/A'}) vs Risk to SL (₹${lvl.sl || 'N/A'}) does not meet minimum 1:${minRR.toFixed(1)} Risk:Reward.`
      };
    }
    return aiResult;
  }

  /**
   * Calls /api/evaluateNiftyTrade (with direct Gemini Flash Vision browser fallback if local server is static).
   */
  async function requestAiTradeDecision(screenshotBase64, telemetry) {
    const optionalKey = await resolveOptionalApiKey();
    const lvl = telemetry.level || {};
    const c = telemetry.candle || {};
    const ctx = telemetry.marketContext || {};
    const tradeType = (lvl.tradeType || 'BUY').toUpperCase();
    const minRR = Number(lvl.minRR || getMinRiskReward());

    // 1. Try serverless API route first
    try {
      const isLocalFile = typeof window !== 'undefined' && (window.location.protocol === 'file:');
      const apiBase = isLocalFile ? 'https://trading-journal-sandy-three.vercel.app' : '';
      const resp = await fetch(`${apiBase}/api/evaluateNiftyTrade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ screenshotBase64, telemetry, apiKey: optionalKey || undefined })
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data && data.success && data.decision) {
          return applyMinRiskRewardGate(data, lvl);
        }
      }
    } catch (e) {
      // Proceed to direct Gemini Vision / Vercel fallback
    }

    // 2. If running on local static server (Port 8080), try direct Gemini Vision API when a key is present
    const prompt = `You are an elite Institutional NIFTY 50 Intraday SMC & Price Action Co-Pilot.
A 5-minute NIFTY candle has just CLOSED ${tradeType === 'BUY' ? 'ABOVE a mapped BUY level' : 'BELOW a mapped SELL level'}.
Inspect the attached 5-minute NIFTY chart and telemetry to decide if the trade should be taken ("YES" or "NO").

Trigger Level: ${lvl.tag} (${tradeType}) @ ₹${lvl.price} | TP1: ₹${lvl.tp1} | SL: ₹${lvl.sl} | R:R 1:${lvl.rrRatio} (Min Required: 1:${minRR.toFixed(1)})
Trigger Type: ${lvl.triggerType}
Planned Behavior: "${lvl.behavior}"
5M Trigger Candle (${c.timeIST}): O:${c.open} H:${c.high} L:${c.low} C:${c.close} (Range: ${c.rangePts} pts, Body: ${c.bodyPct}%, UpperWick: ${c.upperWickPct}%, LowerWick: ${c.lowerWickPct}%, Archetype: ${c.archetype})
Market Structure: 9 EMA ₹${ctx.ema9} (${ctx.closeVsEma9}), 15M ORB ₹${ctx.orbLow}-₹${ctx.orbHigh}, Day Range ₹${ctx.dayLow}-₹${ctx.dayHigh}.

IMPORTANT: Return "NO" if Planned R:R (1:${lvl.rrRatio}) is below 1:${minRR.toFixed(1)}.

Return strict JSON:
{
  "decision": "YES", // Strictly "YES" or "NO"
  "tradeType": "${tradeType}", // "BUY" or "SELL"
  "confidence": 82,
  "logic": "2-3 concise sentences explaining WHY the trade should or should not be taken based on 5M close quality, wicks, 9 EMA, and R:R to TP1."
}`;

    if (optionalKey) {
      try {
        let cleanB64 = '';
        if (screenshotBase64 && screenshotBase64.includes(',')) {
          cleanB64 = screenshotBase64.split(',')[1];
        }
        const parts = [{ text: prompt }];
        if (cleanB64) {
          parts.push({ inline_data: { mime_type: 'image/jpeg', data: cleanB64 } });
        }
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${encodeURIComponent(optionalKey)}`;
        const gResp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts }],
            generationConfig: { temperature: 0.15, response_mime_type: 'application/json' }
          })
        });
        if (gResp.ok) {
          const gData = await gResp.json();
          const rawTxt = gData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
          if (rawTxt) {
            const parsed = JSON.parse(rawTxt.replace(/^```json\s*|\s*```$/gm, '').trim());
            return applyMinRiskRewardGate({
              success: true,
              decision: String(parsed.decision || '').toUpperCase().includes('YES') ? 'YES' : 'NO',
              tradeType: String(parsed.tradeType || tradeType).toUpperCase().includes('SELL') ? 'SELL' : 'BUY',
              confidence: Number(parsed.confidence || 78),
              logic: String(parsed.logic || 'Evaluated 5M close and SMC structure.'),
              model: 'gemini-3-flash-preview'
            }, lvl);
          }
        }
      } catch (e) {
        console.warn('[NiftyAiDecisions] Direct Gemini Vision call fallback:', e);
      }
    }

    // 3. Deterministic SMC Telemetry Fallback (if offline)
    const dist = Math.abs(Number(c.close || 0) - Number(lvl.price || 0));
    const goodBody = tradeType === 'BUY'
      ? (c.close >= c.open && c.bodyPct >= 40 && c.upperWickPct < 45)
      : (c.close <= c.open && c.bodyPct >= 40 && c.lowerWickPct < 45);
    const notChased = dist <= 35;
    const rrVal = Number(lvl.rrRatio || 0);
    const hasMinRR = isFinite(rrVal) && rrVal >= minRR;
    const isYes = goodBody && notChased && hasMinRR;

    let skipReason = '';
    if (!hasMinRR) {
      skipReason = `R:R 1:${rrVal.toFixed(2)} below min 1:${minRR.toFixed(1)} (TP1 ₹${lvl.tp1}, SL ₹${lvl.sl}).`;
    } else if (!notChased) {
      skipReason = `Close extended ${dist.toFixed(1)} pts beyond level (chased entry).`;
    } else {
      skipReason = `Weak candle close anatomy (${c.archetype}, UpperWick ${c.upperWickPct}%, LowerWick ${c.lowerWickPct}%).`;
    }

    return applyMinRiskRewardGate({
      success: true,
      decision: isYes ? 'YES' : 'NO',
      tradeType,
      confidence: isYes ? 76 : 42,
      logic: isYes
        ? `${c.archetype} closed cleanly ${tradeType === 'BUY' ? 'above' : 'below'} ${lvl.tag} (₹${lvl.price}) with ${c.bodyPct}% body (${ctx.closeVsEma9}) and 1:${rrVal.toFixed(2)} R:R (>= 1:${minRR.toFixed(1)}) to TP1 (₹${lvl.tp1}).`
        : `Skipped ${lvl.tag} @ ₹${lvl.price}: ${skipReason}`,
      model: 'smc-telemetry-engine'
    }, lvl);
  }

  /**
   * Resolves PENDING outcomes against subsequent 5M candles OR live spot price.
   * Marks Outcome = "TP" as soon as TP1 is hit, or "SL" if Stop Loss is hit.
   * Computes Points Captured (+) or Points Lost (-).
   */
  function evaluatePendingOutcomes(candlesOrPrice) {
    const decisions = loadDecisionsLog();
    if (decisions.length === 0) return false;

    let changed = false;

    // Live spot price tick mode: { currentPrice, timeSec }
    if (candlesOrPrice && !Array.isArray(candlesOrPrice) && typeof candlesOrPrice === 'object' && candlesOrPrice.currentPrice) {
      const livePrice = Number(candlesOrPrice.currentPrice);
      if (isNaN(livePrice) || livePrice <= 0) return false;
      const nowDisplay = formatCandleTimeIST(Math.floor(Date.now() / 1000));

      decisions.forEach(dec => {
        if (dec.outcome !== 'PENDING') return;
        const tradeType = (dec.tradeType || dec.type || 'BUY').toUpperCase();
        const isBuy = tradeType === 'BUY';
        const tp1 = Number(dec.tp1Price);
        const sl = Number(dec.slPrice);
        const entry = Number(dec.entryPrice ?? dec.closePrice);
        if (isNaN(entry) || entry <= 0) return;

        if (isBuy) {
          if (!isNaN(tp1) && tp1 > 0 && livePrice >= tp1) {
            dec.outcome = 'TP';
            dec.points = Number((tp1 - entry).toFixed(1));
            dec.outcomeTime = nowDisplay;
            dec.resolvedTimeIst = nowDisplay;
            dec.outcomePrice = tp1;
            changed = true;
          } else if (!isNaN(sl) && sl > 0 && livePrice <= sl) {
            dec.outcome = 'SL';
            dec.points = Number((-Math.abs(entry - sl)).toFixed(1));
            dec.outcomeTime = nowDisplay;
            dec.resolvedTimeIst = nowDisplay;
            dec.outcomePrice = sl;
            changed = true;
          } else {
            dec.livePoints = Number((livePrice - entry).toFixed(1));
            dec.floatingPoints = dec.livePoints;
          }
        } else {
          if (!isNaN(tp1) && tp1 > 0 && livePrice <= tp1) {
            dec.outcome = 'TP';
            dec.points = Number((entry - tp1).toFixed(1));
            dec.outcomeTime = nowDisplay;
            dec.resolvedTimeIst = nowDisplay;
            dec.outcomePrice = tp1;
            changed = true;
          } else if (!isNaN(sl) && sl > 0 && livePrice >= sl) {
            dec.outcome = 'SL';
            dec.points = Number((-Math.abs(sl - entry)).toFixed(1));
            dec.outcomeTime = nowDisplay;
            dec.resolvedTimeIst = nowDisplay;
            dec.outcomePrice = sl;
            changed = true;
          } else {
            dec.livePoints = Number((entry - livePrice).toFixed(1));
            dec.floatingPoints = dec.livePoints;
          }
        }
      });

      if (changed) saveDecisionsLog(decisions);
      return changed;
    }

    const candles = candlesOrPrice;
    if (!candles || !Array.isArray(candles) || candles.length === 0) return false;

    const latestCandle = candles[candles.length - 1];

    decisions.forEach(dec => {
      const decSession = dec.sessionDate || getCandleSessionDateKey(dec.candleTime);
      const subsequentBars = candles.filter(c =>
        c.time > dec.candleTime && getCandleSessionDateKey(c.time) === decSession
      );

      if (dec.outcome === 'PENDING') {
        const tradeType = (dec.tradeType || dec.type || 'BUY').toUpperCase();
        const isBuy = tradeType === 'BUY';
        const tp1 = Number(dec.tp1Price);
        const sl = Number(dec.slPrice);
        const entry = Number(dec.entryPrice ?? dec.closePrice);

        for (const bar of subsequentBars) {
          if (isBuy) {
            if (!isNaN(tp1) && tp1 > 0 && bar.high >= tp1) {
              dec.outcome = 'TP';
              dec.points = Number((tp1 - entry).toFixed(1));
              dec.outcomeTime = formatCandleTimeIST(bar.time);
              dec.resolvedTimeIst = dec.outcomeTime;
              dec.outcomePrice = tp1;
              changed = true;
              break;
            } else if (!isNaN(sl) && sl > 0 && bar.low <= sl) {
              dec.outcome = 'SL';
              dec.points = Number((-Math.abs(entry - sl)).toFixed(1));
              dec.outcomeTime = formatCandleTimeIST(bar.time);
              dec.resolvedTimeIst = dec.outcomeTime;
              dec.outcomePrice = sl;
              changed = true;
              break;
            }
          } else {
            if (!isNaN(tp1) && tp1 > 0 && bar.low <= tp1) {
              dec.outcome = 'TP';
              dec.points = Number((entry - tp1).toFixed(1));
              dec.outcomeTime = formatCandleTimeIST(bar.time);
              dec.resolvedTimeIst = dec.outcomeTime;
              dec.outcomePrice = tp1;
              changed = true;
              break;
            } else if (!isNaN(sl) && sl > 0 && bar.high >= sl) {
              dec.outcome = 'SL';
              dec.points = Number((-Math.abs(sl - entry)).toFixed(1));
              dec.outcomeTime = formatCandleTimeIST(bar.time);
              dec.resolvedTimeIst = dec.outcomeTime;
              dec.outcomePrice = sl;
              changed = true;
              break;
            }
          }
        }

        // Update floating live points if still PENDING
        if (dec.outcome === 'PENDING' && latestCandle && getCandleSessionDateKey(latestCandle.time) === decSession) {
          const rawDiff = isBuy ? (latestCandle.close - entry) : (entry - latestCandle.close);
          const nextLive = Number(rawDiff.toFixed(1));
          if (dec.livePoints !== nextLive) {
            dec.livePoints = nextLive;
            dec.floatingPoints = nextLive;
            changed = true;
          }
        }
      }
    });

    if (changed) {
      saveDecisionsLog(decisions);
    }
    return changed;
  }

  /**
   * Checks if a newly closed 5M candle crossed and closed above a Buy level or below a Sell level
   * for the FIRST time OR after 30 minutes (AI_EVAL_COOLDOWN_MINS) from the last AI call.
   */
  async function checkAndTriggerLevelCloseAi(candles, activePriceLines, chartInstance, options = {}) {
    if (!candles || candles.length < 3 || !activePriceLines || activePriceLines.length === 0) {
      return [];
    }

    // First, update any PENDING outcomes with the latest candles
    evaluatePendingOutcomes(candles);

    const closedIdx = options.closedCandleIndex !== undefined ? options.closedCandleIndex : (candles.length - 2);
    if (closedIdx < 1 || closedIdx >= candles.length) return [];

    const closedCandle = candles[closedIdx];
    const prevCandle = candles[closedIdx - 1];
    if (!closedCandle || !prevCandle) return [];

    const candlesUpToClose = candles.slice(0, closedIdx + 1);
    const sessionKey = getCandleSessionDateKey(closedCandle.time);
    const cooldownMins = getCooldownMinutes();
    const cooldownSec = cooldownMins * 60;

    const cooldownMap = loadCooldownMap();
    const existingDecisions = loadDecisionsLog();
    const triggeredRecords = [];

    for (const item of activePriceLines) {
      const lvlObj = item.levelObj || item;
      const lvlPrice = parseFloat(String(item.price || lvlObj.price || lvlObj.pHigh || '').replace(/[^0-9.]/g, ''));
      if (isNaN(lvlPrice) || lvlPrice < 10000) continue;

      const rawTag = item.tag || lvlObj.source || '';
      const beh = lvlObj.behavior || '';
      const tagMatch = (rawTag + ' ' + beh).match(/\[(K?[BS]\d+)\]/i);
      const tag = tagMatch ? `[${tagMatch[1].toUpperCase()}]` : (rawTag || (lvlObj.bias === 'bearish' ? '[S1]' : '[B1]'));

      const isBuyLevel = /B/i.test(tag) ? true : (/S/i.test(tag) ? false : (lvlObj.bias !== 'bearish'));
      const tradeType = isBuyLevel ? 'BUY' : 'SELL';

      // Directional Cross & Close Condition:
      // - BUY level: closedCandle.close >= lvlPrice AND candle crossed/touched from below
      // - SELL level: closedCandle.close <= lvlPrice AND candle crossed/touched from above
      let directionalCrossClose = false;
      if (isBuyLevel) {
        const closedAbove = closedCandle.close >= lvlPrice;
        const touchedOrCrossedUp = (prevCandle.close < lvlPrice) || (closedCandle.open < lvlPrice) || (closedCandle.low <= lvlPrice);
        directionalCrossClose = closedAbove && touchedOrCrossedUp;
      } else {
        const closedBelow = closedCandle.close <= lvlPrice;
        const touchedOrCrossedDown = (prevCandle.close > lvlPrice) || (closedCandle.open > lvlPrice) || (closedCandle.high >= lvlPrice);
        directionalCrossClose = closedBelow && touchedOrCrossedDown;
      }

      if (!directionalCrossClose) continue;

      const levelCooldownKey = `${sessionKey}_${tag}_${Math.round(lvlPrice)}`;
      const uniqueEventId = `${levelCooldownKey}_${closedCandle.time}`;

      if (inFlightEvaluations.has(uniqueEventId)) continue;
      if (existingDecisions.some(d => d.id === uniqueEventId)) continue;

      const lastCallTime = cooldownMap[levelCooldownKey] || null;
      let triggerType = null;

      if (!lastCallTime) {
        triggerType = 'FIRST_CLOSE';
      } else if ((closedCandle.time - lastCallTime) >= cooldownSec) {
        triggerType = 'RETOUCH_30M';
      } else {
        // Within 30-minute cooldown window from last AI call -> skip
        continue;
      }

      // Mark cooldown & in-flight immediately so duplicate calls don't fire
      inFlightEvaluations.add(uniqueEventId);
      cooldownMap[levelCooldownKey] = closedCandle.time;
      saveCooldownMap(cooldownMap);

      try {
        const { tp1, sl, rrRatio } = parseTp1AndSl(closedCandle.close, lvlObj.tp, lvlObj.sl, tradeType);
        const anatomy = classify5mCandleAnatomy(closedCandle);
        const distanceFromLevel = Number((closedCandle.close - lvlPrice).toFixed(2));
        const marketContext = computeMarketContext(candlesUpToClose, closedCandle);
        const timeIST = formatCandleTimeIST(closedCandle.time);

        const levelTelemetry = {
          tag,
          bias: isBuyLevel ? 'bullish' : 'bearish',
          tradeType,
          price: lvlPrice,
          tp1,
          tpRaw: lvlObj.tp || String(tp1),
          sl,
          rrRatio,
          minRR: getMinRiskReward(),
          behavior: beh || `${tag} ${tradeType} reaction level`,
          triggerType,
          cooldownMins
        };

        const telemetry = {
          level: levelTelemetry,
          candle: {
            time: closedCandle.time,
            timeIST,
            ...anatomy,
            distanceFromLevel: `${distanceFromLevel >= 0 ? '+' : ''}${distanceFromLevel}`
          },
          marketContext
        };

        const screenshotDataUrl = captureOrRenderChartScreenshot(candlesUpToClose, levelTelemetry, chartInstance);
        const aiResult = await requestAiTradeDecision(screenshotDataUrl, telemetry);

        const clockOnlyIST = formatCandleClockOnlyIST(closedCandle.time);
        const record = {
          id: uniqueEventId,
          createdAt: new Date().toISOString(),
          sessionDate: sessionKey,
          candleTime: closedCandle.time,
          timeDisplay: timeIST,
          candleTimeIst: clockOnlyIST,
          candleDateIst: sessionKey,
          tag,
          levelTag: tag.replace(/[\[\]]/g, ''),
          levelPrice: lvlPrice,
          triggerType,
          triggerReason: triggerType === 'RETOUCH_30M' ? 'COOLDOWN_30M_CLOSE' : 'FIRST_5M_CLOSE',
          decision: aiResult.decision || 'NO',
          tradeType: aiResult.tradeType || tradeType,
          type: aiResult.tradeType || tradeType,
          confidence: aiResult.confidence || 75,
          entryPrice: Number(closedCandle.close.toFixed(2)),
          closePrice: Number(closedCandle.close.toFixed(2)),
          tp1Price: tp1,
          slPrice: sl,
          rrRatio,
          outcome: 'PENDING',
          points: 0,
          livePoints: 0,
          floatingPoints: 0,
          outcomeTime: null,
          resolvedTimeIst: null,
          logic: aiResult.logic || '',
          wickObservation: aiResult.wickObservation || `${anatomy.archetype} (Body ${anatomy.bodyPct}%)`,
          model: aiResult.model || 'gemini-vision',
          modelUsed: aiResult.model || 'gemini-vision',
          behaviorThesis: levelTelemetry.behavior,
          screenshotDataUrl
        };

        const currentLog = loadDecisionsLog();
        if (!currentLog.some(d => d.id === record.id)) {
          currentLog.unshift(record);
          saveDecisionsLog(currentLog);
        }

        // Resolve outcome immediately if subsequent candles already exist (e.g. during session scan/replay)
        evaluatePendingOutcomes(candles);

        triggeredRecords.push(record);

        if (options.onDecisionLogged && typeof options.onDecisionLogged === 'function') {
          options.onDecisionLogged(record);
        }
      } catch (err) {
        console.error('[NiftyAiDecisions] Evaluation failed:', err);
      } finally {
        inFlightEvaluations.delete(uniqueEventId);
      }
    }

    return triggeredRecords;
  }

  /**
   * Scans an entire day's 5M candle array chronologically, matching each bar to the active briefing
   * (time-aware when timestamps exist), triggering AI evaluations on First Close and 30m+ Cooldown
   * re-touches, and resolving TP1/SL outcomes.
   * Supports both positional args (candles, levelsList, chartInstance, onProgress)
   * and options object ({ candles5m, levels, chartInstance, onProgress, targetSession }).
   */
  async function scanSessionCandlesForLevels(candlesOrOpts, levelsListArg, chartInstanceArg, onProgressArg) {
    let candles = candlesOrOpts;
    let levelsList = levelsListArg;
    let chartInstance = chartInstanceArg;
    let onProgress = onProgressArg;
    let explicitSession = null;

    if (candlesOrOpts && !Array.isArray(candlesOrOpts) && typeof candlesOrOpts === 'object') {
      candles = candlesOrOpts.candles5m || candlesOrOpts.candles;
      levelsList = candlesOrOpts.levels || candlesOrOpts.levelsList || levelsListArg;
      chartInstance = candlesOrOpts.chartInstance || chartInstanceArg;
      onProgress = candlesOrOpts.onProgress || onProgressArg;
      explicitSession = candlesOrOpts.targetSession || null;
    }

    if (!candles || !Array.isArray(candles) || candles.length < 2 || !levelsList || !Array.isArray(levelsList) || levelsList.length === 0) {
      return [];
    }

    const sortedCandles = [...candles].sort((a, b) => a.time - b.time);
    const lastBarTime = sortedCandles[sortedCandles.length - 1].time;
    const targetSession = explicitSession || getCandleSessionDateKey(lastBarTime);

    // Filter levels to target session if timestamped; keep untimestamped manual levels too
    const sessionTimedLevels = levelsList.filter(l => {
      if (!l.timestamp) return false;
      const ms = new Date(l.timestamp).getTime();
      if (isNaN(ms)) return false;
      return getCandleSessionDateKey(Math.floor(ms / 1000)) === targetSession;
    });
    const manualUntimedLevels = levelsList.filter(l => !l.timestamp);

    const normalizeList = (rawList) => rawList.map((l, idx) => {
      const pVal = parseFloat(String(l.price || l.rawPrice || l.pHigh || '').split('-')[0].replace(/[^0-9.]/g, ''));
      const beh = l.behavior || '';
      const tagMatch = (String(l.tag || l.source || '') + ' ' + beh).match(/\[(K?[BS]\d+)\]/i);
      const tag = tagMatch ? `[${tagMatch[1].toUpperCase()}]` : (l.tag || l.source || (l.bias === 'bearish' ? `[S${idx + 1}]` : `[B${idx + 1}]`));
      return {
        price: pVal,
        tag,
        levelObj: {
          price: pVal,
          bias: l.bias || (/S/i.test(tag) ? 'bearish' : 'bullish'),
          behavior: beh,
          tp: l.tp,
          sl: l.sl
        }
      };
    }).filter(item => !isNaN(item.price) && item.price > 10000);

    // Group session-timed levels by briefing timestamp so each candle sees only the briefing active at bar close
    const briefingGroupsMap = new Map();
    sessionTimedLevels.forEach(l => {
      const tsMs = new Date(l.timestamp).getTime();
      if (!briefingGroupsMap.has(l.timestamp)) {
        briefingGroupsMap.set(l.timestamp, { tsMs, raw: [] });
      }
      briefingGroupsMap.get(l.timestamp).raw.push(l);
    });
    const sortedBriefingGroups = Array.from(briefingGroupsMap.values())
      .sort((a, b) => a.tsMs - b.tsMs)
      .map(g => ({ tsMs: g.tsMs, lines: normalizeList(g.raw) }));
    const manualLines = normalizeList(manualUntimedLevels);

    const sessionIndices = [];
    for (let i = 1; i < sortedCandles.length; i++) {
      if (getCandleSessionDateKey(sortedCandles[i].time) === targetSession) {
        sessionIndices.push(i);
      }
    }

    const allNewRecords = [];
    for (let s = 0; s < sessionIndices.length; s++) {
      const cIdx = sessionIndices[s];
      const bar = sortedCandles[cIdx];
      const barCloseMs = (bar.time + 300) * 1000;
      if (onProgress) onProgress(s + 1, sessionIndices.length);

      let activeLines = manualLines;
      if (sortedBriefingGroups.length > 0) {
        let latestGroup = null;
        for (const grp of sortedBriefingGroups) {
          if (grp.tsMs <= barCloseMs) {
            latestGroup = grp;
          }
        }
        if (latestGroup) {
          activeLines = [...latestGroup.lines, ...manualLines];
        } else if (manualLines.length === 0) {
          continue;
        }
      }

      if (!activeLines || activeLines.length === 0) continue;

      const recs = await checkAndTriggerLevelCloseAi(sortedCandles, activeLines, chartInstance || null, {
        closedCandleIndex: cIdx
      });
      if (recs && recs.length > 0) {
        allNewRecords.push(...recs);
      }
    }

    evaluatePendingOutcomes(sortedCandles);
    notifyListeners();
    return allNewRecords;
  }

  /**
   * Fetches clean 5M NIFTY candles for today's active trading session (or latest available trading day)
   * from /api/marketCandles, falling back to window.niftyCandlesData if offline.
   */
  async function fetchSession5mCandles() {
    const isLocalFile = typeof window !== 'undefined' && (window.location.protocol === 'file:');
    const apiBase = isLocalFile ? 'https://trading-journal-sandy-three.vercel.app' : '';
    const todayIst = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

    try {
      const r = await fetch(`${apiBase}/api/marketCandles?symbol=NIFTY&date=${encodeURIComponent(todayIst)}&_t=${Date.now()}`, { cache: 'no-store' });
      if (r.ok) {
        const d = await r.json();
        if (d && Array.isArray(d.candles) && d.candles.length >= 2) {
          return d.candles;
        }
      }
    } catch (e) {}

    // Fallback to latest 5M series from marketCandles (e.g., if today is a holiday / pre-market)
    try {
      const r = await fetch(`${apiBase}/api/marketCandles?symbol=NIFTY&range=1mo&_t=${Date.now()}`, { cache: 'no-store' });
      if (r.ok) {
        const d = await r.json();
        if (d && Array.isArray(d.candles) && d.candles.length >= 2) {
          // Filter to 5M spacing if Upstox 1M bars were appended
          const out = [];
          for (const c of d.candles) {
            if (c.time % 300 === 0) out.push(c);
          }
          return out.length >= 2 ? out : d.candles;
        }
      }
    } catch (e) {}

    if (root.niftyCandlesData && Array.isArray(root.niftyCandlesData.timeframe5m) && root.niftyCandlesData.timeframe5m.length >= 2) {
      return root.niftyCandlesData.timeframe5m;
    }
    return [];
  }

  root.NiftyAiDecisions = {
    getCooldownMinutes,
    getMinRiskReward,
    loadDecisionsLog,
    saveDecisionsLog,
    clearDecisionsLog,
    evaluatePendingOutcomes,
    checkAndTriggerLevelCloseAi,
    scanSessionCandlesForLevels,
    fetchSession5mCandles,
    formatCandleTimeIST
  };

})(typeof window !== 'undefined' ? window : this);

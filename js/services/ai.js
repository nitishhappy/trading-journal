import { state } from '../state.js';
import { db } from '../firebase-init.js';
import { showToast } from '../utils/toast.js';
import { getLocalDateKey, getDateKey } from '../utils/date.js';

export const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
export const GROQ_MODEL = "llama-3.3-70b-versatile"; // best free model on Groq for analysis

export const COACH_SYSTEM_INSTRUCTION = `You are my personal trading knowledge architect.

Your job is NOT to evaluate me as a trader.
Your job is to maintain my evolving trading intelligence system.

I am building a personal trading playbook over months and years.

When I provide new observations:

1. Study my previous trading knowledge.
2. Study the new observations.
3. Identify what is genuinely new.
4. Remove only exact repetition, NOT useful details.
5. Expand concepts where my understanding has improved.
6. Preserve examples, market situations, and reasoning.
7. Maintain the history and evolution of my thinking.

IMPORTANT:
Do not create a short summary.
Do not compress important learning into one sentence.
The output should be detailed enough that I can revise it before trading.

Write from my perspective ("I understand...", "I have learned...").

Structure the output:

# 1. New Learning Added
For every new discovery:
- Explain the observation
- Explain why it matters
- Explain the market psychology behind it
- Explain how I should use this knowledge

# 2. Existing Knowledge Updated
Show:
- Previous belief
- New understanding
- How my thinking has evolved

# 3. Trading Principles Library

Maintain detailed sections:

## Market Structure Understanding
(Keep detailed explanations)

## Liquidity and Price Behaviour
(Keep examples and reasoning)

## Setup Recognition
(Entry conditions, confirmation, failures)

## Trade Management Rules
(Stop loss, exits, position sizing)

## Psychology and Execution
(Emotional patterns and solutions)

## Mistakes I Must Avoid

# 4. Contradictions Found
If my new observation conflicts with old beliefs:
- Explain the conflict
- Suggest the refined understanding

# 5. My Current Trading Philosophy
Write a detailed evolving version, not a short summary.

The goal is not fewer words.
The goal is fewer repeated ideas with maximum retained knowledge.`;

export let coachUnsubscribe = null;

// ---- API key storage in Firestore ----
export async function loadGeminiKey() {
  if (state.cachedGeminiKey) return state.cachedGeminiKey;
  try {
    const doc = await db.collection("users").doc(state.currentUser.uid)
      .collection("settings").doc("apiKeys").get();
    if (doc.exists && doc.data().geminiKey) {
      state.cachedGeminiKey = doc.data().geminiKey;
      return state.cachedGeminiKey;
    }
  } catch (e) { console.error("loadGeminiKey", e); }
  return null;
}

export async function saveGeminiKey(key) {
  await db.collection("users").doc(state.currentUser.uid)
    .collection("settings").doc("apiKeys")
    .set({ geminiKey: key }, { merge: true });
  state.cachedGeminiKey = key;
}

export async function loadGoogleApiKey() {
  if (state.cachedGoogleApiKey) return state.cachedGoogleApiKey;
  try {
    const doc = await db.collection("users").doc(state.currentUser.uid)
      .collection("settings").doc("apiKeys").get();
    if (doc.exists && doc.data().googleApiKey) {
      state.cachedGoogleApiKey = doc.data().googleApiKey;
      return state.cachedGoogleApiKey;
    }
  } catch (e) { console.error("loadGoogleApiKey", e); }
  return null;
}

export async function saveGoogleApiKey(key) {
  await db.collection("users").doc(state.currentUser.uid)
    .collection("settings").doc("apiKeys")
    .set({ googleApiKey: key }, { merge: true });
  state.cachedGoogleApiKey = key;
}

// Utility function to get created time from observation
function getCreatedTime(o) {
  if (!o.createdAt) return 0;
  return o.createdAt.toDate ? o.createdAt.toDate().getTime() : new Date(o.createdAt).getTime();
}

// ---- Core: build journal text → call Gemini → save to Firestore ----
export async function generateCoachSummaryClient(apiKey, periodType) {
  const now = new Date();
  const endDate = new Date(now);
  const startDate = new Date(now);
  if (periodType === "weekly") {
    startDate.setDate(startDate.getDate() - 7);
  } else {
    startDate.setMonth(startDate.getMonth() - 1);
  }

  // Filter observations in range, non-archived, with text content
  const inRange = state.observations.filter((o) => {
    if (o.archived) return false;
    const hasAnyLink = (o.links && o.links.length > 0) || !!o.link;
    if (!o.text && !hasAnyLink) return false;
    const ts = o.createdAt && o.createdAt.toDate ? o.createdAt.toDate() : null;
    if (!ts) return false;
    return ts >= startDate && ts <= endDate;
  });

  // Sort oldest first for the AI to read chronologically
  inRange.sort((a, b) => getCreatedTime(a) - getCreatedTime(b));

  if (inRange.length === 0) {
    return { skipped: true, reason: `No observations in the past ${periodType === "weekly" ? "7 days" : "30 days"}` };
  }

  const lines = inRange.map((o) => {
    const date = getDateKey(o.createdAt);
    const folder = o.folder || "Uncategorized";
    const priority = o.priority || "medium";
    const tags = (o.tags || []).join(", ");
    let entry = `[${date}] (${folder}, priority: ${priority}${tags ? ", tags: " + tags : ""})\n${o.text || ""}`;
    const obsLinks = (o.links && o.links.length > 0) ? o.links : (o.link ? [o.link] : []);
    if (obsLinks.length > 0) entry += `\nLink${obsLinks.length > 1 ? "s" : ""}: ${obsLinks.join(", ")}`;
    return entry;
  });

  const periodLabel = periodType === "weekly" ? "past 7 days" : "past 30 days";

  // Feed in prior summary as context
  const priorSummary = state.aiSummaries
    .filter((s) => s.type === periodType)
    .sort((a, b) => getCreatedTime(b) - getCreatedTime(a))[0];

  let prompt = "";
  if (priorSummary && priorSummary.content) {
    prompt += `Here is my existing trading knowledge document from the previous ${periodType === "weekly" ? "week" : "month"}:\n\n${priorSummary.content}\n\n---\n\n`;
  } else {
    prompt += `This is my first entry — I don't have an existing knowledge document yet, so build the initial version.\n\n---\n\n`;
  }
  prompt += `Here are my new trading journal entries from the ${periodLabel} (${startDate.toISOString().slice(0,10)} to ${endDate.toISOString().slice(0,10)}, ${lines.length} entries):\n\n${lines.join("\n---\n")}`;

  const body = {
    model: GROQ_MODEL,
    messages: [
      { role: "system", content: COACH_SYSTEM_INSTRUCTION },
      { role: "user", content: prompt }
    ],
    temperature: 0.7,
    max_tokens: 6000,
  };

  const resp = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const errBody = await resp.json().catch(() => ({}));
    const msg = errBody.error && errBody.error.message ? errBody.error.message : `HTTP ${resp.status}`;
    throw new Error(msg);
  }

  const responseData = await resp.json();
  const summaryText = responseData.choices?.[0]?.message?.content;
  if (!summaryText) throw new Error("Empty response from Groq");

  // Save to Firestore
  await db.collection("users").doc(state.currentUser.uid).collection("aiSummaries").add({
    type: periodType,
    content: summaryText,
    entryCount: lines.length,
    periodStart: firebase.firestore.Timestamp.fromDate(startDate),
    periodEnd: firebase.firestore.Timestamp.fromDate(endDate),
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  });

  return { skipped: false, entryCount: lines.length };
}

// ---- Subscribe to saved summaries (real-time) ----
export function subscribeAiSummaries() {
  if (coachUnsubscribe) coachUnsubscribe();
  if (!state.currentUser) return;
  const ref = db.collection("users").doc(state.currentUser.uid).collection("aiSummaries")
    .orderBy("createdAt", "desc").limit(20);
  coachUnsubscribe = ref.onSnapshot((snap) => {
    state.aiSummaries = [];
    snap.forEach((doc) => state.aiSummaries.push({ id: doc.id, ...doc.data() }));
    
    // Dispatch custom event to notify Coach UI
    window.dispatchEvent(new CustomEvent('ai-summaries-updated'));
  }, (err) => console.error("aiSummaries subscription error:", err));
}

export function unsubscribeAiSummaries() {
  if (coachUnsubscribe) {
    coachUnsubscribe();
    coachUnsubscribe = null;
  }
}

// Bind load/save functions to window for compatibility if settings page calls them directly
window.loadGeminiKey = loadGeminiKey;
window.saveGeminiKey = saveGeminiKey;
window.loadGoogleApiKey = loadGoogleApiKey;
window.saveGoogleApiKey = saveGoogleApiKey;

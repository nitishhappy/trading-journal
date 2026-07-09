const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const { GoogleGenAI } = require("@google/genai");

admin.initializeApp();

// API key stored as a Firebase secret — set it with:
//   firebase functions:secrets:set GEMINI_API_KEY
// Then paste your AQ.xxx key when prompted.
const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");

const SYSTEM_INSTRUCTION = `You are a professional trading psychologist and performance coach reviewing a trader's daily journal observations.

Your job is to find repeated behavioural patterns and identify WHY the trader is making mistakes — not to describe individual trades.

Structure your response in clear markdown with these sections (omit a section only if there is truly nothing relevant):

## Knowledge Issues
Gaps in market understanding, technical analysis, or strategy knowledge that show up repeatedly.

## Execution Issues
Problems in how trades are entered, managed, or exited — hesitation, impulsiveness, poor timing, deviation from plan.

## New Learnings
Genuine insights, breakthroughs, or positive adjustments the trader has identified.

## Discipline
Patterns related to rule-following, emotional control, FOMO, revenge trading, overtrading, patience.

## Stage-wise Patterns
Break down patterns by trading stage where evident: Pre-market preparation, Analysis/setup identification, Execution (entry), Trade management (stops/targets/holding).

Be specific, reference recurring themes across multiple observations rather than one-off events, and be direct about root causes. Keep the tone constructive but honest — like a coach who wants the trader to improve, not one who simply validates.`;

// ---- Shared helper: fetch observations and call Gemini ----
async function generateSummaryForUser(uid, periodType, startDate, endDate, apiKey) {
  const db = admin.firestore();

  // Fetch observations in date range — archived ones excluded
  const snapshot = await db
    .collection("users").doc(uid)
    .collection("observations")
    .where("createdAt", ">=", admin.firestore.Timestamp.fromDate(startDate))
    .where("createdAt", "<=", admin.firestore.Timestamp.fromDate(endDate))
    .orderBy("createdAt", "asc")
    .get();

  if (snapshot.empty) {
    return { skipped: true, reason: "No observations in this period" };
  }

  // Build journal text — include date, folder, priority, tags, and text for context.
  // Skip archived and image-only entries (no text content to analyse).
  const lines = [];
  snapshot.forEach((doc) => {
    const o = doc.data();
    if (o.archived) return;
    if (!o.text && !o.link) return;
    const date = o.createdAt && o.createdAt.toDate
      ? o.createdAt.toDate().toISOString().slice(0, 10)
      : "unknown";
    const folder = o.folder || "Uncategorized";
    const priority = o.priority || "medium";
    const tags = (o.tags || []).join(", ");
    let entry = `[${date}] (${folder}, priority: ${priority}${tags ? ", tags: " + tags : ""})\n${o.text || ""}`;
    if (o.link) entry += `\nLink referenced: ${o.link}`;
    lines.push(entry);
  });

  if (lines.length === 0) {
    return { skipped: true, reason: "No text content to analyze in this period" };
  }

  const journalText = lines.join("\n---\n");

  // Call Gemini using the new @google/genai SDK (supports AQ. auth keys)
  const ai = new GoogleGenAI({ apiKey });
  const periodLabel = periodType === "weekly" ? "past week" : "past month";
  const prompt = `Analyze these trading journal observations from the ${periodLabel} (${lines.length} entries, ${startDate.toISOString().slice(0, 10)} to ${endDate.toISOString().slice(0, 10)}) and provide a deep psychological performance review:\n\n${journalText}`;

  const response = await ai.models.generateContent({
    model: "gemini-1.5-flash",   // free tier; swap to gemini-2.5-flash if desired
    contents: prompt,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
    },
  });

  const summary = response.text;

  // Save to Firestore under the user's aiSummaries subcollection
  const docRef = await db.collection("users").doc(uid).collection("aiSummaries").add({
    type: periodType,       // "weekly" | "monthly"
    content: summary,
    entryCount: lines.length,
    periodStart: admin.firestore.Timestamp.fromDate(startDate),
    periodEnd: admin.firestore.Timestamp.fromDate(endDate),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { skipped: false, id: docRef.id, entryCount: lines.length };
}

function getWeekRange(now) {
  const end = new Date(now);
  const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  return { start, end };
}

function getMonthRange(now) {
  const end = new Date(now);
  const start = new Date(now);
  start.setMonth(start.getMonth() - 1);
  return { start, end };
}

// ===================== Scheduled: Weekly (every Sunday 23:59 UTC) =====================
exports.weeklyAiCoachSummary = onSchedule(
  { schedule: "59 23 * * 0", timeZone: "UTC", secrets: [GEMINI_API_KEY] },
  async () => {
    const db = admin.firestore();
    const apiKey = GEMINI_API_KEY.value();
    const now = new Date();
    const { start, end } = getWeekRange(now);
    const usersSnap = await db.collection("users").get();
    for (const userDoc of usersSnap.docs) {
      try {
        const result = await generateSummaryForUser(userDoc.id, "weekly", start, end, apiKey);
        console.log(`Weekly summary for ${userDoc.id}:`, result);
      } catch (err) {
        console.error(`Weekly summary failed for ${userDoc.id}:`, err.message);
      }
    }
  }
);

// ===================== Scheduled: Monthly (1st of each month 23:59 UTC) =====================
exports.monthlyAiCoachSummary = onSchedule(
  { schedule: "59 23 1 * *", timeZone: "UTC", secrets: [GEMINI_API_KEY] },
  async () => {
    const db = admin.firestore();
    const apiKey = GEMINI_API_KEY.value();
    const now = new Date();
    const { start, end } = getMonthRange(now);
    const usersSnap = await db.collection("users").get();
    for (const userDoc of usersSnap.docs) {
      try {
        const result = await generateSummaryForUser(userDoc.id, "monthly", start, end, apiKey);
        console.log(`Monthly summary for ${userDoc.id}:`, result);
      } catch (err) {
        console.error(`Monthly summary failed for ${userDoc.id}:`, err.message);
      }
    }
  }
);

// ===================== Callable: Manual "Generate now" from the app =====================
exports.generateAiCoachSummary = onCall(
  { secrets: [GEMINI_API_KEY] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "You must be signed in.");
    }
    const periodType = request.data && request.data.periodType;
    if (periodType !== "weekly" && periodType !== "monthly") {
      throw new HttpsError("invalid-argument", "periodType must be 'weekly' or 'monthly'.");
    }
    const uid = request.auth.uid;
    const apiKey = GEMINI_API_KEY.value();
    const now = new Date();
    const { start, end } = periodType === "weekly" ? getWeekRange(now) : getMonthRange(now);
    try {
      return await generateSummaryForUser(uid, periodType, start, end, apiKey);
    } catch (err) {
      console.error("generateAiCoachSummary error:", err.message);
      throw new HttpsError("internal", "Failed to generate summary: " + err.message);
    }
  }
);

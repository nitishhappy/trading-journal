import https from "https";

const DEFAULT_GEMINI_KEY = process.env.GEMINI_API_KEY || "";
const CANDIDATE_MODELS = [
  "gemini-3-flash-preview",
  "gemini-3.6-flash",
  "gemini-3.5-flash"
];

function httpsPostJson(urlStr, payloadObj, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const body = JSON.stringify(payloadObj);
    const req = https.request(
      {
        hostname: u.hostname,
        path: u.pathname + u.search,
        method: "POST",
        rejectUnauthorized: false,
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
          "User-Agent": "TradingJournal-NiftyCopilot/2.0"
        },
        timeout: timeoutMs
      },
      (resp) => {
        let raw = "";
        resp.on("data", (chunk) => { raw += chunk; });
        resp.on("end", () => {
          if (resp.statusCode >= 200 && resp.statusCode < 300) {
            try {
              resolve(JSON.parse(raw));
            } catch (err) {
              reject(new Error(`Invalid JSON from upstream: ${raw.slice(0, 120)}`));
            }
          } else {
            reject(new Error(`HTTP ${resp.statusCode}: ${raw.slice(0, 200)}`));
          }
        });
      }
    );
    req.on("error", (err) => reject(err));
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Request timeout"));
    });
    req.write(body);
    req.end();
  });
}

function evaluateDeterministicSmcFallback(telemetry) {
  const lvl = telemetry?.level || {};
  const c = telemetry?.candle || {};
  const ctx = telemetry?.marketContext || {};

  const tradeType = (lvl.tradeType || (lvl.bias === "bearish" ? "SELL" : "BUY")).toUpperCase();
  const bodyPct = Number(c.bodyPct || 50);
  const upperWickPct = Number(c.upperWickPct || 0);
  const lowerWickPct = Number(c.lowerWickPct || 0);
  const distFromLevel = Math.abs(Number(c.close || 0) - Number(lvl.price || 0));
  const rrRatio = Number(lvl.rrRatio || 1.5);

  let score = 60;
  const reasons = [];

  if (tradeType === "BUY") {
    if (c.close >= c.open && bodyPct >= 45) {
      score += 15;
      reasons.push(`Bullish 5M displacement close above ${lvl.tag || "Buy Level"} (${lvl.price}) with ${bodyPct.toFixed(0)}% body.`);
    } else if (lowerWickPct >= 40) {
      score += 12;
      reasons.push(`Strong lower-wick demand absorption (${lowerWickPct.toFixed(0)}% lower wick) reclaiming ${lvl.price}.`);
    } else {
      score -= 15;
      reasons.push(`Weak/indecisive candle body (${bodyPct.toFixed(0)}%) on close above ${lvl.price}.`);
    }

    if (upperWickPct >= 45) {
      score -= 20;
      reasons.push(`Heavy upper-wick supply rejection (${upperWickPct.toFixed(0)}%) warns of bull trap.`);
    }

    if (ctx.ema9 && c.close >= ctx.ema9) {
      score += 10;
      reasons.push(`Close (${c.close}) is supported above 9 EMA (${ctx.ema9}).`);
    }
  } else {
    if (c.close <= c.open && bodyPct >= 45) {
      score += 15;
      reasons.push(`Bearish 5M displacement close below ${lvl.tag || "Sell Level"} (${lvl.price}) with ${bodyPct.toFixed(0)}% body.`);
    } else if (upperWickPct >= 40) {
      score += 12;
      reasons.push(`Strong upper-wick supply rejection (${upperWickPct.toFixed(0)}% upper wick) below ${lvl.price}.`);
    } else {
      score -= 15;
      reasons.push(`Weak/indecisive candle body (${bodyPct.toFixed(0)}%) on close below ${lvl.price}.`);
    }

    if (lowerWickPct >= 45) {
      score -= 20;
      reasons.push(`Long lower-wick absorption (${lowerWickPct.toFixed(0)}%) warns of bear trap.`);
    }

    if (ctx.ema9 && c.close <= ctx.ema9) {
      score += 10;
      reasons.push(`Close (${c.close}) holds below 9 EMA (${ctx.ema9}).`);
    }
  }

  if (distFromLevel > 35) {
    score -= 25;
    reasons.push(`Close is extended ${distFromLevel.toFixed(1)} pts beyond level (${lvl.price}); high chase risk.`);
  }

  if (rrRatio >= 2.0) {
    score += 5;
    reasons.push(`Favorable planned R:R of 1:${rrRatio.toFixed(1)} to TP1 (${lvl.tp1 || lvl.tpRaw}).`);
  }

  const decision = score >= 65 ? "YES" : "NO";
  return {
    decision,
    tradeType,
    confidence: Math.max(25, Math.min(95, score)),
    logic: reasons.join(" "),
    wickObservation: `Body: ${bodyPct.toFixed(1)}%, Upper Wick: ${upperWickPct.toFixed(1)}%, Lower Wick: ${lowerWickPct.toFixed(1)}%`,
    momentumState: score >= 65 ? "CONFIRMATION" : "WEAK_REACTION",
    entryQuality: distFromLevel > 35 ? "CHASED" : "VALID"
  };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const t0 = Date.now();
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const { screenshotBase64, telemetry = {}, apiKey } = body;

    const lvl = telemetry.level || {};
    const c = telemetry.candle || {};
    const ctx = telemetry.marketContext || {};

    const tradeType = (lvl.tradeType || (lvl.bias === "bearish" ? "SELL" : "BUY")).toUpperCase();
    const geminiKey = (apiKey && apiKey.trim()) ? apiKey.trim() : DEFAULT_GEMINI_KEY;

    const prompt = `You are an elite Institutional NIFTY 50 Intraday SMC (Smart Money Concepts) & Price Action Co-Pilot.
A 5-minute NIFTY candle has just CLOSED ${tradeType === "BUY" ? "ABOVE a mapped BUY level" : "BELOW a mapped SELL level"}.
Inspect the attached live 5-minute NIFTY chart screenshot and the telemetry below to decide if this trade should be taken ("YES" or "NO").

=== 1. TRIGGERED LEVEL TELEMETRY ===
- Setup Tag: ${lvl.tag || "LEVEL"} (${tradeType} Setup)
- Trigger Event: ${lvl.triggerType === "RETOUCH_30M" ? `Re-touch & Directional Close after ${lvl.cooldownMins || 30}+ mins cooldown` : "First 5M Candle Cross & Close beyond level"}
- Key Level Price: ₹${lvl.price}
- Planned Primary Target (TP1): ₹${lvl.tp1 || lvl.tpRaw || "Open"} (Full TP String: ${lvl.tpRaw || "N/A"})
- Planned Stop Loss (SL): ₹${lvl.sl || "Manual"}
- Planned Risk:Reward (to TP1): 1:${lvl.rrRatio || "N/A"}
- Original AI Briefing Behavioral Thesis & Confirmation Rule:
  "${lvl.behavior || "Confirm directional acceptance beyond level"}"

=== 2. 5-MINUTE TRIGGER CANDLE ANATOMY ===
- Candle Close Time (IST): ${c.timeIST || "Latest 5M Close"}
- OHLC: Open ₹${c.open} | High ₹${c.high} | Low ₹${c.low} | Close ₹${c.close}
- Total Candle Range: ${c.rangePts} pts
- Distance of Close from Level: ${c.distanceFromLevel} pts
- Body %: ${c.bodyPct}% | Upper Wick %: ${c.upperWickPct}% | Lower Wick %: ${c.lowerWickPct}%
- Candle Archetype: ${c.archetype || "Standard"}

=== 3. INTRADAY MARKET STRUCTURE & TELEMETRY ===
- 9 EMA (5M): ${ctx.ema9 ? `₹${ctx.ema9} (${ctx.closeVsEma9})` : "N/A"}
- 15M Opening Range (ORB): High ₹${ctx.orbHigh || "N/A"} | Low ₹${ctx.orbLow || "N/A"}
- Intraday Session Range: Day High ₹${ctx.dayHigh || "N/A"} | Day Low ₹${ctx.dayLow || "N/A"}
- Recent 5M Sequence (Last 6 closed bars): ${ctx.recent5mSummary || "N/A"}

=== CRITICAL DECISION RULES ===
1. CROSSING + CLOSE IS THE TRIGGER, NOT AN AUTOMATIC "YES":
   Evaluate whether the closing candle and surrounding 5M chart structure genuinely confirm the ${tradeType} thesis.
2. WICK & REJECTION CHECK:
   - For a BUY setup: If the candle has a massive upper rejection wick (>45%) or closed right into an overhead resistance / 9 EMA cap, return "NO". If it shows strong bullish body displacement or lower-wick demand absorption closing cleanly above the level, favor "YES".
   - For a SELL setup: If the candle has a massive lower absorption wick (>45%) or closed right into support, return "NO". If it shows strong bearish body displacement or upper-wick supply rejection closing cleanly below the level, favor "YES".
3. ANTI-CHASE CHECK:
   If the 5M candle exploded too far beyond the level (e.g. >35-40 pts away from ₹${lvl.price}, eating up most of the distance to TP1 ₹${lvl.tp1}), return "NO" due to poor effective R:R / chased entry.
4. Respond in strict JSON with these exact keys:
{
  "decision": "YES", // Strictly "YES" or "NO"
  "tradeType": "${tradeType}", // Strictly "BUY" or "SELL"
  "confidence": 82, // Integer 0-100
  "logic": "2-3 concise, high-signal sentences explaining WHY the trade should or should not be taken based on the 5M close anatomy, wicks, 9 EMA/structure, and R:R to TP1.",
  "wickObservation": "Short note on body vs wick behavior at the level.",
  "momentumState": "CONFIRMATION", // One of: "CONFIRMATION" | "ABSORPTION" | "BREAKOUT" | "CHASED" | "TRAP_WARNING" | "CHOP"
  "entryQuality": "VALID" // One of: "VALID" | "CHASED" | "WEAK_CLOSE" | "INVALID"
}`;

    let cleanB64 = "";
    let mimeType = "image/jpeg";
    if (screenshotBase64 && typeof screenshotBase64 === "string") {
      const m = screenshotBase64.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
      if (m) {
        mimeType = m[1];
        cleanB64 = m[2];
      } else {
        cleanB64 = screenshotBase64;
      }
    }

    const parts = [{ text: prompt }];
    if (cleanB64 && cleanB64.length > 100) {
      parts.push({
        inline_data: {
          mime_type: mimeType,
          data: cleanB64
        }
      });
    }

    const payload = {
      contents: [{ parts }],
      generationConfig: {
        temperature: 0.15,
        response_mime_type: "application/json"
      }
    };

    let lastError = null;
    for (const model of CANDIDATE_MODELS) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(geminiKey)}`;
      try {
        const respData = await httpsPostJson(url, payload, 15000);
        const text = respData?.candidates?.[0]?.content?.parts?.[0]?.text || "";
        if (text) {
          const cleaned = text.replace(/^```json\s*|\s*```$/gm, "").trim();
          const parsed = JSON.parse(cleaned);
          const normDecision = String(parsed.decision || "").toUpperCase().includes("YES") ? "YES" : "NO";
          const normType = String(parsed.tradeType || tradeType).toUpperCase().includes("SELL") ? "SELL" : "BUY";
          return res.status(200).json({
            success: true,
            decision: normDecision,
            tradeType: normType,
            confidence: Number(parsed.confidence || 75),
            logic: String(parsed.logic || parsed.visual_rationale || "Evaluated 5M close & chart structure."),
            wickObservation: String(parsed.wickObservation || ""),
            momentumState: String(parsed.momentumState || "CONFIRMATION"),
            entryQuality: String(parsed.entryQuality || "VALID"),
            model,
            latencyMs: Date.now() - t0
          });
        }
      } catch (err) {
        lastError = err.message;
      }
    }

    // Fallback to deterministic SMC evaluation if Gemini API is unreachable
    const fallback = evaluateDeterministicSmcFallback(telemetry);
    return res.status(200).json({
      success: true,
      ...fallback,
      model: "smc-telemetry-fallback",
      fallbackReason: lastError || "LLM unavailable",
      latencyMs: Date.now() - t0
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message || "Internal server error"
    });
  }
}

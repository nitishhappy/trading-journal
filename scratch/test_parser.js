// Inline the parser functions for testing
const NON_SYMBOL_WORDS = new Set([
  'BUY', 'SELL', 'CLOSE', 'EXIT', 'ALERT', 'SIGNAL', 'EQUAL', 'FAIR',
  'NEW', 'BREAK', 'HIGH', 'LOW', 'H/L', 'LESS', 'THAN', 'MORE', 'ABOVE', 'BELOW'
]);

function isIsoDateLike(str) {
  return /^\d{4}-\d{2}/.test(str);
}

function cleanSymbol(sym) {
  if (!sym) return "";
  const cleaned = String(sym).replace(/[\(\),:]/g, " ").trim().split(/\s+/)[0].toUpperCase();
  return NON_SYMBOL_WORDS.has(cleaned) ? "GENERAL" : cleaned;
}

function parsePlainTextAlert(text) {
  let parsed = {};
  try {
    if (text.trim().startsWith('{')) {
      const j = JSON.parse(text);
      if (!j.keyword && j.signal) j.keyword = j.signal;
      if (j.keyword) j.keyword = j.keyword.replace(/:$/, "").trim();
      if (j.symbol) j.symbol = cleanSymbol(j.symbol);
      return j;
    }
  } catch(e) {}

  const rawTrimmed = text.trim();
  const parts = rawTrimmed.split(/\s+/);

  if (parts.length > 0) {
    parsed.keyword = parts[0].replace(/[:,]+$/, "").trim();
  }

  // 0. TradingView native crossing alert
  const tvNativeMatch = rawTrimmed.match(
    /^([A-Z0-9]+),\s*(\d+)\s+(.+?)\s+(?:price\s+)?(\d+(?:\.\d+)?)\s+in\s+\d{4}-/i
  );
  if (tvNativeMatch) {
    parsed.symbol    = cleanSymbol(tvNativeMatch[1]);
    parsed.timeframe = tvNativeMatch[2].toUpperCase();
    parsed.interval  = parsed.timeframe;
    parsed.price     = parseFloat(tvNativeMatch[4]);
    parsed.keyword   = tvNativeMatch[3].replace(/\s+/g, '_').toLowerCase();
  }

  // 1. "for SYMBOL in TF at PRICE"
  if (!parsed.symbol) {
    const templateMatch = rawTrimmed.match(/for\s+([A-Z0-9_:-]+)(?:\s+in\s+([A-Z0-9]+))?(?:\s+at\s+([0-9.]+))?/i);
    if (templateMatch) {
      parsed.symbol = cleanSymbol(templateMatch[1]);
      if (templateMatch[2]) { parsed.timeframe = templateMatch[2].toUpperCase(); parsed.interval = parsed.timeframe; }
      if (templateMatch[3]) { parsed.price = parseFloat(templateMatch[3]); }
    }
  }

  // 2. Fallback symbol
  if (!parsed.symbol) {
    const symMatch = rawTrimmed.match(/(?:on|at|for|in|symbol:?)\s+([A-Z0-9_:-]+)/i) ||
                     rawTrimmed.match(/\b([A-Z0-9_]+:[A-Z0-9_]+)\b/i) ||
                     rawTrimmed.match(/\b([A-Z]{3,8}(?:USD|USDT|INR|EUR|GBP)?)\b/i);
    if (symMatch && symMatch[1] && !NON_SYMBOL_WORDS.has(symMatch[1].toUpperCase()) && !isIsoDateLike(symMatch[1])) {
      parsed.symbol = cleanSymbol(symMatch[1]);
    } else if (parts.length > 1 && !NON_SYMBOL_WORDS.has(parts[1].toUpperCase())) {
      parsed.symbol = cleanSymbol(parts[1]);
    }
  }

  // 2b. Keyword-as-symbol fallback
  if (!parsed.symbol || parsed.symbol === 'GENERAL') {
    const kwClean = (parsed.keyword || '').replace(/[:,]+$/, '').toUpperCase();
    if (kwClean.length >= 3 && /^[A-Z0-9]+$/.test(kwClean) && !NON_SYMBOL_WORDS.has(kwClean)) {
      parsed.symbol = kwClean;
    }
  }

  if (!parsed.symbol || NON_SYMBOL_WORDS.has(parsed.symbol)) {
    parsed.symbol = "GENERAL";
  }

  return parsed;
}

// ─── Tests ───
const tests = [
  'XAUUSD, 5 Crossing Up price 4091.250 in 2026-07-30T13:35:00Z TF',
  'XAUUSD, 5 Crossing Up price 4081.670 in 2026-07-30T12:05:00Z TF',
  'XAUUSD, 5 Crossing Up price 4078.955 in 2026-07-30T11:00:00Z TF',
  'cemented_candle: SELL signal for XAUUSD in 15 at 4044.770',
  'price_below_ema9 XAUUSD 1H 65432',
  'vix_fix_less_than_tolerance for XAUUSD in 9 at 4043.1',
];

console.log('Parser test results:\n');
tests.forEach(t => {
  const r = parsePlainTextAlert(t);
  const sym = r.symbol === 'XAUUSD' ? '✅' : '❌';
  console.log(`${sym} symbol: ${r.symbol.padEnd(15)} | tf: ${String(r.timeframe||'—').padEnd(4)} | price: ${String(r.price||'—').padEnd(12)} | kw: ${r.keyword}`);
  console.log(`   raw: ${t}\n`);
});

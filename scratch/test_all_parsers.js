const fs = require('fs');
global.window = global;

// --- 1. TEST GOLD ---
console.log('=================== GOLD PARSER TEST ===================');
const goldContent = fs.readFileSync('js/data/gold_daily_plan.js', 'utf8');
eval(goldContent);

function parseGoldLevelsFromMarkdown(text, timestamp, timeDisplay) {
    if (!text) return [];
    const levels = [];
    const seen = new Set();

    // 1. Key Trading Levels Summary (if present)
    const keyMatch = text.match(/###\s*Key\s*Trading\s*Levels\s*Summary[\s\S]*?(?=\n\s*(?:###|---|==|```)|$)/i);
    if (keyMatch) {
        const lines = keyMatch[0].split('\n');
        for (const line of lines) {
            if (!line.includes('|') || line.includes(':---') || line.includes('Logic / Significance')) continue;
            const cols = line.split('|').map(c => c.trim()).filter(Boolean);
            if (cols.length >= 6) {
                const rawPrice = cols[0].replace(/[^0-9.]/g, '');
                const tagMatch = cols[2].match(/\[(G_K?[BS]\d+|K?[BS]\d+)\]/i) || cols[3].match(/\[(G_K?[BS]\d+|K?[BS]\d+)\]/i);
                const tag = tagMatch ? '[' + tagMatch[1].toUpperCase() + ']' : '';
                const isBullish = cols[0].includes('🟢') || cols[1].toLowerCase().includes('support') || /\[(G_KB\d+|KB\d+|G_B\d+|B\d+)\]/i.test(tag);
                const bias = isBullish ? 'bullish' : 'bearish';
                const key = tag || (rawPrice + '_' + bias);
                if (rawPrice && !seen.has(key)) {
                    seen.add(key);
                    levels.push({
                        source: 'AI',
                        timestamp: timestamp,
                        timeDisplay: timeDisplay,
                        price: rawPrice,
                        bias: bias,
                        behavior: (tag ? tag + ': ' : '') + (cols[3] || cols[1]),
                        tp: cols[4].replace(/[*_]/g, '').trim() || 'na',
                        sl: cols[5].replace(/[*_]/g, '').trim() || 'na',
                        status: 'na'
                    });
                }
            }
        }
    }

    // 2. Action Plan & Triggers table
    const actionMatch = text.match(/###\s*(?:\d+\.\s*)?5-Min\s*\/\s*15-Min\s*Action\s*Plan\s*&\s*Triggers[\s\S]*?(?=\n\s*(?:###|---|==|```)|$)/i);
    if (actionMatch) {
        const lines = actionMatch[0].split('\n');
        for (const line of lines) {
            if (!line.includes('|') || line.includes(':---') || line.includes('Confirmation Price Action')) continue;
            const cols = line.split('|').map(c => c.trim()).filter(Boolean);
            if (cols.length >= 6) {
                const tagMatch = cols[0].match(/\[(G_K?[BS]\d+|K?[BS]\d+)\]/i);
                const tag = tagMatch ? '[' + tagMatch[1].toUpperCase() + ']' : '';
                const rawPrice = cols[2].split(/[-–]/)[0].replace(/[^0-9.]/g, '');
                const isBullish = cols[1].includes('🟢') || cols[1].toLowerCase().includes('long') || /\[(G_KB\d+|KB\d+|G_B\d+|B\d+)\]/i.test(tag);
                const bias = isBullish ? 'bullish' : 'bearish';
                const key = tag || (rawPrice + '_' + bias);
                if (rawPrice && !seen.has(key)) {
                    seen.add(key);
                    const cleanTp = cols[4].replace(/<br\s*\/?>/gi, ' / ').replace(/[*_]/g, '').trim();
                    const cleanSl = cols[5].replace(/[*_]/g, '').trim();
                    levels.push({
                        source: 'AI',
                        timestamp: timestamp,
                        timeDisplay: timeDisplay,
                        price: rawPrice,
                        bias: bias,
                        behavior: (tag ? tag + ': ' : '') + cols[3],
                        tp: cleanTp || 'na',
                        sl: cleanSl || 'na',
                        status: 'na'
                    });
                }
            }
        }
    }

    return levels;
}

window.goldDailyPlanSummary.forEach((s, idx) => {
    const parsed = parseGoldLevelsFromMarkdown(s.text, s.timestamp, s.timeDisplay);
    console.log(`Gold Summary ${idx} (${s.timeDisplay}): ${parsed.length} levels`);
    parsed.forEach(p => console.log(`   ${p.behavior.substring(0, 15)} | price: ${p.price} | bias: ${p.bias} | TP: ${p.tp.substring(0, 25)} | SL: ${p.sl.substring(0, 25)}`));
});

// --- 2. TEST SP500 ---
console.log('\n=================== SP500 PARSER TEST ===================');
const sp500Content = fs.readFileSync('js/data/sp500_daily_plan.js', 'utf8');
eval(sp500Content);

function parseSp500LevelsFromMarkdown(text, timestamp, timeDisplay) {
    if (!text) return [];
    const levels = [];
    const seen = new Set();

    // 1. Key Trading Levels Summary
    const keyMatch = text.match(/###\s*Key\s*Trading\s*Levels\s*Summary[\s\S]*?(?=\n\s*(?:###|---|==|```)|$)/i);
    if (keyMatch) {
        const lines = keyMatch[0].split('\n');
        for (const line of lines) {
            if (!line.includes('|') || line.includes(':---') || line.includes('Logic / Significance')) continue;
            const cols = line.split('|').map(c => c.trim()).filter(Boolean);
            if (cols.length >= 6) {
                const rawPrice = cols[0].replace(/[^0-9.]/g, '');
                const tagMatch = cols[2].match(/\[(SP_K?[BS]\d+|K?[BS]\d+)\]/i) || cols[3].match(/\[(SP_K?[BS]\d+|K?[BS]\d+)\]/i);
                const tag = tagMatch ? '[' + tagMatch[1].toUpperCase() + ']' : '';
                const isBullish = cols[0].includes('🟢') || cols[1].toLowerCase().includes('support') || /\[(SP_KB\d+|KB\d+|SP_B\d+|B\d+)\]/i.test(tag);
                const bias = isBullish ? 'bullish' : 'bearish';
                const key = tag || (rawPrice + '_' + bias);
                if (rawPrice && !seen.has(key)) {
                    seen.add(key);
                    levels.push({
                        source: 'AI',
                        timestamp: timestamp,
                        timeDisplay: timeDisplay,
                        price: rawPrice,
                        bias: bias,
                        behavior: (tag ? tag + ': ' : '') + (cols[3] || cols[1]),
                        tp: cols[4].replace(/[*_]/g, '').trim() || 'na',
                        sl: cols[5].replace(/[*_]/g, '').trim() || 'na',
                        status: 'na'
                    });
                }
            }
        }
    }

    // 2. Action Plan & Triggers table
    const actionMatch = text.match(/###\s*(?:\d+\.\s*)?5-Min\s*\/\s*15-Min\s*Action\s*Plan\s*&\s*Triggers[\s\S]*?(?=\n\s*(?:###|---|==|```)|$)/i);
    if (actionMatch) {
        const lines = actionMatch[0].split('\n');
        for (const line of lines) {
            if (!line.includes('|') || line.includes(':---') || line.includes('Confirmation Price Action')) continue;
            const cols = line.split('|').map(c => c.trim()).filter(Boolean);
            if (cols.length >= 6) {
                const tagMatch = cols[0].match(/\[(SP_K?[BS]\d+|K?[BS]\d+)\]/i);
                const tag = tagMatch ? '[' + tagMatch[1].toUpperCase() + ']' : '';
                const rawPrice = cols[2].split(/[-–]/)[0].replace(/[^0-9.]/g, '');
                const isBullish = cols[1].includes('🟢') || cols[1].toLowerCase().includes('long') || /\[(SP_KB\d+|KB\d+|SP_B\d+|B\d+)\]/i.test(tag);
                const bias = isBullish ? 'bullish' : 'bearish';
                const key = tag || (rawPrice + '_' + bias);
                if (rawPrice && !seen.has(key)) {
                    seen.add(key);
                    const cleanTp = cols[4].replace(/<br\s*\/?>/gi, ' / ').replace(/[*_]/g, '').trim();
                    const cleanSl = cols[5].replace(/[*_]/g, '').trim();
                    levels.push({
                        source: 'AI',
                        timestamp: timestamp,
                        timeDisplay: timeDisplay,
                        price: rawPrice,
                        bias: bias,
                        behavior: (tag ? tag + ': ' : '') + cols[3],
                        tp: cleanTp || 'na',
                        sl: cleanSl || 'na',
                        status: 'na'
                    });
                }
            }
        }
    }

    return levels;
}

window.sp500DailyPlanSummary.forEach((s, idx) => {
    const parsed = parseSp500LevelsFromMarkdown(s.text, s.timestamp, s.timeDisplay);
    console.log(`SP500 Summary ${idx} (${s.timeDisplay}): ${parsed.length} levels`);
    parsed.forEach(p => console.log(`   ${p.behavior.substring(0, 15)} | price: ${p.price} | bias: ${p.bias} | TP: ${p.tp.substring(0, 25)} | SL: ${p.sl.substring(0, 25)}`));
});

// --- 3. TEST NIFTY ---
console.log('\n=================== NIFTY PARSER TEST ===================');
const niftyContent = fs.readFileSync('js/data/nifty_daily_plan.js', 'utf8');
eval(niftyContent);

function parseNiftyLevelsFromMarkdown(text, timestamp, timeDisplay) {
    if (!text) return [];
    const levels = [];
    const seen = new Set();

    // 1. Table format (if present)
    const actionMatch = text.match(/###\s*(?:\d+\.\s*)?5-Min\s*\/\s*15-Min\s*Action\s*Plan[\s\S]*?(?=\n\s*(?:###|---|==|```)|$)/i);
    const searchBlock = actionMatch ? actionMatch[0] : text;

    const lines = searchBlock.split('\n');
    for (const line of lines) {
        const tagMatch = line.match(/\[([BS]\d+)\]/i);
        if (!tagMatch) continue;
        const tag = '[' + tagMatch[1].toUpperCase() + ']';
        const isBullish = /\[(B\d+)\]/i.test(tag);
        const bias = isBullish ? 'bullish' : 'bearish';

        let rawPrice = '';
        let tp = 'na';
        let sl = 'na';
        let behavior = '';

        if (line.includes('|')) {
            const parts = line.split('|').map(p => p.trim());
            // If table row with 6+ cols:
            if (parts.length >= 6 && !parts.some(p => p.toLowerCase().includes('tp:'))) {
                rawPrice = parts[2].split(/[-–]/)[0].replace(/[^0-9.]/g, '');
                behavior = tag + ': ' + parts[3];
                tp = parts[4].replace(/<br\s*\/?>/gi, ' / ').replace(/[*_]/g, '').trim();
                sl = parts[5].replace(/[*_]/g, '').trim();
            } else {
                // Bullet format: - [B1] ... | TP: ... | SL: ... | ...
                parts.forEach(p => {
                    const tpMatch = p.match(/TP:\s*([^|]+)/i);
                    if (tpMatch) tp = tpMatch[1].replace(/[*_]/g, '').trim();
                    const slMatch = p.match(/SL:\s*([^|]+)/i);
                    if (slMatch) sl = slMatch[1].replace(/[*_]/g, '').trim();
                });

                // Extract price from trigger phrase
                const priceMatch = line.match(/close\s*(?:back\s*)?(?:ABOVE|BELOW)\s*(?:Day Low\s*)?([0-9,]+(?:\.[0-9]+)?)/i)
                    || line.match(/(?:ABOVE|BELOW)\s*(?:Day Low\s*)?([0-9,]{5,}(?:\.[0-9]+)?)/i)
                    || line.match(/([0-9,]{5,}(?:\.[0-9]+)?)/);

                if (priceMatch) {
                    rawPrice = priceMatch[1].replace(/,/g, '');
                }

                // Clean behavior logic text
                const colonAfterParen = line.indexOf('):');
                let entryText = '';
                if (colonAfterParen !== -1) {
                    entryText = line.substring(colonAfterParen + 2).trim();
                } else {
                    entryText = line.replace(/^[-*]\s*\[[^\]]+\][^:]*:\s*/, '').trim();
                }
                const tpSplit = entryText.indexOf(' | TP:');
                if (tpSplit !== -1) {
                    entryText = entryText.substring(0, tpSplit).trim();
                } else {
                    const pIdx = entryText.indexOf(' |');
                    if (pIdx !== -1) entryText = entryText.substring(0, pIdx).trim();
                }
                behavior = tag + ': ' + entryText;
            }
        }

        const key = tag || (rawPrice + '_' + bias);
        if (rawPrice && !seen.has(key)) {
            seen.add(key);
            levels.push({
                source: 'AI',
                timestamp: timestamp,
                timeDisplay: timeDisplay,
                price: rawPrice,
                bias: bias,
                behavior: behavior,
                tp: tp,
                sl: sl,
                status: 'na'
            });
        }
    }

    return levels;
}

window.dailyPlanSummary.forEach((s, idx) => {
    const parsed = parseNiftyLevelsFromMarkdown(s.text, s.timestamp, s.timeDisplay);
    console.log(`Nifty Summary ${idx} (${s.timeDisplay}): ${parsed.length} levels`);
    parsed.forEach(p => console.log(`   ${p.behavior.substring(0, 15)} | price: ${p.price} | bias: ${p.bias} | TP: ${p.tp.substring(0, 20)} | SL: ${p.sl.substring(0, 15)}`));
});


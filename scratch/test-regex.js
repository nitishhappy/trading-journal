const fs = require('fs');

const text = `
## 7. Tactical Trading Plan (5-Min Action Plan & Action Triggers)

### 5-Minute Execution Setups
- **BUY Setup 1 (Displacement FVG Pullback Long):** Pullback into **24,035–24,055** with lower-wick rejection, closing 5m candle back ABOVE **24,065**. | **SL:** 24,020 | **TP:** 24,124, 24,188.
- BUY Setup 1 (Demand Floor SSL Sweep Reversal Long - SFP / Turtle Soup): Sweep below $78,161.50 rejected with lower wick, followed by 5m close back ABOVE $78,572.32. TP: $77,583.40 / $77,095.00. SL: $78,804.40.
`;

const lines = text.split('\n').filter(l => l.trim().startsWith('-'));
lines.forEach(line => {
    const cleanLine = line.replace(/^-/, '').trim();
    
    let textWithoutTpSl = cleanLine;
    const stripMatch = cleanLine.match(/(?:\|\s*\*\*)?(?:TP:|SL:)/i);
    if (stripMatch) {
        textWithoutTpSl = cleanLine.substring(0, stripMatch.index).trim();
        textWithoutTpSl = textWithoutTpSl.replace(/[|.-]\s*$/, '').trim();
    }

    let tp = '-';
    let sl = '-';

    const tpMatch = cleanLine.match(/TP:\s*\*?\*?\s*(.*?)(?=(?:\|\s*\*?\*?\s*)?SL:|\.\s*SL:|\s*SL:|$)/i);
    if (tpMatch) tp = tpMatch[1].replace(/\*+/g, '').replace(/\.$/, '').trim();

    const slMatch = cleanLine.match(/SL:\s*\*?\*?\s*(.*?)(?=(?:\|\s*\*?\*?\s*)?TP:|\.\s*TP:|\s*TP:|$)/i);
    if (slMatch) sl = slMatch[1].replace(/\*+/g, '').replace(/\.$/, '').trim();

    console.log("Original:", cleanLine);
    console.log("TextWithout:", textWithoutTpSl);
    console.log("TP:", tp);
    console.log("SL:", sl);
    console.log("---");
});

// ===================== LEVELS TAB UI ===================== //
import { viewLevels } from '../dom.js';

if (viewLevels) {
    let allLevels = [];
    
    const inpPrice = document.getElementById('inp-level-price');
    const inpBias = document.getElementById('inp-level-bias');
    const inpBehavior = document.getElementById('inp-level-behavior');
    const inpTp = document.getElementById('inp-level-tp');
    const inpSl = document.getElementById('inp-level-sl');
    
    // Quick buttons
    document.querySelectorAll('.level-quick-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            inpPrice.value = e.target.dataset.val;
        });
    });

    document.querySelectorAll('.level-behavior-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.level-behavior-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            inpBehavior.value = e.target.dataset.val;
        });
    });

    // Collapsible panels
    document.getElementById('levels-form-header').addEventListener('click', function() {
        togglePanel('levels-form-body', this);
    });
    
    document.getElementById('levels-list-header').addEventListener('click', function(e) {
        if(e.target.id === 'btn-level-clear') return; // let clear handle itself
        togglePanel('levels-list-body', this);
    });

    function togglePanel(bodyId, headerEl) {
        const body = document.getElementById(bodyId);
        const icon = headerEl.querySelector('.toggle-icon');
        if (body.style.display === 'none') {
            body.style.display = 'block';
            if(icon) icon.innerText = '▼';
        } else {
            body.style.display = 'none';
            if(icon) icon.innerText = '▶';
        }
    }

    // Initialize
    function initLevels() {
        let loaded = localStorage.getItem('dailyTradePlanData');
        if (loaded) {
            const parsed = JSON.parse(loaded);
            if(parsed.length > 0) {
                parsed.forEach(l => injectLevelCard(l.id, l.rawPrice, l.bias, l.behavior, l.tp, l.sl, false));
            }
        }
        renderChart();
    }

    function saveLevelsData() {
        localStorage.setItem('dailyTradePlanData', JSON.stringify(allLevels));
    }

    document.getElementById('btn-level-clear').addEventListener('click', (e) => {
        e.stopPropagation();
        if(confirm("Are you sure you want to clear all levels?")) {
            allLevels = [];
            document.getElementById('levels-list').innerHTML = `<div class="empty-state-levels" id="levels-empty-state">No levels mapped yet. Add a level above to build your trade plan.</div>`;
            saveLevelsData();
            updateCount();
            renderChart();
        }
    });

    document.getElementById('btn-level-add').addEventListener('click', () => {
        const price = inpPrice.value.trim();
        const bias = inpBias.value;
        const behavior = inpBehavior.value.trim();
        const tp = inpTp.value.trim();
        const sl = inpSl.value.trim();

        if (!price) { alert("Please enter a key price level."); return; }
        if (!behavior) { alert("Please describe the expected behavior."); return; }

        const levelId = 'lvl-' + Date.now();
        injectLevelCard(levelId, price, bias, behavior, tp, sl, true);

        inpPrice.value = '';
        inpBehavior.value = '';
        inpTp.value = '';
        inpSl.value = '';
        
        document.querySelectorAll('.level-behavior-btn').forEach(b => b.classList.remove('active'));
        inpPrice.focus();
    });

    // Make edit functions available globally for inline onblur
    window.updateLevelCardData = function(id) {
        const card = document.getElementById(id);
        if(!card) return;
        const newPrice = card.querySelector('.card-price').innerText.trim();
        const newBehavior = card.querySelector('.card-behavior-title').innerText.trim();
        const newTp = card.querySelector('.val-tp').innerText.trim();
        const newSl = card.querySelector('.val-sl').innerText.trim();

        const idx = allLevels.findIndex(l => l.id === id);
        if(idx !== -1) {
            allLevels[idx].rawPrice = newPrice;
            allLevels[idx].behavior = newBehavior;
            allLevels[idx].tp = newTp;
            allLevels[idx].sl = newSl;
            
            const numbers = newPrice.match(/\d+(\.\d+)?/g);
            if(numbers && numbers.length > 0) {
                if(numbers.length >= 2) {
                    allLevels[idx].isRange = true;
                    allLevels[idx].pHigh = Math.max(parseFloat(numbers[0]), parseFloat(numbers[1]));
                    allLevels[idx].pLow = Math.min(parseFloat(numbers[0]), parseFloat(numbers[1]));
                } else {
                    allLevels[idx].isRange = false;
                    allLevels[idx].pHigh = parseFloat(numbers[0]);
                    allLevels[idx].pLow = parseFloat(numbers[0]);
                }
            } else {
                allLevels[idx].pHigh = NaN;
                allLevels[idx].pLow = NaN;
            }
        }
        renderChart();
        saveLevelsData();
    };

    window.removeLevelCard = function(id) {
        document.getElementById(id).remove();
        allLevels = allLevels.filter(l => l.id !== id);
        updateCount();
        renderChart();
        saveLevelsData();
    };

    function injectLevelCard(levelId, price, bias, behavior, tp, sl, shouldSave) {
        const list = document.getElementById('levels-list');
        const empty = document.getElementById('levels-empty-state');
        if (empty) empty.style.display = 'none';

        let pHigh = NaN, pLow = NaN;
        let isRange = false;
        
        const numbers = price.match(/\d+(\.\d+)?/g);
        if(numbers && numbers.length > 0) {
            if(numbers.length >= 2) {
                isRange = true;
                pHigh = Math.max(parseFloat(numbers[0]), parseFloat(numbers[1]));
                pLow = Math.min(parseFloat(numbers[0]), parseFloat(numbers[1]));
            } else {
                pHigh = parseFloat(numbers[0]);
                pLow = pHigh;
            }
        }

        const card = document.createElement('div');
        card.className = `level-card ${bias}`;
        card.id = levelId;
        
        let biasBadge = "Short";
        if (bias === 'bullish') biasBadge = "Long";
        if (bias === 'neutral') biasBadge = "Neutral";

        card.innerHTML = `
            <div class="card-price" contenteditable="true" title="Click to edit" onblur="window.updateLevelCardData('${levelId}')">${price}</div>
            <div class="card-behavior">
                <span class="badge ${bias}">${biasBadge}</span>
                <div class="card-behavior-title" contenteditable="true" title="Click to edit" onblur="window.updateLevelCardData('${levelId}')">${behavior}</div>
            </div>
            <div class="card-metric">
                <span class="card-metric-label">Target</span>
                <span class="card-metric-val val-tp" contenteditable="true" title="Click to edit" onblur="window.updateLevelCardData('${levelId}')">${tp ? tp : 'Open'}</span>
            </div>
            <div class="card-metric">
                <span class="card-metric-label">Stop Loss</span>
                <span class="card-metric-val val-sl" contenteditable="true" title="Click to edit" onblur="window.updateLevelCardData('${levelId}')">${sl ? sl : 'Manual'}</span>
            </div>
            <button class="btn-delete" onclick="window.removeLevelCard('${levelId}')" title="Remove Level">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
        `;

        let inserted = false;
        const existingCards = list.querySelectorAll('.level-card');
        for (let i = 0; i < existingCards.length; i++) {
            const exId = existingCards[i].id;
            const exData = allLevels.find(l => l.id === exId);
            if (exData && !isNaN(pHigh) && !isNaN(exData.pHigh)) {
                if (pHigh > exData.pHigh) {
                    list.insertBefore(card, existingCards[i]);
                    inserted = true;
                    break;
                }
            }
        }
        if (!inserted) list.appendChild(card);

        allLevels.push({
            id: levelId,
            rawPrice: price,
            pHigh: pHigh,
            pLow: pLow,
            isRange: isRange,
            bias: bias,
            biasBadge: biasBadge,
            behavior: behavior,
            tp: tp,
            sl: sl
        });

        updateCount();
        renderChart();
        if(shouldSave) saveLevelsData();
    }

    function updateCount() {
        const count = document.querySelectorAll('.level-card').length;
        document.getElementById('level-count').innerText = `${count} Level${count !== 1 ? 's' : ''}`;
        if (count === 0) {
            const empty = document.getElementById('levels-empty-state');
            if(empty) empty.style.display = 'block';
        }
    }

    function renderChart() {
        const area = document.getElementById('visual-chart-area');
        area.innerHTML = ''; 

        const validLevels = allLevels.filter(l => !isNaN(l.pHigh));
        
        if(validLevels.length === 0) {
            area.style.display = 'block';
            area.innerHTML = '<div class="empty-state-levels" id="chart-empty">Add numeric price levels to see the visual map.</div>';
            return;
        }

        area.style.display = 'flex';
        area.style.flexDirection = 'column';
        area.style.gap = '2rem'; 

        let grouped = {};
        validLevels.forEach(lvl => {
            if(!grouped[lvl.pHigh]) grouped[lvl.pHigh] = [];
            grouped[lvl.pHigh].push(lvl);
        });

        const sortedPrices = Object.keys(grouped).map(Number).sort((a, b) => b - a);

        sortedPrices.forEach(price => {
            const levelsInGroup = grouped[price];
            
            const row = document.createElement('div');
            row.style.position = 'relative';
            row.style.width = '100%';
            row.style.display = 'flex';
            row.style.alignItems = 'flex-start';
            
            let mainColor = 'var(--warning)';
            let lineBg = 'rgba(251, 191, 36, 0.4)';
            if(levelsInGroup[0].bias === 'bullish') { mainColor = 'var(--success)'; lineBg = 'rgba(16, 185, 129, 0.4)'; }
            if(levelsInGroup[0].bias === 'bearish') { mainColor = 'var(--danger)'; lineBg = 'rgba(244, 63, 94, 0.4)'; }

            const hasRange = levelsInGroup.some(l => l.isRange);
            let pLow = price;
            if (hasRange) {
                pLow = Math.min(...levelsInGroup.map(l => l.pLow));
            }

            if (hasRange) {
                const zone = document.createElement('div');
                zone.style.position = 'absolute';
                zone.style.top = '10px';
                zone.style.left = '0';
                zone.style.right = '0';
                zone.style.height = '60px'; 
                zone.style.backgroundColor = lineBg.replace('0.4', '0.1');
                zone.style.borderTop = '1px dashed ' + mainColor;
                zone.style.borderBottom = '1px dashed ' + mainColor;
                row.appendChild(zone);
            } else {
                const line = document.createElement('div');
                line.style.position = 'absolute';
                line.style.top = '20px';
                line.style.left = '0';
                line.style.right = '0';
                line.style.height = '1px';
                line.style.backgroundColor = lineBg;
                row.appendChild(line);
            }

            const axisLbl = document.createElement('div');
            axisLbl.style.position = 'absolute';
            axisLbl.style.top = '20px';
            axisLbl.style.left = '-75px';
            axisLbl.style.width = '65px';
            axisLbl.style.textAlign = 'right';
            axisLbl.style.transform = 'translateY(-50%)';
            axisLbl.style.fontFamily = "'JetBrains Mono', monospace";
            axisLbl.style.fontSize = '0.9rem';
            axisLbl.style.fontWeight = '700';
            axisLbl.style.color = mainColor;
            axisLbl.innerText = price;
            row.appendChild(axisLbl);

            if (hasRange && pLow !== price) {
                const axisLblLow = document.createElement('div');
                axisLblLow.style.position = 'absolute';
                axisLblLow.style.top = '70px'; 
                axisLblLow.style.left = '-75px';
                axisLblLow.style.width = '65px';
                axisLblLow.style.textAlign = 'right';
                axisLblLow.style.transform = 'translateY(-50%)';
                axisLblLow.style.fontFamily = "'JetBrains Mono', monospace";
                axisLblLow.style.fontSize = '0.85rem';
                axisLblLow.style.color = 'var(--text-dim)';
                axisLblLow.innerText = pLow;
                row.appendChild(axisLblLow);
            }

            const stack = document.createElement('div');
            stack.style.position = 'relative';
            stack.style.zIndex = '10';
            stack.style.marginLeft = '20px'; 
            stack.style.display = 'flex';
            stack.style.flexDirection = 'column';
            stack.style.gap = '10px';

            levelsInGroup.forEach(lvl => {
                let cColor = 'var(--warning)';
                if(lvl.bias === 'bullish') cColor = 'var(--success)';
                if(lvl.bias === 'bearish') cColor = 'var(--danger)';

                const ann = document.createElement('div');
                ann.className = 'chart-annotation';
                ann.style.border = '1px solid ' + cColor;
                ann.style.borderLeft = '4px solid ' + cColor;
                ann.style.background = `color-mix(in srgb, ${cColor} 8%, var(--surface-1))`;
                ann.style.boxShadow = `0 4px 15px color-mix(in srgb, ${cColor} 10%, transparent)`;
                
                let rangeText = '';
                if (lvl.isRange) {
                    rangeText = ` <span style="color:var(--text-dim); font-size:0.8em; font-family:'JetBrains Mono', monospace;">(${lvl.pHigh} - ${lvl.pLow})</span>`;
                }

                ann.innerHTML = `
                    <div class="badge ${lvl.bias}" style="margin-bottom:0.5rem;">${lvl.biasBadge}${rangeText}</div>
                    <div class="text" style="line-height:1.5; color:var(--text); font-size:0.95rem;">${lvl.behavior}</div>
                    <div style="margin-top:0.75rem; font-size:0.8rem; color:var(--text-dim); display:flex; justify-content:space-between; font-family:'JetBrains Mono', monospace;">
                        <span>TP: <strong style="color:var(--success);">${lvl.tp||'Open'}</strong></span>
                        <span>SL: <strong style="color:var(--danger);">${lvl.sl||'Manual'}</strong></span>
                    </div>
                `;
                stack.appendChild(ann);
            });

            row.appendChild(stack);
            area.appendChild(row);
        });
    }

    // Call init when module loads
    initLevels();
}

// ===================== LEVELS TAB UI ===================== //
import { viewLevels } from '../dom.js';

if (viewLevels) {
    let allLevels = [];
    
    const inpSource = document.getElementById('inp-level-source');
    const inpPrice = document.getElementById('inp-level-price');
    const inpBias = document.getElementById('inp-level-bias');
    const inpBehavior = document.getElementById('inp-level-behavior');
    const inpTp = document.getElementById('inp-level-tp');
    const inpSl = document.getElementById('inp-level-sl');
    
    // Quick Source buttons
    document.querySelectorAll('.level-source-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.level-source-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            if (inpSource) inpSource.value = e.target.dataset.val;
        });
    });

    // Quick Price buttons
    document.querySelectorAll('.level-quick-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            inpPrice.value = e.target.dataset.val;
        });
    });

    // Quick Behavior buttons
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
        if(e.target.id === 'btn-level-clear' || e.target.id === 'btn-level-upload' || e.target.id === 'inp-level-upload') return; 
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
            try {
                const parsed = JSON.parse(loaded);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    parsed.forEach(l => {
                        injectLevelCard(
                            l.id || ('lvl-' + Math.random().toString(36).substr(2, 9)),
                            l.rawPrice || l.price || "",
                            l.bias || "neutral",
                            l.behavior || "",
                            l.tp || "",
                            l.sl || "",
                            l.source || "BT",
                            l.status || "na",
                            false
                        );
                    });
                    renderChart();
                    renderScorecard();
                    return;
                }
            } catch (e) {
                console.warn("Could not parse saved dailyTradePlanData:", e);
            }
        }

        if (window.dailyPlanData && Array.isArray(window.dailyPlanData) && window.dailyPlanData.length > 0) {
            window.dailyPlanData.forEach((lvl, idx) => {
                const levelId = 'lvl-auto-' + idx;
                injectLevelCard(
                    levelId, 
                    lvl.price || lvl.rawPrice || "", 
                    lvl.bias || "neutral", 
                    lvl.behavior || "", 
                    lvl.tp || "", 
                    lvl.sl || "", 
                    lvl.source || "BT",
                    lvl.status || "na",
                    false
                );
            });
            saveLevelsData();
        }
        renderChart();
        renderScorecard();
    }

    function saveLevelsData() {
        localStorage.setItem('dailyTradePlanData', JSON.stringify(allLevels));
    }

    const inpUpload = document.getElementById('inp-level-upload');
    const btnUpload = document.getElementById('btn-level-upload');

    if (btnUpload && inpUpload) {
        btnUpload.addEventListener('click', (e) => {
            e.stopPropagation();
            inpUpload.click();
        });

        inpUpload.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const data = JSON.parse(event.target.result);
                    if (Array.isArray(data)) {
                        data.forEach((lvl, idx) => {
                            const levelId = 'lvl-' + Date.now() + '-' + idx;
                            injectLevelCard(
                                levelId, 
                                lvl.price || lvl.rawPrice || "", 
                                lvl.bias || "neutral", 
                                lvl.behavior || "", 
                                lvl.tp || "", 
                                lvl.sl || "", 
                                lvl.source || "BT",
                                lvl.status || "na",
                                false
                            );
                        });
                        saveLevelsData();
                        renderScorecard();
                    } else {
                        alert("Invalid JSON format. Expected an array of levels.");
                    }
                } catch (err) {
                    alert("Error parsing JSON file: " + err.message);
                }
                inpUpload.value = ''; 
            };
            reader.readAsText(file);
        });
    }

    document.getElementById('btn-level-clear').addEventListener('click', (e) => {
        e.stopPropagation();
        if(confirm("Are you sure you want to clear all levels?")) {
            allLevels = [];
            document.getElementById('levels-list').innerHTML = `<div class="empty-state-levels" id="levels-empty-state">No levels mapped yet. Add a level above to build your trade plan.</div>`;
            saveLevelsData();
            updateCount();
            renderChart();
            renderScorecard();
        }
    });

    document.getElementById('btn-level-add').addEventListener('click', () => {
        const source = (inpSource ? inpSource.value.trim() : '') || 'BT';
        const price = inpPrice.value.trim();
        const bias = inpBias.value;
        const behavior = inpBehavior.value.trim();
        const tp = inpTp.value.trim();
        const sl = inpSl.value.trim();

        if (!price) { alert("Please enter a key price level."); return; }
        if (!behavior) { alert("Please describe the expected behavior."); return; }

        const levelId = 'lvl-' + Date.now();
        injectLevelCard(levelId, price, bias, behavior, tp, sl, source, 'na', true);

        inpPrice.value = '';
        inpBehavior.value = '';
        inpTp.value = '';
        inpSl.value = '';
        
        document.querySelectorAll('.level-behavior-btn').forEach(b => b.classList.remove('active'));
        inpPrice.focus();
    });

    // Make outcome status toggle globally accessible
    window.setLevelStatus = function(id, newStatus) {
        const idx = allLevels.findIndex(l => l.id === id);
        if (idx !== -1) {
            allLevels[idx].status = newStatus;
        }

        const card = document.getElementById(id);
        if (card) {
            card.classList.remove('is-worked', 'is-failed', 'is-na');
            card.classList.add(`is-${newStatus}`);
            const btns = card.querySelectorAll('.card-status-review .status-btn');
            btns.forEach(b => b.classList.remove('active'));
            const targetBtn = card.querySelector(`.card-status-review .status-${newStatus}`);
            if (targetBtn) targetBtn.classList.add('active');
        }

        // Sync in reaction modal if open
        const modalBtns = document.querySelectorAll(`.reaction-status-${id}`);
        modalBtns.forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.status === newStatus) {
                btn.classList.add('active');
            }
        });

        saveLevelsData();
        renderScorecard();
    };

    // Make edit functions available globally for inline onblur
    window.updateLevelCardData = function(id) {
        const card = document.getElementById(id);
        if(!card) return;
        const newSource = (card.querySelector('.source-badge')?.innerText.trim().toUpperCase()) || 'BT';
        const newPrice = card.querySelector('.card-price').innerText.trim();
        const newBehavior = card.querySelector('.card-behavior-title').innerText.trim();
        const newTp = card.querySelector('.val-tp').innerText.trim();
        const newSl = card.querySelector('.val-sl').innerText.trim();
        
        const badgeEl = card.querySelector('.badge');
        const badgeText = badgeEl.innerText.trim().toLowerCase();
        let newBias = 'neutral';
        let displayBadge = 'Neutral';
        if(badgeText === 'long' || badgeText === 'bullish') { newBias = 'bullish'; displayBadge = 'Long'; }
        else if(badgeText === 'short' || badgeText === 'bearish') { newBias = 'bearish'; displayBadge = 'Short'; }
        
        // Update DOM classes for colors
        badgeEl.className = `badge ${newBias}`;
        badgeEl.innerText = displayBadge;

        const idx = allLevels.findIndex(l => l.id === id);
        if(idx !== -1) {
            allLevels[idx].source = newSource;
            allLevels[idx].rawPrice = newPrice;
            allLevels[idx].behavior = newBehavior;
            allLevels[idx].tp = newTp;
            allLevels[idx].sl = newSl;
            allLevels[idx].bias = newBias;
            allLevels[idx].biasBadge = displayBadge;
            
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
        renderScorecard();
        saveLevelsData();
    };

    window.removeLevelCard = function(id) {
        const el = document.getElementById(id);
        if (el) el.remove();
        allLevels = allLevels.filter(l => l.id !== id);
        updateCount();
        renderChart();
        renderScorecard();
        saveLevelsData();
    };

    function injectLevelCard(levelId, price, bias, behavior, tp, sl, source, status, shouldSave) {
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

        const normSource = (source || 'BT').toUpperCase();
        const normStatus = status || 'na';

        const card = document.createElement('div');
        card.className = `level-card ${bias} is-${normStatus}`;
        card.id = levelId;
        
        let biasBadge = "Short";
        if (bias === 'bullish') biasBadge = "Long";
        if (bias === 'neutral') biasBadge = "Neutral";

        card.innerHTML = `
            <div class="card-header-bar">
                <div style="display:flex; align-items:center; gap:8px;">
                    <span class="source-badge" contenteditable="true" title="Edit source abbreviation (e.g. BT, AK, SM)" onblur="window.updateLevelCardData('${levelId}')">${normSource}</span>
                    <div class="card-price" contenteditable="true" title="Click to edit price" onblur="window.updateLevelCardData('${levelId}')">${price}</div>
                    <span class="badge ${bias}" contenteditable="true" title="Edit bias (Long/Short/Neutral)" onblur="window.updateLevelCardData('${levelId}')">${biasBadge}</span>
                </div>
                <div class="card-status-review">
                    <button type="button" class="status-btn status-worked ${normStatus === 'worked' ? 'active' : ''}" onclick="window.setLevelStatus('${levelId}', 'worked')" title="Mark as Worked / Respected">✅ Worked</button>
                    <button type="button" class="status-btn status-failed ${normStatus === 'failed' ? 'active' : ''}" onclick="window.setLevelStatus('${levelId}', 'failed')" title="Mark as Failed / Stop Loss">❌ Failed</button>
                    <button type="button" class="status-btn status-na ${normStatus === 'na' ? 'active' : ''}" onclick="window.setLevelStatus('${levelId}', 'na')" title="Mark as NA / Untouched">⚪ NA</button>
                </div>
            </div>
            <div class="card-behavior">
                <div class="card-behavior-title" contenteditable="true" title="Click to edit behavior" onblur="window.updateLevelCardData('${levelId}')">${behavior}</div>
            </div>
            <div class="card-metric-row">
                <div class="card-metric">
                    <span class="card-metric-label">Target</span>
                    <span class="card-metric-val val-tp" contenteditable="true" title="Click to edit" onblur="window.updateLevelCardData('${levelId}')">${tp ? tp : 'Open'}</span>
                </div>
                <div class="card-metric">
                    <span class="card-metric-label">Stop Loss</span>
                    <span class="card-metric-val val-sl" contenteditable="true" title="Click to edit" onblur="window.updateLevelCardData('${levelId}')">${sl ? sl : 'Manual'}</span>
                </div>
            </div>
            <button class="btn-delete" onclick="window.removeLevelCard('${levelId}')" title="Remove Level">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
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
            source: normSource,
            status: normStatus,
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
        renderScorecard();
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

    // ===================== EOD PERFORMANCE SCORECARD ===================== //
    function renderScorecard() {
        const tbody = document.getElementById('scorecard-tbody');
        const totalRatioEl = document.getElementById('scorecard-overall-ratio');
        const totalWinrateEl = document.getElementById('scorecard-overall-winrate');
        if (!tbody) return;

        tbody.innerHTML = '';

        if (allLevels.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-dim); padding:1rem;">No levels to review yet.</td></tr>`;
            if (totalRatioEl) totalRatioEl.innerText = '0:0';
            if (totalWinrateEl) {
                totalWinrateEl.innerText = '0%';
                totalWinrateEl.className = '';
            }
            return;
        }

        // Group stats by source
        const sourceMap = {};
        let grandWorked = 0;
        let grandFailed = 0;
        let grandNA = 0;

        allLevels.forEach(lvl => {
            const src = (lvl.source || 'BT').toUpperCase();
            if (!sourceMap[src]) {
                sourceMap[src] = { worked: 0, failed: 0, na: 0 };
            }
            const st = lvl.status || 'na';
            if (st === 'worked') {
                sourceMap[src].worked++;
                grandWorked++;
            } else if (st === 'failed') {
                sourceMap[src].failed++;
                grandFailed++;
            } else {
                sourceMap[src].na++;
                grandNA++;
            }
        });

        const sortedSources = Object.keys(sourceMap).sort();

        sortedSources.forEach(src => {
            const stat = sourceMap[src];
            const w = stat.worked;
            const f = stat.failed;
            const na = stat.na;
            const evaluated = w + f;
            
            let winRateStr = '--';
            let winRateClass = 'stat-rate-na';
            if (evaluated > 0) {
                const wr = (w / evaluated) * 100;
                winRateStr = wr.toFixed(1) + '%';
                if (wr >= 60) winRateClass = 'stat-rate-high';
                else if (wr >= 40) winRateClass = 'stat-rate-mid';
                else winRateClass = 'stat-rate-low';
            }

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><span class="source-badge" style="font-size:0.78rem;">${src}</span></td>
                <td><b class="stat-num-worked">${w}</b></td>
                <td><b class="stat-num-failed">${f}</b></td>
                <td><span class="stat-ratio font-mono">${w} : ${f}</span></td>
                <td><span class="stat-rate-pill ${winRateClass}">${winRateStr}</span></td>
                <td class="stat-na-cell">${na}</td>
            `;
            tbody.appendChild(tr);
        });

        // Grand Total Row
        const grandEvaluated = grandWorked + grandFailed;
        let grandWRStr = '--';
        let grandWRClass = 'stat-rate-na';
        if (grandEvaluated > 0) {
            const gwr = (grandWorked / grandEvaluated) * 100;
            grandWRStr = gwr.toFixed(1) + '%';
            if (gwr >= 60) grandWRClass = 'stat-rate-high';
            else if (gwr >= 40) grandWRClass = 'stat-rate-mid';
            else grandWRClass = 'stat-rate-low';
        }

        const totalTr = document.createElement('tr');
        totalTr.className = 'scorecard-total-row';
        totalTr.innerHTML = `
            <td><b>TOTAL / ALL</b></td>
            <td><b class="stat-num-worked">${grandWorked}</b></td>
            <td><b class="stat-num-failed">${grandFailed}</b></td>
            <td><b class="stat-ratio font-mono" style="font-size:0.95rem;">${grandWorked} : ${grandFailed}</b></td>
            <td><span class="stat-rate-pill ${grandWRClass}" style="font-size:0.85rem;">${grandWRStr}</span></td>
            <td class="stat-na-cell">${grandNA}</td>
        `;
        tbody.appendChild(totalTr);

        // Update header pill
        if (totalRatioEl) totalRatioEl.innerText = `${grandWorked}:${grandFailed}`;
        if (totalWinrateEl) {
            totalWinrateEl.innerText = grandWRStr;
            totalWinrateEl.style.color = grandWRClass === 'stat-rate-high' ? 'var(--success)' : grandWRClass === 'stat-rate-low' ? 'var(--danger)' : 'var(--warning)';
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
                zone.style.pointerEvents = 'none';
                zone.style.zIndex = '1';
                row.appendChild(zone);
            } else {
                const line = document.createElement('div');
                line.style.position = 'absolute';
                line.style.top = '16px'; 
                line.style.left = '0';
                line.style.right = '0';
                line.style.height = '2px';
                line.style.backgroundColor = lineBg;
                line.style.boxShadow = `0 0 8px ${mainColor}`;
                line.style.pointerEvents = 'none';
                line.style.zIndex = '1';
                row.appendChild(line);
            }

            const axisLblHigh = document.createElement('div');
            axisLblHigh.style.position = 'absolute';
            axisLblHigh.style.top = '16px';
            axisLblHigh.style.left = '-75px';
            axisLblHigh.style.width = '65px';
            axisLblHigh.style.textAlign = 'right';
            axisLblHigh.style.transform = 'translateY(-50%)';
            axisLblHigh.style.fontFamily = "'JetBrains Mono', monospace";
            axisLblHigh.style.fontSize = '0.85rem';
            axisLblHigh.style.fontWeight = 'bold';
            axisLblHigh.style.color = mainColor;
            axisLblHigh.innerText = price;
            row.appendChild(axisLblHigh);

            if(hasRange) {
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

                const srcTag = lvl.source ? `<span class="source-badge" style="font-size:0.72rem; margin-right:4px;">${lvl.source}</span>` : '';

                ann.innerHTML = `
                    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:0.5rem;">
                        <div>
                            ${srcTag}
                            <span class="badge ${lvl.bias}">${lvl.biasBadge}${rangeText}</span>
                        </div>
                        <span class="stat-tag ${lvl.status === 'worked' ? 'worked' : lvl.status === 'failed' ? 'failed' : 'na'}" style="font-size:0.7rem;">${lvl.status === 'worked' ? '✅ Worked' : lvl.status === 'failed' ? '❌ Failed' : '⚪ NA'}</span>
                    </div>
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

    // ===================== 5M FIRST CANDLE IN / OUT ANALYSIS ===================== //
    const inpAnalysisDate = document.getElementById('inp-level-date');
    const btnAnalyze = document.getElementById('btn-level-analyze');
    const modalReaction = document.getElementById('level-reaction-modal');
    const modalReactionClose = document.getElementById('level-reaction-modal-close');
    const btnReactionClose = document.getElementById('level-reaction-close-btn');
    const reactionLoading = document.getElementById('level-reaction-loading');
    const reactionError = document.getElementById('level-reaction-error');
    const reactionResults = document.getElementById('level-reaction-results');
    const reactionSubtitle = document.getElementById('level-reaction-subtitle');
    const reactionFooter = document.getElementById('level-reaction-summary-footer');

    // Initialize Date Input with today's date in IST
    if (inpAnalysisDate) {
        const todayIst = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
        inpAnalysisDate.value = todayIst;
    }

    if (btnAnalyze) {
        btnAnalyze.addEventListener('click', runLevelReactionAnalysis);
    }

    if (modalReactionClose) {
        modalReactionClose.addEventListener('click', closeReactionModal);
    }

    if (btnReactionClose) {
        btnReactionClose.addEventListener('click', closeReactionModal);
    }

    if (modalReaction) {
        modalReaction.addEventListener('click', (e) => {
            if (e.target === modalReaction) closeReactionModal();
        });
    }

    function closeReactionModal() {
        if (modalReaction) modalReaction.classList.add('hidden');
    }

    async function fetch5mCandles(dateStr) {
        // 1. Try serverless backend route first
        try {
            const res = await fetch(`/api/niftyCandles?date=${encodeURIComponent(dateStr)}`);
            if (res.ok) {
                const data = await res.json();
                if (data.success && Array.isArray(data.candles) && data.candles.length > 0) {
                    return data;
                }
            }
        } catch (e) {
            console.warn("Backend /api/niftyCandles fetch failed, falling back to direct Upstox:", e);
        }

        // 2. Direct browser fallback using Upstox public API
        try {
            const encInst = "NSE_INDEX%7CNifty%2050";
            const todayIst = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
            let rawCandles = [];

            if (dateStr === todayIst) {
                const intraRes = await fetch(`https://api.upstox.com/v2/historical-candle/intraday/${encInst}/1minute`);
                if (intraRes.ok) {
                    const data = await intraRes.json();
                    rawCandles = data?.data?.candles || [];
                }
            }

            if (!rawCandles || rawCandles.length === 0) {
                const histRes = await fetch(`https://api.upstox.com/v2/historical-candle/${encInst}/1minute/${dateStr}/${dateStr}`);
                if (histRes.ok) {
                    const data = await histRes.json();
                    rawCandles = data?.data?.candles || [];
                }
            }

            if (!rawCandles || rawCandles.length === 0) {
                return { success: false, message: `No candle data found for ${dateStr}. Market may have been closed.` };
            }

            // Filter & sort chronological
            const filtered1m = rawCandles
                .filter(c => c[0] && c[0].startsWith(dateStr))
                .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime());

            if (filtered1m.length === 0) {
                return { success: false, message: `No candle data for ${dateStr}.` };
            }

            // Aggregate into 5m
            const candles5m = [];
            for (const c of filtered1m) {
                const dt = new Date(c[0]);
                const minutes = dt.getMinutes();
                const bucketMin = Math.floor(minutes / 5) * 5;
                const bucketDt = new Date(dt);
                bucketDt.setMinutes(bucketMin, 0, 0);

                const timeStr = bucketDt.toLocaleTimeString("en-US", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false });
                const time12 = bucketDt.toLocaleTimeString("en-US", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: true });

                if (candles5m.length === 0 || candles5m[candles5m.length - 1].timeStr !== timeStr) {
                    candles5m.push({
                        timeStr,
                        time12,
                        timestamp: c[0],
                        open: Number(c[1]),
                        high: Number(c[2]),
                        low: Number(c[3]),
                        close: Number(c[4]),
                        volume: Number(c[5] || 0)
                    });
                } else {
                    const last = candles5m[candles5m.length - 1];
                    last.high = Math.max(last.high, Number(c[2]));
                    last.low = Math.min(last.low, Number(c[3]));
                    last.close = Number(c[4]);
                    last.volume += Number(c[5] || 0);
                }
            }

            return {
                success: true,
                date: dateStr,
                count: candles5m.length,
                dayHigh: Math.max(...candles5m.map(c => c.high)),
                dayLow: Math.min(...candles5m.map(c => c.low)),
                candles: candles5m
            };
        } catch (err) {
            console.error("Direct Upstox fetch error:", err);
            return { success: false, message: "Network error fetching candles: " + err.message };
        }
    }

    async function runLevelReactionAnalysis() {
        if (!modalReaction) return;
        
        const validLevels = allLevels.filter(l => !isNaN(l.pHigh));
        if (validLevels.length === 0) {
            alert("No price levels marked! Add one or more levels to the plan first.");
            return;
        }

        const dateStr = inpAnalysisDate ? inpAnalysisDate.value : new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
        if (!dateStr) {
            alert("Please select a valid date for analysis.");
            return;
        }

        // Open modal & show loader
        modalReaction.classList.remove('hidden');
        reactionLoading.classList.remove('hidden');
        reactionError.classList.add('hidden');
        reactionResults.innerHTML = '';
        reactionSubtitle.innerText = `Analyzing 5m Upstox candles for ${dateStr}...`;
        reactionFooter.innerText = '';

        const data = await fetch5mCandles(dateStr);
        reactionLoading.classList.add('hidden');

        if (!data || !data.success || !data.candles || data.candles.length === 0) {
            reactionError.classList.remove('hidden');
            reactionError.innerHTML = `
                <div style="font-size:1.5rem; margin-bottom:0.5rem;">⚠️</div>
                <div style="font-weight:600; margin-bottom:0.25rem;">Could not load 5m candle data for ${dateStr}</div>
                <div style="font-size:0.85rem; color:var(--text-dim);">${data?.message || 'Market might have been closed on this date.'}</div>
            `;
            reactionSubtitle.innerText = `No candle data available for ${dateStr}`;
            return;
        }

        const candles = data.candles;
        reactionSubtitle.innerText = `Evaluated ${candles.length} (5m) candles on ${dateStr} | Day Range: ${data.dayLow?.toFixed(1)} - ${data.dayHigh?.toFixed(1)}`;

        // Analyze each level
        let touchedCount = 0;
        const fragment = document.createDocumentFragment();

        validLevels.forEach((lvl, lIdx) => {
            const lHigh = lvl.pHigh;
            const lLow = lvl.pLow;

            let firstIn = null;
            let firstOut = null;
            let prevClose = null;

            for (let idx = 0; idx < candles.length; idx++) {
                const c = candles[idx];

                // 1. Detect First Candle IN
                if (!firstIn) {
                    if (c.low <= lHigh && c.high >= lLow) {
                        let approach = "Inside Level";
                        let approachIcon = "↔️";
                        if (prevClose !== null) {
                            if (prevClose > lHigh) {
                                approach = "From Above (Pullback / Drop)";
                                approachIcon = "↓";
                            } else if (prevClose < lLow) {
                                approach = "From Below (Rally / Push Up)";
                                approachIcon = "↑";
                            }
                        }

                        // Touch Type: Body entry vs Wick sweep
                        const bodyMin = Math.min(c.open, c.close);
                        const bodyMax = Math.max(c.open, c.close);
                        const isBody = (bodyMin <= lHigh && bodyMax >= lLow);
                        const touchType = isBody ? "Body Entry" : "Wick Sweep / Pin";

                        firstIn = {
                            index: idx,
                            time: c.time12,
                            candle: c,
                            approach,
                            approachIcon,
                            type: touchType,
                            isBody
                        };
                    }
                } else {
                    // 2. Detect First Candle OUT (first candle strictly closing outside after entry)
                    if (!firstOut && idx > firstIn.index) {
                        if (c.close > lHigh) {
                            firstOut = {
                                time: c.time12,
                                direction: "Broke Out Above 🟢",
                                dirType: "bullish",
                                candle: c
                            };
                        } else if (c.close < lLow) {
                            firstOut = {
                                time: c.time12,
                                direction: "Broke Down Below 🔴",
                                dirType: "bearish",
                                candle: c
                            };
                        }
                    }
                }

                prevClose = c.close;
            }

            if (firstIn) touchedCount++;

            // Create Result Card
            const card = document.createElement('div');
            card.className = `level-reaction-card ${lvl.bias || 'neutral'} ${firstIn ? 'is-touched' : 'not-touched'}`;

            let biasColor = 'var(--warning)';
            if (lvl.bias === 'bullish') biasColor = 'var(--success)';
            if (lvl.bias === 'bearish') biasColor = 'var(--danger)';

            let priceDisplay = lvl.rawPrice;
            if (lvl.isRange) {
                priceDisplay = `${lvl.pHigh} – ${lvl.pLow}`;
            }

            let inContentHtml = '';
            let outContentHtml = '';

            if (firstIn) {
                const c = firstIn.candle;
                inContentHtml = `
                    <div class="reaction-step-box in-box">
                        <div class="reaction-step-header">
                            <span class="reaction-step-tag tag-in">🟢 First Candle IN</span>
                            <span class="reaction-time-badge">${firstIn.time}</span>
                        </div>
                        <div class="reaction-step-details">
                            <div class="reaction-detail-row">
                                <span class="detail-label">Touch Type:</span>
                                <span class="detail-val type-pill ${firstIn.isBody ? 'body-pill' : 'wick-pill'}">${firstIn.type}</span>
                            </div>
                            <div class="reaction-detail-row">
                                <span class="detail-label">Approach:</span>
                                <span class="detail-val font-mono">${firstIn.approachIcon} ${firstIn.approach}</span>
                            </div>
                            <div class="reaction-ohlc-bar">
                                <span>O: <b>${c.open.toFixed(1)}</b></span>
                                <span>H: <b>${c.high.toFixed(1)}</b></span>
                                <span>L: <b>${c.low.toFixed(1)}</b></span>
                                <span>C: <b style="color:${c.close >= c.open ? 'var(--success)' : 'var(--danger)'};">${c.close.toFixed(1)}</b></span>
                            </div>
                        </div>
                    </div>
                `;

                if (firstOut) {
                    const oc = firstOut.candle;
                    outContentHtml = `
                        <div class="reaction-step-box out-box">
                            <div class="reaction-step-header">
                                <span class="reaction-step-tag tag-out">🔴 First Candle OUT</span>
                                <span class="reaction-time-badge">${firstOut.time}</span>
                            </div>
                            <div class="reaction-step-details">
                                <div class="reaction-detail-row">
                                    <span class="detail-label">Resolution:</span>
                                    <span class="detail-val res-badge ${firstOut.dirType}">${firstOut.direction}</span>
                                </div>
                                <div class="reaction-ohlc-bar">
                                    <span>O: <b>${oc.open.toFixed(1)}</b></span>
                                    <span>H: <b>${oc.high.toFixed(1)}</b></span>
                                    <span>L: <b>${oc.low.toFixed(1)}</b></span>
                                    <span>Exit C: <b style="color:${oc.close >= oc.open ? 'var(--success)' : 'var(--danger)'};">${oc.close.toFixed(1)}</b></span>
                                </div>
                            </div>
                        </div>
                    `;
                } else {
                    outContentHtml = `
                        <div class="reaction-step-box out-box neutral-out">
                            <div class="reaction-step-header">
                                <span class="reaction-step-tag tag-out-neutral">First Candle OUT</span>
                                <span class="reaction-time-badge" style="color:var(--text-dim);">EOD</span>
                            </div>
                            <div class="reaction-step-details" style="color:var(--text-dim); font-size:0.85rem; padding:6px 0;">
                                Price remained interacting inside / around level through market close.
                            </div>
                        </div>
                    `;
                }
            } else {
                inContentHtml = `
                    <div class="reaction-untouched-box">
                        <div class="untouched-icon">💤</div>
                        <div class="untouched-title">Level Not Reached</div>
                        <div class="untouched-desc">5m price action stayed outside this level all day (Day Range: ${data.dayLow?.toFixed(1)} – ${data.dayHigh?.toFixed(1)}).</div>
                    </div>
                `;
            }

            const srcTag = lvl.source ? `<span class="source-badge" style="font-size:0.75rem; margin-right:6px;">${lvl.source}</span>` : '';
            const currStatus = lvl.status || 'na';

            card.innerHTML = `
                <div class="reaction-card-top">
                    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                        <div class="reaction-level-info">
                            ${srcTag}
                            <span class="reaction-price-title" style="color:${biasColor};">${priceDisplay}</span>
                            <span class="badge ${lvl.bias}">${lvl.biasBadge || 'Level'}</span>
                        </div>
                        <div class="reaction-status-group" style="display:flex; gap:6px;">
                            <button type="button" class="status-btn status-worked reaction-status-${lvl.id} ${currStatus === 'worked' ? 'active' : ''}" data-status="worked" onclick="window.setLevelStatus('${lvl.id}', 'worked')" title="Mark Worked">✅ Worked</button>
                            <button type="button" class="status-btn status-failed reaction-status-${lvl.id} ${currStatus === 'failed' ? 'active' : ''}" data-status="failed" onclick="window.setLevelStatus('${lvl.id}', 'failed')" title="Mark Failed">❌ Failed</button>
                            <button type="button" class="status-btn status-na reaction-status-${lvl.id} ${currStatus === 'na' ? 'active' : ''}" data-status="na" onclick="window.setLevelStatus('${lvl.id}', 'na')" title="Mark NA">⚪ NA</button>
                        </div>
                    </div>
                    <div class="reaction-plan-behavior" style="margin-top:6px;">
                        <span class="plan-behavior-label">Planned Behavior:</span>
                        <span class="plan-behavior-text">${lvl.behavior || 'Key Reaction Area'}</span>
                    </div>
                    ${lvl.tp || lvl.sl ? `
                    <div class="reaction-targets-bar">
                        ${lvl.tp ? `<span>TP: <b style="color:var(--success);">${lvl.tp}</b></span>` : ''}
                        ${lvl.sl ? `<span>SL: <b style="color:var(--danger);">${lvl.sl}</b></span>` : ''}
                    </div>` : ''}
                </div>

                <div class="reaction-card-body">
                    ${inContentHtml}
                    ${outContentHtml}
                </div>
            `;

            fragment.appendChild(card);
        });

        reactionResults.appendChild(fragment);
        reactionFooter.innerText = `Checked ${validLevels.length} marked level${validLevels.length > 1 ? 's' : ''} • ${touchedCount} active reaction${touchedCount !== 1 ? 's' : ''} detected on ${dateStr}`;
    }

    // Call init when module loads
    initLevels();
}


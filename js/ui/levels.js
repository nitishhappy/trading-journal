// ===================== LEVELS TAB UI ===================== //
import { viewLevels } from '../dom.js';

if (viewLevels) {
    let allLevels = [];
    let currentMarketPrice = null;
    let chartViewMode = 'focused'; // 'focused' (3 levels above & 3 levels below) or 'all'

    // ===================== LIVE ALERTS STATE =====================
    let liveAlertsInterval = null;
    let alertedLevels = {}; // format: { 'lvl-id': { firstInAlerted: boolean, firstOutAlerted: boolean } }
    let isLiveAlertsOn = false;

    // DOM refs
    const inpSource = document.getElementById('inp-level-source');
    const inpPrice = document.getElementById('inp-level-price');
    const inpBias = document.getElementById('inp-level-bias');
    const inpBehavior = document.getElementById('inp-level-behavior');
    const inpTp = document.getElementById('inp-level-tp');
    const inpSl = document.getElementById('inp-level-sl');
    const filterSourceEl = document.getElementById('filter-level-source');
    
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
    const summaryHeader = document.getElementById('levels-summary-header');
    if (summaryHeader) {
        summaryHeader.addEventListener('click', function() {
            togglePanel('levels-summary-body', this);
        });
    }

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

    // ===================== PERSISTENT SCORECARD STATE ===================== //
    // Scorecard stats persist across days with a single entry per source and survive "Clear All"
    let scorecardStats = {}; // { "BT": { worked: 0, failed: 0, na: 0 }, ... }
    let levelReviewLog = {}; // { [levelId]: { source: "BT", status: "worked" | "failed" | "na" } }

    function loadScorecardHistory() {
        try {
            const savedStats = localStorage.getItem('levelsScorecardHistory');
            if (savedStats) scorecardStats = JSON.parse(savedStats);
        } catch (e) {
            console.error("Error loading levelsScorecardHistory:", e);
            scorecardStats = {};
        }

        try {
            const savedLog = localStorage.getItem('levelsLoggedReviews');
            if (savedLog) levelReviewLog = JSON.parse(savedLog);
        } catch (e) {
            console.error("Error loading levelsLoggedReviews:", e);
            levelReviewLog = {};
        }

        // Ensure all sources from dailyPlanData exist in scorecardStats
        const knownSources = new Set(['BT', 'SM', 'CETA']);
        if (window.dailyPlanData && Array.isArray(window.dailyPlanData)) {
            window.dailyPlanData.forEach(l => {
                if (l.source) knownSources.add(l.source.toUpperCase());
            });
        }
        knownSources.forEach(src => {
            if (!scorecardStats[src]) {
                scorecardStats[src] = { worked: 0, failed: 0, na: 0 };
            }
        });
        saveScorecardHistory();
    }

    function saveScorecardHistory() {
        try {
            localStorage.setItem('levelsScorecardHistory', JSON.stringify(scorecardStats));
            localStorage.setItem('levelsLoggedReviews', JSON.stringify(levelReviewLog));
        } catch (e) {
            console.error("Error saving levelsScorecardHistory:", e);
        }
    }

    function recordLevelOutcome(levelId, newSource, newStatus) {
        const src = (newSource || 'BT').toUpperCase();
        const st = (newStatus || 'na').toLowerCase();

        // Check if levelId was previously recorded
        const prev = levelReviewLog[levelId];
        if (prev) {
            const prevSrc = (prev.source || 'BT').toUpperCase();
            const prevSt = (prev.status || 'na').toLowerCase();

            // Decrement previous status from prev source if exists
            if (scorecardStats[prevSrc] && scorecardStats[prevSrc][prevSt] !== undefined) {
                scorecardStats[prevSrc][prevSt] = Math.max(0, scorecardStats[prevSrc][prevSt] - 1);
            }
        }

        // Ensure target source bucket exists
        if (!scorecardStats[src]) {
            scorecardStats[src] = { worked: 0, failed: 0, na: 0 };
        }

        // Increment new status
        if (scorecardStats[src][st] !== undefined) {
            scorecardStats[src][st]++;
        } else {
            scorecardStats[src][st] = 1;
        }

        // Update review log
        levelReviewLog[levelId] = { source: src, status: st, updatedAt: new Date().toISOString() };

        saveScorecardHistory();
        renderScorecard();
    }

    // Initialize Levels with robust multi-channel sync
    function initLevels(forceSync = false) {
        loadScorecardHistory();

        let loaded = [];
        const saved = localStorage.getItem('dailyTradePlanData');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed)) loaded = parsed;
            } catch (e) {
                console.warn("Could not parse saved dailyTradePlanData:", e);
            }
        }

        // Map existing review statuses by signature (price + behavior) to preserve user selections
        const userStatusMap = {};
        let allWereBT = true;
        loaded.forEach(l => {
            const sig = ((l.rawPrice || l.price || '') + '__' + (l.behavior || '')).trim().toLowerCase();
            if (l.status && l.status !== 'na') {
                userStatusMap[sig] = l.status;
            }
            if (l.source && l.source.toUpperCase() !== 'BT') {
                allWereBT = false;
            }
        });

        // Determine if we should sync from window.dailyPlanData (or goldDailyPlanData):
        const isGold = (window.currentActiveAsset === 'GOLD');
        const planLevelsSource = isGold ? window.goldDailyPlanData : window.dailyPlanData;
        const planLevels = (planLevelsSource && Array.isArray(planLevelsSource)) ? planLevelsSource : [];
        const shouldSyncFromPlan = forceSync || loaded.length === 0 || (loaded.length < planLevels.length) || (allWereBT && planLevels.some(p => (p.source || '').toUpperCase() !== 'BT'));

        const finalLevels = [];
        const seenSignatures = new Set();

        if (shouldSyncFromPlan && planLevels.length > 0) {
            planLevels.forEach((lvl, idx) => {
                const src = (lvl.source || 'BT').toUpperCase();
                const pr = lvl.price || lvl.rawPrice || '';
                const beh = lvl.behavior || '';
                const sig = (pr + '__' + beh).trim().toLowerCase();
                seenSignatures.add(sig);

                const restoredStatus = userStatusMap[sig] || lvl.status || 'na';
                finalLevels.push({
                    id: 'lvl-plan-' + idx + '-' + src.toLowerCase(),
                    source: src,
                    price: pr,
                    bias: lvl.bias || 'neutral',
                    behavior: beh,
                    tp: lvl.tp || '',
                    sl: lvl.sl || '',
                    status: restoredStatus
                });
            });

            // Preserve any user-added custom levels (marked as manual or uploaded)
            loaded.forEach((l, idx) => {
                const pr = l.rawPrice || l.price || '';
                const beh = l.behavior || '';
                const sig = (pr + '__' + beh).trim().toLowerCase();
                if (!seenSignatures.has(sig) && l.id && (l.id.startsWith('lvl-manual-') || l.id.startsWith('lvl-upload-'))) {
                    seenSignatures.add(sig);
                    finalLevels.push({
                        id: l.id,
                        source: (l.source || 'CUSTOM').toUpperCase(),
                        price: pr,
                        bias: l.bias || 'neutral',
                        behavior: beh,
                        tp: l.tp || '',
                        sl: l.sl || '',
                        status: l.status || 'na'
                    });
                }
            });
        } else if (loaded.length > 0) {
            loaded.forEach((l, idx) => {
                finalLevels.push({
                    id: l.id || ('lvl-' + idx),
                    source: (l.source || 'BT').toUpperCase(),
                    price: l.rawPrice || l.price || '',
                    bias: l.bias || 'neutral',
                    behavior: l.behavior || '',
                    tp: l.tp || '',
                    sl: l.sl || '',
                    status: l.status || 'na'
                });
            });
        }

        // Reset list DOM and internal array
        allLevels = [];
        const list = document.getElementById('levels-list');
        if (list) {
            list.innerHTML = `<div class="empty-state-levels" id="levels-empty-state" style="display:none;">No levels mapped yet. Add a level above to build your trade plan.</div>`;
        }

        finalLevels.forEach(lvl => {
            injectLevelCard(
                lvl.id,
                lvl.price,
                lvl.bias,
                lvl.behavior,
                lvl.tp,
                lvl.sl,
                lvl.source,
                lvl.status,
                false
            );
        });

        saveLevelsData();
        renderSummary();
        renderChart();
        renderScorecard();
        updateSourceFilterOptions();
        applySourceFilter();
        runSilentLiveEvaluation();
    }

    function renderSummary() {
        const summaryPanel = document.getElementById('levels-summary-panel');
        const summaryBody = document.getElementById('levels-summary-body');
        if (!summaryPanel || !summaryBody) return;

        const isGold = (window.currentActiveAsset === 'GOLD');
        const summaryData = isGold ? (window.goldDailyPlanSummary || []) : (window.dailyPlanSummary || []);
        if (!Array.isArray(summaryData) || summaryData.length === 0) {
            summaryPanel.style.display = 'none';
            return;
        }

        summaryPanel.style.display = 'block';
        summaryBody.innerHTML = '';
        
        // Clone and reverse to show latest updates on top
        [...summaryData].reverse().forEach((item, index) => {
            const isLatest = (index === 0);
            
            const card = document.createElement('div');
            card.className = `summary-item-card ${isLatest ? 'is-latest' : ''}`;
            
            const header = document.createElement('div');
            header.className = 'summary-item-header';
            
            const headerLeft = document.createElement('div');
            headerLeft.className = 'summary-item-header-left';
            
            const badge = document.createElement('span');
            badge.className = 'source-badge';
            badge.innerText = item.source || 'UNK';
            headerLeft.appendChild(badge);

            const rawText = item.text || '';
            const firstLine = rawText.split('\n')[0].replace(/:$/, '').trim();
            const titleEl = document.createElement('span');
            titleEl.className = 'summary-item-title';
            titleEl.innerText = firstLine || (item.source ? `${item.source} Plan` : 'Summary Entry');
            titleEl.title = firstLine;
            headerLeft.appendChild(titleEl);

            if (isLatest) {
                const latestBadge = document.createElement('span');
                latestBadge.className = 'summary-latest-pill';
                latestBadge.innerText = 'LATEST';
                headerLeft.appendChild(latestBadge);
            }
            
            const toggleIcon = document.createElement('span');
            toggleIcon.className = 'summary-item-toggle';
            toggleIcon.innerText = isLatest ? '▼' : '▶';
            
            header.appendChild(headerLeft);
            header.appendChild(toggleIcon);
            
            const content = document.createElement('div');
            content.className = 'summary-item-body';
            
            // Escape basic HTML to prevent XSS
            let safeText = rawText.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
            
            // Highlight price levels (4 to 5 digit numbers, with optional commas and decimals)
            // e.g., 24,115 or 24090.85 or 24000
            let formattedText = safeText.replace(/\b(\d{1,2},?\d{3}(?:\.\d+)?)\b/g, '<span style="color: #fb923c; font-weight: 700; font-family: \'JetBrains Mono\', monospace;">$1</span>');
            
            // Highlight Green/Bullish Keywords
            formattedText = formattedText.replace(/\b(Longs?|Buy|Buyers?|Buying|Support|Demand|BSL|CE)\b/gi, '<span style="color: #10b981; font-weight: 700;">$&</span>');
            
            // Highlight Red/Bearish Keywords
            formattedText = formattedText.replace(/\b(Shorts?|Sell|Sellers?|Selling|Resistance|Supply|SSL|PE)\b/gi, '<span style="color: #f43f5e; font-weight: 700;">$&</span>');
            
            // Highlight Structural Keywords (Purple)
            formattedText = formattedText.replace(/\b(FVGs?|Fair Value Gaps?|Order Blocks?|OBs?|Liquidity|CHoCH|BOS)\b/gi, '<span style="color: #a855f7; font-weight: 700;">$&</span>');
            
            // Convert newlines to <br> since we are using innerHTML
            formattedText = formattedText.replace(/\n/g, '<br>');
            
            // Parse Markdown Bold
            formattedText = formattedText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            
            content.innerHTML = formattedText;
            content.style.display = isLatest ? 'block' : 'none';
            
            header.addEventListener('click', () => {
                const isHidden = content.style.display === 'none';
                content.style.display = isHidden ? 'block' : 'none';
                toggleIcon.innerText = isHidden ? '▼' : '▶';
            });
            
            card.appendChild(header);
            card.appendChild(content);
            summaryBody.appendChild(card);
        });
    }

    function saveLevelsData() {
        localStorage.setItem('dailyTradePlanData', JSON.stringify(allLevels));
    }

    // Sync Plan button
    const btnSyncPlan = document.getElementById('btn-level-sync');
    if (btnSyncPlan) {
        btnSyncPlan.addEventListener('click', (e) => {
            e.stopPropagation();
            initLevels(true);
            const count = allLevels.length;
            alert(`✅ Synced ${count} levels from Bengal Trader (BT), Stock Marketed (SM), and Chartking Elliott Trading Academy (CETA).`);
        });
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
                            const levelId = 'lvl-upload-' + Date.now() + '-' + idx;
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
        if(confirm("Are you sure you want to clear today's mapped levels? (Scorecard statistics will be kept)")) {
            allLevels = [];
            document.getElementById('levels-list').innerHTML = `<div class="empty-state-levels" id="levels-empty-state">No levels mapped yet. Add a level above to build your trade plan.</div>`;
            saveLevelsData();
            updateCount();
            renderChart();
            renderScorecard();
        }
    });

    const btnScorecardReset = document.getElementById('btn-scorecard-reset');
    if (btnScorecardReset) {
        btnScorecardReset.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm("Reset all historical source prediction statistics across all channels?")) {
                scorecardStats = {};
                levelReviewLog = {};
                saveScorecardHistory();
                renderScorecard();
            }
        });
    }

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
        let src = 'BT';
        if (idx !== -1) {
            allLevels[idx].status = newStatus;
            src = allLevels[idx].source || 'BT';
        } else if (levelReviewLog[id]) {
            src = levelReviewLog[id].source || 'BT';
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

        // Sync in Visual Chart Map annotations
        const chartBtns = document.querySelectorAll(`.chart-status-${id}`);
        chartBtns.forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.status === newStatus) {
                btn.classList.add('active');
            }
        });

        saveLevelsData();
        recordLevelOutcome(id, src, newStatus);
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
            const oldSource = allLevels[idx].source;
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

            if (oldSource !== newSource) {
                recordLevelOutcome(id, newSource, allLevels[idx].status || 'na');
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

        // If card loaded with non-NA status and not yet in persistent log, record it
        if (normStatus !== 'na' && !levelReviewLog[levelId]) {
            recordLevelOutcome(levelId, normSource, normStatus);
        }

        updateCount();
        renderChart();
        renderScorecard();
        updateSourceFilterOptions();
        applySourceFilter();
        if(shouldSave) saveLevelsData();
    }

    function updateCount() {
        // Count only visible cards (respects active source filter)
        const allCards = document.querySelectorAll('.level-card');
        const visibleCount = Array.from(allCards).filter(c => c.style.display !== 'none').length;
        const totalCount = allCards.length;
        const countEl = document.getElementById('level-count');
        if (filterSourceEl && filterSourceEl.value) {
            countEl.innerText = `${visibleCount}/${totalCount} Level${totalCount !== 1 ? 's' : ''}`;
        } else {
            countEl.innerText = `${totalCount} Level${totalCount !== 1 ? 's' : ''}`;
        }
        if (totalCount === 0) {
            const empty = document.getElementById('levels-empty-state');
            if(empty) empty.style.display = 'block';
        }
    }

    // ===================== SOURCE FILTER ===================== //
    function updateSourceFilterOptions() {
        if (!filterSourceEl) return;
        const currentValue = filterSourceEl.value;
        const sources = new Set();
        allLevels.forEach(l => {
            if (l.source) sources.add(l.source.toUpperCase());
        });
        // Keep "All Sources" as first option, rebuild the rest
        filterSourceEl.innerHTML = '<option value="">All Sources</option>';
        Array.from(sources).sort().forEach(src => {
            const opt = document.createElement('option');
            opt.value = src;
            opt.textContent = src;
            filterSourceEl.appendChild(opt);
        });
        // Restore previous selection if it still exists
        if (currentValue && sources.has(currentValue)) {
            filterSourceEl.value = currentValue;
        }
    }

    function applySourceFilter() {
        const selected = filterSourceEl ? filterSourceEl.value : '';
        const cards = document.querySelectorAll('.level-card');
        cards.forEach(card => {
            if (!selected) {
                card.style.display = '';
                return;
            }
            const sourceBadge = card.querySelector('.source-badge');
            const cardSource = sourceBadge ? sourceBadge.innerText.trim().toUpperCase() : '';
            card.style.display = (cardSource === selected) ? '' : 'none';
        });
        updateCount();
    }

    if (filterSourceEl) {
        filterSourceEl.addEventListener('change', applySourceFilter);
    }

    // ===================== EOD PERFORMANCE SCORECARD ===================== //
    function renderScorecard() {
        const tbody = document.getElementById('scorecard-tbody');
        const totalRatioEl = document.getElementById('scorecard-overall-ratio');
        const totalWinrateEl = document.getElementById('scorecard-overall-winrate');
        if (!tbody) return;

        tbody.innerHTML = '';

        const sourceSet = new Set(Object.keys(scorecardStats));
        allLevels.forEach(l => {
            if (l.source) sourceSet.add(l.source.toUpperCase());
        });
        if (window.dailyPlanData && Array.isArray(window.dailyPlanData)) {
            window.dailyPlanData.forEach(l => {
                if (l.source) sourceSet.add(l.source.toUpperCase());
            });
        }
        const sources = Array.from(sourceSet).filter(Boolean).sort();

        // If no sources exist
        if (sources.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-dim); padding:1rem;">No sources available yet.</td></tr>`;
            if (totalRatioEl) totalRatioEl.innerText = '0:0';
            if (totalWinrateEl) {
                totalWinrateEl.innerText = '0%';
                totalWinrateEl.style.color = 'var(--text-dim)';
            }
            return;
        }

        let grandWorked = 0;
        let grandFailed = 0;
        let grandNA = 0;

        sources.forEach(src => {
            const stat = scorecardStats[src] || { worked: 0, failed: 0, na: 0 };
            const w = stat.worked || 0;
            const f = stat.failed || 0;
            const na = stat.na || 0;

            grandWorked += w;
            grandFailed += f;
            grandNA += na;

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
            <td><b>TOTAL / ALL SOURCES</b></td>
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
        const toggleContainer = document.getElementById('chart-view-toggle-container');
        const subtitle = document.getElementById('chart-subtitle');
        if (!area) return;
        area.innerHTML = ''; 

        const validLevels = allLevels.filter(l => !isNaN(l.pHigh));
        
        if(validLevels.length === 0) {
            if (toggleContainer) toggleContainer.innerHTML = '';
            if (subtitle) subtitle.innerText = 'Levels automatically plot here in sequence.';
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

        // Determine active price based on current market price or middle level
        let activePrice = null;
        if (currentMarketPrice !== null && !isNaN(currentMarketPrice)) {
            activePrice = sortedPrices.reduce((closest, p) => 
                Math.abs(p - currentMarketPrice) < Math.abs(closest - currentMarketPrice) ? p : closest, sortedPrices[0]);
        } else {
            const floaterVal = document.getElementById('floater-price-val');
            const parsedFloater = floaterVal ? parseFloat(floaterVal.innerText.replace(/,/g, '')) : null;
            if (parsedFloater && !isNaN(parsedFloater)) {
                currentMarketPrice = parsedFloater;
                activePrice = sortedPrices.reduce((closest, p) => 
                    Math.abs(p - currentMarketPrice) < Math.abs(closest - currentMarketPrice) ? p : closest, sortedPrices[0]);
            } else {
                const midIndex = Math.floor(sortedPrices.length / 2);
                activePrice = sortedPrices[midIndex];
            }
        }

        const activeIndex = sortedPrices.indexOf(activePrice);

        // Determine visible prices subset (3 above, active level, 3 below = 6-7 levels)
        let visiblePrices = sortedPrices;
        if (chartViewMode === 'focused' && sortedPrices.length > 7) {
            let startIdx = activeIndex - 3;
            let endIdx = activeIndex + 3;
            
            if (startIdx < 0) {
                endIdx = Math.min(sortedPrices.length - 1, endIdx - startIdx);
                startIdx = 0;
            }
            if (endIdx >= sortedPrices.length) {
                startIdx = Math.max(0, startIdx - (endIdx - sortedPrices.length + 1));
                endIdx = sortedPrices.length - 1;
            }
            
            visiblePrices = sortedPrices.slice(startIdx, endIdx + 1);
        }

        // Render mode toggle pill and subtitle
        if (toggleContainer) {
            if (sortedPrices.length > 7) {
                toggleContainer.innerHTML = `
                    <button type="button" id="btn-toggle-chart-mode" class="chart-mode-pill" style="font-size: 0.72rem; padding: 3px 9px; border-radius: 12px; border: 1px solid var(--border); background: var(--surface-1); color: var(--text-dim); cursor: pointer; display: inline-flex; align-items: center; gap: 5px; font-weight: 600; transition: all 0.2s ease;">
                        <span>${chartViewMode === 'focused' ? '🎯 Focused (±3)' : '🌐 All Levels'}</span>
                        <span style="color: var(--accent); font-size: 0.68rem; font-family: 'JetBrains Mono', monospace;">(${visiblePrices.length}/${sortedPrices.length})</span>
                    </button>
                `;
                const btnToggle = document.getElementById('btn-toggle-chart-mode');
                if (btnToggle) {
                    btnToggle.addEventListener('click', () => {
                        chartViewMode = (chartViewMode === 'focused') ? 'all' : 'focused';
                        renderChart();
                    });
                }
            } else {
                toggleContainer.innerHTML = '';
            }
        }

        if (subtitle) {
            if (chartViewMode === 'focused' && sortedPrices.length > 7) {
                const currentLabel = currentMarketPrice ? `₹${currentMarketPrice.toLocaleString('en-IN')}` : `₹${activePrice}`;
                subtitle.innerText = `Showing 3 levels above & 3 below current level (${currentLabel}).`;
            } else {
                subtitle.innerText = `Levels automatically plot here in sequence (${sortedPrices.length} total levels).`;
            }
        }

        visiblePrices.forEach(price => {
            const levelsInGroup = grouped[price];
            const isCurrentPriceLevel = (price === activePrice);
            
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

                const isExpandedByDefault = (chartViewMode === 'all') || isCurrentPriceLevel;

                const ann = document.createElement('div');
                ann.className = `chart-annotation ${isExpandedByDefault ? 'is-expanded-level' : 'is-collapsed-level'} ${isCurrentPriceLevel ? 'is-active-level' : ''}`;
                ann.id = `chart-card-${lvl.id}`;
                ann.style.border = '1px solid ' + cColor;
                ann.style.borderLeft = '4px solid ' + cColor;
                ann.style.background = `color-mix(in srgb, ${cColor} 8%, var(--surface-1))`;
                ann.style.boxShadow = `0 4px 15px color-mix(in srgb, ${cColor} 10%, transparent)`;
                
                let rangeText = '';
                if (lvl.isRange) {
                    rangeText = ` <span style="color:var(--text-dim); font-size:0.8em; font-family:'JetBrains Mono', monospace;">(${lvl.pHigh} - ${lvl.pLow})</span>`;
                }

                const srcTag = lvl.source ? `<span class="source-badge" style="font-size:0.72rem; margin-right:4px;">${lvl.source}</span>` : '';
                const rawBehavior = (lvl.behavior || '').trim();
                const previewText = rawBehavior.length > 40 ? rawBehavior.slice(0, 40) + '…' : rawBehavior;

                ann.innerHTML = `
                    <div class="chart-annotation-header" style="display:flex; align-items:center; justify-content:space-between; gap:6px;">
                        <div style="display:flex; align-items:center; gap:4px; flex:1; min-width:0;">
                            ${srcTag}
                            <span class="badge ${lvl.bias}" style="font-size:0.75rem; padding:2px 6px;">${lvl.biasBadge}${rangeText}</span>
                        </div>
                        <div style="display:flex; align-items:center; gap:6px;">
                            <div class="chart-status-group" style="display:flex; gap:3px;">
                                <button type="button" class="status-btn status-worked chart-status-${lvl.id} ${lvl.status === 'worked' ? 'active' : ''}" data-status="worked" onclick="event.stopPropagation(); window.setLevelStatus('${lvl.id}', 'worked')" style="font-size:0.65rem; padding:2px 5px;" title="Worked">✅</button>
                                <button type="button" class="status-btn status-failed chart-status-${lvl.id} ${lvl.status === 'failed' ? 'active' : ''}" data-status="failed" onclick="event.stopPropagation(); window.setLevelStatus('${lvl.id}', 'failed')" style="font-size:0.65rem; padding:2px 5px;" title="Failed">❌</button>
                                <button type="button" class="status-btn status-na chart-status-${lvl.id} ${lvl.status === 'na' ? 'active' : ''}" data-status="na" onclick="event.stopPropagation(); window.setLevelStatus('${lvl.id}', 'na')" style="font-size:0.65rem; padding:2px 5px;" title="NA">⚪</button>
                            </div>
                            <span class="chart-annotation-toggle" style="font-size:0.75rem; color:var(--text-dim); margin-left:2px;">${isExpandedByDefault ? '▼' : '▶'}</span>
                        </div>
                    </div>
                    <div class="chart-annotation-preview" style="display:${isExpandedByDefault ? 'none' : 'block'}; font-size:0.8rem; color:var(--text-dim); margin-top:4px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                        ${previewText}
                    </div>
                    <div class="chart-annotation-body" style="display:${isExpandedByDefault ? 'block' : 'none'}; margin-top:0.5rem; padding-top:0.5rem; border-top:1px solid rgba(255, 255, 255, 0.05);">
                        <div class="text" style="line-height:1.5; color:var(--text); font-size:0.92rem;">${rawBehavior}</div>
                        <div style="margin-top:0.75rem; font-size:0.8rem; color:var(--text-dim); display:flex; justify-content:space-between; font-family:'JetBrains Mono', monospace;">
                            <span>TP: <strong style="color:var(--success);">${lvl.tp||'Open'}</strong></span>
                            <span>SL: <strong style="color:var(--danger);">${lvl.sl||'Manual'}</strong></span>
                        </div>
                    </div>
                `;

                ann.addEventListener('click', (e) => {
                    if (e.target.closest('.status-btn')) return;
                    const body = ann.querySelector('.chart-annotation-body');
                    const preview = ann.querySelector('.chart-annotation-preview');
                    const toggleIcon = ann.querySelector('.chart-annotation-toggle');
                    
                    if (body.style.display === 'none') {
                        body.style.display = 'block';
                        if (preview) preview.style.display = 'none';
                        if (toggleIcon) toggleIcon.innerText = '▼';
                        ann.classList.remove('is-collapsed-level');
                        ann.classList.add('is-expanded-level');
                    } else {
                        body.style.display = 'none';
                        if (preview) preview.style.display = 'block';
                        if (toggleIcon) toggleIcon.innerText = '▶';
                        ann.classList.remove('is-expanded-level');
                        ann.classList.add('is-collapsed-level');
                    }
                });

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
        const ts = Date.now();
        // 1. Try serverless backend route first
        try {
            const res = await fetch(`/api/niftyCandles?date=${encodeURIComponent(dateStr)}&_t=${ts}`, { cache: 'no-store' });
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
                const intraRes = await fetch(`https://api.upstox.com/v2/historical-candle/intraday/${encInst}/1minute?_t=${ts}`, { cache: 'no-store' });
                if (intraRes.ok) {
                    const data = await intraRes.json();
                    rawCandles = data?.data?.candles || [];
                }
            }

            if (!rawCandles || rawCandles.length === 0) {
                const histRes = await fetch(`https://api.upstox.com/v2/historical-candle/${encInst}/1minute/${dateStr}/${dateStr}?_t=${ts}`, { cache: 'no-store' });
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

    // ===================== LIVE ALERTS LOGIC =====================
    const btnLiveAlerts = document.getElementById('btn-live-alerts');
    let liveAlertWorker = null;
    
    // Restore persisted state on load
    if (localStorage.getItem('liveAlertsOn') === 'true') {
        // Auto-resume on page load if it was on
        setTimeout(async () => {
            if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
                startLiveAlerts(true); // silent = true, no toast on auto-resume
            }
        }, 2000);
    }

    if (btnLiveAlerts) {
        btnLiveAlerts.addEventListener('click', async () => {
            if (isLiveAlertsOn) {
                stopLiveAlerts();
            } else {
                if (typeof Notification !== 'undefined' && Notification.permission !== 'granted') {
                    const p = await Notification.requestPermission();
                    if (p !== 'granted') {
                        import('../utils/toast.js').then(m => m.showToast("Push notifications blocked."));
                        return;
                    }
                }
                startLiveAlerts(false);
            }
        });
    }

    function startLiveAlerts(silent) {
        isLiveAlertsOn = true;
        localStorage.setItem('liveAlertsOn', 'true');
        if (btnLiveAlerts) {
            btnLiveAlerts.classList.remove('off');
            btnLiveAlerts.classList.add('on');
            btnLiveAlerts.innerHTML = `<span class="btn-icon">🟢</span> Live Alerts On`;
        }
        if (!silent) {
            import('../utils/toast.js').then(m => m.showToast("Live background listener started (polling every 1 min)"));
        }
        
        // Immediately run once
        runSilentLiveEvaluation();
        
        // Use Web Worker for timer — mobile browsers don't throttle workers
        // even when the tab is in the background
        try {
            if (liveAlertWorker) liveAlertWorker.terminate();
            liveAlertWorker = new Worker('./js/workers/liveAlertWorker.js');
            liveAlertWorker.addEventListener('message', (e) => {
                if (e.data && e.data.type === 'tick') {
                    runSilentLiveEvaluation();
                }
            });
            liveAlertWorker.postMessage({ command: 'start', interval: 60000 });
        } catch (workerErr) {
            // Fallback to setInterval if Worker fails (e.g. file blocked)
            console.warn('Web Worker unavailable, falling back to setInterval', workerErr);
            if (liveAlertsInterval) clearInterval(liveAlertsInterval);
            liveAlertsInterval = setInterval(runSilentLiveEvaluation, 60000);
        }
    }

    function stopLiveAlerts() {
        isLiveAlertsOn = false;
        localStorage.setItem('liveAlertsOn', 'false');
        if (btnLiveAlerts) {
            btnLiveAlerts.classList.remove('on');
            btnLiveAlerts.classList.add('off');
            btnLiveAlerts.innerHTML = `<span class="btn-icon">🔴</span> Live Alerts Off`;
        }
        
        // Terminate worker
        if (liveAlertWorker) {
            liveAlertWorker.postMessage({ command: 'stop' });
            liveAlertWorker.terminate();
            liveAlertWorker = null;
        }
        // Clear fallback interval too
        if (liveAlertsInterval) clearInterval(liveAlertsInterval);
        liveAlertsInterval = null;
        
        import('../utils/toast.js').then(m => m.showToast("Live alerts paused"));
    }

    let isLevelsViewActive = true;
    let levelsPollingInterval = null;

    function startLevelsPolling() {
        if (levelsPollingInterval) clearInterval(levelsPollingInterval);
        levelsPollingInterval = setInterval(() => {
            if (isLevelsViewActive) {
                runSilentLiveEvaluation();
            }
        }, 15000);
    }

    function stopLevelsPolling() {
        if (levelsPollingInterval) {
            clearInterval(levelsPollingInterval);
            levelsPollingInterval = null;
        }
    }

    // Safety net: when user switches back to this tab, immediately re-evaluate
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            if (isLevelsViewActive || isLiveAlertsOn) {
                runSilentLiveEvaluation();
            }
            if (isLevelsViewActive) {
                startLevelsPolling();
            }
        } else {
            if (!isLiveAlertsOn) {
                stopLevelsPolling();
            }
        }
    });

    function isMarketOpen() {
        const now = new Date();
        // IST checks
        const istTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
        const day = istTime.getDay();
        if (day === 0 || day === 6) return false; // Weekend
        const hours = istTime.getHours();
        const mins = istTime.getMinutes();
        const timeVal = hours * 100 + mins;
        return timeVal >= 915 && timeVal <= 1530; // 09:15 to 15:30
    }

    let hasAutoScrolledOnLoad = false;

    function scrollToActiveChartLevel() {
        const highlightedChartAnn = document.querySelector('.chart-annotation.active-level-highlight');
        if (!highlightedChartAnn) return;

        setTimeout(() => {
            highlightedChartAnn.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 150);
    }

    async function runSilentLiveEvaluation(options = {}) {
        const { forceScroll = false } = options;
        
        const validLevels = allLevels.filter(l => !isNaN(l.pHigh));
        if (validLevels.length === 0) return;

        let currentPrice = null;
        let isGold = (window.currentActiveAsset === 'GOLD');

        try {
            const res = await fetch('/api/livePrices');
            if (res.ok) {
                const data = await res.json();
                if (data && data.success) {
                    currentPrice = isGold ? data.xauusd : data.nifty;
                }
            }
        } catch (e) {
            console.error("Live price fetch failed:", e);
        }
        
        if (!currentPrice) return;

        const floater = document.getElementById('level-price-floater');
        const floaterVal = document.getElementById('floater-price-val');
        const floaterTitle = document.getElementById('floater-title-text');
        
        if (floaterTitle) {
            floaterTitle.innerText = isGold ? "GOLD LIVE" : "NIFTY LIVE";
        }
        
        const prevPrice = currentMarketPrice;
        currentMarketPrice = currentPrice;
        
        if (floater && floaterVal && !floater.classList.contains('user-closed')) {
            const oldPrice = parseFloat(floaterVal.innerText.replace(/,/g, '')) || 0;
            const locale = isGold ? 'en-US' : 'en-IN';
            const formattedPrice = currentPrice.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            floaterVal.innerText = formattedPrice;
            if (oldPrice && currentPrice !== oldPrice) {
                const cls = currentPrice > oldPrice ? 'tick-up' : 'tick-down';
                floaterVal.classList.add(cls);
                setTimeout(() => floaterVal.classList.remove(cls), 1000);
            }
            if (floaterTitle) {
                floaterTitle.setAttribute('data-price', formattedPrice);
            }
            floater.classList.remove('hidden');
        }

        if (prevPrice === null || Math.abs(prevPrice - currentPrice) > 5) {
            renderChart();
        }

        let insideLevels = [];
        let aboveLevels = [];
        let belowLevels = [];
        const price = currentPrice;

        validLevels.forEach(lvl => {
            const margin = lvl.isRange ? 0 : 15;
            const effectiveHigh = lvl.pHigh + margin;
            const effectiveLow = lvl.pLow - margin;
            
            if (price <= effectiveHigh && price >= effectiveLow) {
                insideLevels.push(lvl);
            } else if (effectiveLow > price) {
                aboveLevels.push(lvl);
            } else if (effectiveHigh < price) {
                belowLevels.push(lvl);
            }
        });

        let levelsToHighlight = [];
        if (insideLevels.length > 0) {
            levelsToHighlight = insideLevels;
        } else {
            if (aboveLevels.length > 0) {
                aboveLevels.sort((a, b) => a.pLow - b.pLow);
                levelsToHighlight.push(aboveLevels[0]);
            }
            if (belowLevels.length > 0) {
                belowLevels.sort((a, b) => b.pHigh - a.pHigh);
                levelsToHighlight.push(belowLevels[0]);
            }
        }
        
        const highlightIds = new Set(levelsToHighlight.map(l => l.id));

        validLevels.forEach(lvl => {
            const lHigh = lvl.pHigh;
            const lLow = lvl.pLow;
            
            // Visual Highlight Logic
            const cardEl = document.getElementById(lvl.id);
            const chartCardEl = document.getElementById(`chart-card-${lvl.id}`);
            const isHighlighted = highlightIds.has(lvl.id);
            
            if (cardEl) {
                if (isHighlighted) {
                    cardEl.classList.add('active-level-highlight');
                } else {
                    cardEl.classList.remove('active-level-highlight');
                }
            }
            if (chartCardEl) {
                if (isHighlighted) {
                    chartCardEl.classList.add('active-level-highlight');
                } else {
                    chartCardEl.classList.remove('active-level-highlight');
                }
            }

            // Only trigger push alerts during active market hours
            if (isMarketOpen()) {
                let firstIn = null;
                let firstOut = null;

                for (let idx = 0; idx < candles.length; idx++) {
                    const c = candles[idx];

                    if (!firstIn) {
                        if (c.low <= lHigh && c.high >= lLow) {
                            firstIn = c;
                        }
                    } else {
                        if (!firstOut && idx > candles.indexOf(firstIn)) {
                            if (c.close > lHigh) firstOut = { candle: c, dir: 'above' };
                            else if (c.close < lLow) firstOut = { candle: c, dir: 'below' };
                        }
                    }
                }

                // Initialize state for this level if missing
                if (!alertedLevels[lvl.id]) {
                    alertedLevels[lvl.id] = { in: false, out: false };
                }

                const state = alertedLevels[lvl.id];

                // Trigger IN alert
                if (firstIn && !state.in) {
                    state.in = true;
                    const msg = `Nifty entered level: ${lvl.rawPrice} (${lvl.behavior || lvl.bias})`;
                    triggerSystemAlert(`Level Entry: ${lvl.source || 'BT'}`, msg);
                }

                // Trigger OUT alert
                if (firstOut && !state.out) {
                    state.out = true;
                    const msg = `Nifty closed strictly ${firstOut.dir} level ${lvl.rawPrice}`;
                    triggerSystemAlert(`Level Exit: ${lvl.source || 'BT'}`, msg);
                }
            }
        });

        // Auto-scroll ONLY to active chart annotation on Visual Chart Map on initial load once (never touches Mapped Levels panel)
        if (levelsToHighlight.length > 0 && !hasAutoScrolledOnLoad && forceScroll) {
            scrollToActiveChartLevel();
            hasAutoScrolledOnLoad = true;
        }
    }

    function triggerSystemAlert(title, body) {
        // In-app toast
        import('../utils/toast.js').then(m => m.showToast(`🚨 ${title}: ${body}`, 8000));
        
        // OS Notification
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            const options = {
                body,
                icon: './icons/icon-192.png',
                badge: './icons/icon-192.png',
                vibrate: [200, 100, 200]
            };
            if (navigator.serviceWorker) {
                navigator.serviceWorker.getRegistration().then(reg => {
                    if (reg) reg.showNotification(title, options);
                    else new Notification(title, options);
                }).catch(() => new Notification(title, options));
            } else {
                new Notification(title, options);
            }
        }
    }

    const floaterToggleBtn = document.getElementById('btn-toggle-floater');
    const floater = document.getElementById('level-price-floater');
    if (floaterToggleBtn && floater) {
        floaterToggleBtn.addEventListener('click', () => {
            floater.classList.toggle('minimized');
            if (floater.classList.contains('minimized')) {
                floaterToggleBtn.innerText = '+';
            } else {
                floaterToggleBtn.innerText = '−';
            }
        });
    }

    // Floater Drag Logic
    const floaterHeader = floater ? floater.querySelector('.floater-header') : null;
    if (floaterHeader && floater) {
        let isDragging = false;
        let startX, startY, initialLeft, initialTop;

        const onMouseMove = (e) => {
            if (!isDragging) return;
            if (e.cancelable && e.type.includes('touch')) e.preventDefault(); // prevent scroll while dragging
            const clientX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
            const clientY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;
            
            const dx = clientX - startX;
            const dy = clientY - startY;
            
            floater.style.right = 'auto';
            floater.style.bottom = 'auto';
            floater.style.left = `${initialLeft + dx}px`;
            floater.style.top = `${initialTop + dy}px`;
        };

        const onMouseUp = () => {
            if (!isDragging) return;
            isDragging = false;
            floater.style.transition = '';
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('touchmove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            document.removeEventListener('touchend', onMouseUp);
        };

        const onMouseDown = (e) => {
            if (e.target.closest('.btn-close-floater')) return;
            isDragging = true;
            startX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
            startY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;
            
            const rect = floater.getBoundingClientRect();
            initialLeft = rect.left;
            initialTop = rect.top;

            floater.style.transition = 'none';
            floater.style.right = 'auto';
            floater.style.bottom = 'auto';
            floater.style.left = `${initialLeft}px`;
            floater.style.top = `${initialTop}px`;

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('touchmove', onMouseMove, { passive: false });
            document.addEventListener('mouseup', onMouseUp);
            document.addEventListener('touchend', onMouseUp);
        };
        
        floaterHeader.addEventListener('mousedown', onMouseDown);
        floaterHeader.addEventListener('touchstart', onMouseDown, { passive: false });
    }



    // Listen for tab view changes to trigger evaluation and live price polling
    window.addEventListener('view-changed', (e) => {
        if (e.detail && e.detail.view === 'levels') {
            isLevelsViewActive = true;
            runSilentLiveEvaluation({ forceScroll: !hasAutoScrolledOnLoad });
            startLevelsPolling();
        } else {
            isLevelsViewActive = false;
            if (!isLiveAlertsOn) {
                stopLevelsPolling();
            }
        }
    });

    const btnNifty = document.getElementById('btn-asset-nifty');
    const btnGold = document.getElementById('btn-asset-gold');
    if (btnNifty && btnGold) {
        btnNifty.addEventListener('click', () => {
            window.currentActiveAsset = 'NIFTY';
            btnNifty.className = 'btn-primary';
            btnGold.className = 'btn-secondary';
            initLevels(true);
        });
        btnGold.addEventListener('click', () => {
            window.currentActiveAsset = 'GOLD';
            btnGold.className = 'btn-primary';
            btnNifty.className = 'btn-secondary';
            initLevels(true);
        });
    }

    // Call init when module loads
    window.currentActiveAsset = 'NIFTY';
    initLevels();
    startLevelsPolling();
}


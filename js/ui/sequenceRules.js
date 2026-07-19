import { state } from '../state.js';
import { showToast } from '../utils/toast.js';
import {
  createSequenceRule,
  updateSequenceRule,
  deleteSequenceRule,
  updateTriggerLogOutcome,
  deleteTriggerLog,
  subscribeSequenceRules,
  subscribeSequenceTriggerLogs,
  subscribeSequenceStates,
  unsubscribeSequenceRules,
  unsubscribeSequenceTriggerLogs,
  unsubscribeSequenceStates
} from '../services/sequenceRules.js';

// DOM refs
const seqCreateRuleBtn   = document.getElementById('seq-create-rule-btn');
const seqRulesList       = document.getElementById('seq-rules-list');
const seqLogsList        = document.getElementById('seq-logs-list');
const seqAutocleanToggle = document.getElementById('seq-autoclean-toggle');

// Modal DOM refs
const seqRuleModal       = document.getElementById('seq-rule-modal');
const seqRuleModalTitle  = document.getElementById('seq-rule-modal-title');
const seqRuleModalClose  = document.getElementById('seq-rule-modal-close');
const seqRuleName        = document.getElementById('seq-rule-name');
const seqStepsContainer  = document.getElementById('seq-steps-container');
const seqAddStepBtn      = document.getElementById('seq-add-step-btn');
const seqRuleEnabled     = document.getElementById('seq-rule-enabled');
const seqRuleDeleteBtn   = document.getElementById('seq-rule-delete-btn');
const seqRuleCancelBtn   = document.getElementById('seq-rule-cancel-btn');
const seqRuleSaveBtn     = document.getElementById('seq-rule-save-btn');

let editingRuleId = null;

// ===================== Init =====================
export function initSequenceRulesUI() {
  if (seqCreateRuleBtn) {
    seqCreateRuleBtn.addEventListener('click', () => openRuleModal());
  }
  if (seqRuleModalClose) {
    seqRuleModalClose.addEventListener('click', closeRuleModal);
  }
  if (seqRuleCancelBtn) {
    seqRuleCancelBtn.addEventListener('click', closeRuleModal);
  }
  if (seqAddStepBtn) {
    seqAddStepBtn.addEventListener('click', () => addStepInput(''));
  }
  if (seqRuleSaveBtn) {
    seqRuleSaveBtn.addEventListener('click', handleSaveRule);
  }
  if (seqRuleDeleteBtn) {
    seqRuleDeleteBtn.addEventListener('click', handleDeleteRule);
  }

  // Handle auto-clean config toggle
  if (seqAutocleanToggle) {
    // Load config from preferences
    window.addEventListener('settings-loaded', () => {
      const isClean = state.currentUser ? (db.collection('users').doc(state.currentUser.uid).collection('settings').doc('preferences').get().then(doc => {
        if (doc.exists && doc.data().triggerLogAutoClean !== undefined) {
          seqAutocleanToggle.checked = doc.data().triggerLogAutoClean;
        }
      })) : true;
    });

    seqAutocleanToggle.addEventListener('change', async () => {
      if (!state.currentUser) return;
      const val = seqAutocleanToggle.checked;
      try {
        await db.collection('users').doc(state.currentUser.uid)
          .collection('settings').doc('preferences')
          .set({ triggerLogAutoClean: val }, { merge: true });
        showToast(`Auto-clean ${val ? 'enabled' : 'disabled'}`);
      } catch (err) {
        showToast('Could not save setting');
      }
    });
  }

  // Live updates
  window.addEventListener('sequence-rules-updated', () => {
    renderRules();
  });
  window.addEventListener('sequence-logs-updated', () => {
    renderLogs();
  });
  window.addEventListener('sequence-states-updated', () => {
    renderRules();
  });

  window.addEventListener('view-changed', (e) => {
    if (e.detail.view === 'tvNotifications') {
      subscribeSequenceRules();
      subscribeSequenceTriggerLogs();
      subscribeSequenceStates();
    } else {
      unsubscribeSequenceRules();
      unsubscribeSequenceTriggerLogs();
      unsubscribeSequenceStates();
    }
  });
}

// ===================== Rule Modal Handlers =====================
function openRuleModal(rule = null) {
  if (rule) {
    editingRuleId = rule.id;
    seqRuleModalTitle.textContent = 'Edit Sequence Rule';
    seqRuleName.value = rule.name || '';
    seqRuleEnabled.checked = rule.enabled !== false;
    seqStepsContainer.innerHTML = '';
    if (rule.steps && rule.steps.length > 0) {
      rule.steps.forEach(step => addStepInput(step));
    } else {
      addStepInput('');
    }
    seqRuleDeleteBtn.classList.remove('hidden');
  } else {
    editingRuleId = null;
    seqRuleModalTitle.textContent = 'New Sequence Rule';
    seqRuleName.value = '';
    seqRuleEnabled.checked = true;
    seqStepsContainer.innerHTML = '';
    addStepInput('');
    seqRuleDeleteBtn.classList.add('hidden');
  }
  seqRuleModal.classList.remove('hidden');
}

function closeRuleModal() {
  seqRuleModal.classList.add('hidden');
  editingRuleId = null;
}

function getUniqueKeywords() {
  const defaults = ['price_below_ema9', 'price_above_ema9', 'rsi_overbought', 'rsi_oversold'];
  
  // Extract keywords from TV notifications
  const fromNotifs = (state.tvNotifications || [])
    .map(n => n.keyword || n.strategy)
    .filter(Boolean)
    .map(k => k.trim());

  // Extract keywords configured in existing sequence rules
  const fromRules = (state.sequenceRules || [])
    .flatMap(r => r.steps || [])
    .filter(Boolean)
    .map(k => k.trim());

  return Array.from(new Set([...defaults, ...fromNotifs, ...fromRules]));
}

function addStepInput(value = '') {
  const currentCount = seqStepsContainer.children.length;
  if (currentCount >= 5) {
    showToast('Maximum of 5 steps allowed');
    return;
  }

  const stepRow = document.createElement('div');
  stepRow.className = 'seq-step-row';
  stepRow.style.display = 'flex';
  stepRow.style.gap = '8px';
  stepRow.style.alignItems = 'flex-start';
  stepRow.style.marginBottom = '8px';

  const label = document.createElement('span');
  label.style.fontFamily = 'var(--font-mono)';
  label.style.fontSize = '12px';
  label.style.width = '24px';
  label.style.marginTop = '10px';
  label.textContent = `M${currentCount + 1}`;

  const selectWrapper = document.createElement('div');
  selectWrapper.style.flex = '1';
  selectWrapper.style.display = 'flex';
  selectWrapper.style.flexDirection = 'column';
  selectWrapper.style.gap = '4px';

  const select = document.createElement('select');
  select.className = 'seq-step-select';
  select.style.width = '100%';

  const placeholderOpt = document.createElement('option');
  placeholderOpt.value = '';
  placeholderOpt.textContent = '-- Select Keyword --';
  select.appendChild(placeholderOpt);

  const keywords = getUniqueKeywords();
  let valueMatched = false;
  keywords.forEach(kw => {
    const opt = document.createElement('option');
    opt.value = kw;
    opt.textContent = kw;
    if (value && kw.toLowerCase() === value.trim().toLowerCase()) {
      opt.selected = true;
      valueMatched = true;
    }
    select.appendChild(opt);
  });

  const customOpt = document.createElement('option');
  customOpt.value = '__CUSTOM__';
  customOpt.textContent = '+ Enter Custom Keyword...';
  if (value && !valueMatched) {
    customOpt.selected = true;
  }
  select.appendChild(customOpt);

  const customInput = document.createElement('input');
  customInput.type = 'text';
  customInput.className = 'seq-step-custom-input';
  customInput.placeholder = 'Type custom signal keyword';
  customInput.style.display = (value && !valueMatched) ? 'block' : 'none';
  customInput.style.width = '100%';
  customInput.value = (value && !valueMatched) ? value : '';

  select.addEventListener('change', () => {
    if (select.value === '__CUSTOM__') {
      customInput.style.display = 'block';
      customInput.focus();
    } else {
      customInput.style.display = 'none';
      customInput.value = '';
    }
  });

  selectWrapper.appendChild(select);
  selectWrapper.appendChild(customInput);

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'icon-btn';
  removeBtn.textContent = '✕';
  removeBtn.style.marginTop = '6px';
  removeBtn.addEventListener('click', () => {
    stepRow.remove();
    // Renumber steps
    Array.from(seqStepsContainer.children).forEach((row, idx) => {
      row.querySelector('span').textContent = `M${idx + 1}`;
    });
  });

  stepRow.appendChild(label);
  stepRow.appendChild(selectWrapper);
  stepRow.appendChild(removeBtn);
  seqStepsContainer.appendChild(stepRow);
}

async function handleSaveRule() {
  const name = seqRuleName.value.trim();
  if (!name) {
    showToast('Rule name is required');
    return;
  }

  const steps = Array.from(seqStepsContainer.querySelectorAll('.seq-step-row'))
    .map(row => {
      const select = row.querySelector('.seq-step-select');
      const customInput = row.querySelector('.seq-step-custom-input');
      if (select.value === '__CUSTOM__') {
        return customInput.value.trim();
      }
      return select.value.trim();
    })
    .filter(Boolean);

  if (steps.length < 2) {
    showToast('Provide at least 2 sequence steps');
    return;
  }

  try {
    if (editingRuleId) {
      await updateSequenceRule(editingRuleId, name, steps, seqRuleEnabled.checked);
      showToast('Sequence rule updated');
    } else {
      await createSequenceRule(name, steps, seqRuleEnabled.checked);
      showToast('Sequence rule created');
    }
    closeRuleModal();
  } catch (err) {
    showToast('Error saving rule: ' + err.message);
  }
}

async function handleDeleteRule() {
  if (!editingRuleId) return;
  if (!confirm('Are you sure you want to delete this sequence rule? All active sequence tracking states for it will be wiped.')) return;

  try {
    await deleteSequenceRule(editingRuleId);
    showToast('Sequence rule deleted');
    closeRuleModal();
  } catch (err) {
    showToast('Error deleting rule: ' + err.message);
  }
}

// ===================== Rendering =====================

function renderRules() {
  if (!seqRulesList) return;
  const rules = state.sequenceRules || [];

  if (rules.length === 0) {
    seqRulesList.innerHTML = '<p class="settings-hint">No rules configured. Click "+ New Rule" to create one.</p>';
    return;
  }

  seqRulesList.innerHTML = '';
  rules.forEach(rule => {
    const card = document.createElement('div');
    card.className = `seq-rule-card ${rule.enabled ? '' : 'disabled'}`;

    const stepsFlowHtml = rule.steps.map((s, idx) => `<span class="seq-step-pill" title="${s}">M${idx + 1}: ${s}</span>`).join(' → ');

    // Find any active state progress for this rule
    const activeStates = (state.sequenceStates || []).filter(st => st.ruleId === rule.id);
    let statesProgressHtml = '';
    if (activeStates.length > 0) {
      statesProgressHtml = `
        <div class="seq-active-states" style="margin-top: 10px; padding-top: 8px; border-top: 1px dashed var(--border); font-size: 11px;">
          <span style="color: var(--accent); font-weight: 500;">Active Sequences:</span>
          <div style="display: flex; flex-direction: column; gap: 4px; margin-top: 4px;">
            ${activeStates.map(st => `
              <div style="display: flex; justify-content: space-between;">
                <span>🪙 <b>${st.symbol}</b></span>
                <span style="font-family: var(--font-mono);">Step ${st.stepIndex}/${rule.steps.length} (${st.lastMatchedTF || '—'})</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    card.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <h4 style="margin:0; font-weight:600;">${rule.name}</h4>
        <span style="font-size:11px; color: ${rule.enabled ? 'var(--low)' : 'var(--text-dim)'};">${rule.enabled ? 'Enabled' : 'Disabled'}</span>
      </div>
      <div class="seq-steps-flow" style="display:flex; flex-wrap:wrap; gap:6px; font-size:12px; line-height: 1.8;">
        ${stepsFlowHtml}
      </div>
      ${statesProgressHtml}
      <button class="btn-small btn-secondary edit-rule-btn">Edit</button>
    `;

    card.querySelector('.edit-rule-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      openRuleModal(rule);
    });

    seqRulesList.appendChild(card);
  });
}

function renderLogs() {
  if (!seqLogsList) return;
  const logs = state.sequenceTriggerLogs || [];

  if (logs.length === 0) {
    seqLogsList.innerHTML = '<p class="settings-hint">No trigger events captured yet.</p>';
    return;
  }

  seqLogsList.innerHTML = '';
  logs.forEach(log => {
    const card = document.createElement('div');
    card.className = 'seq-log-card';
    card.style.background = 'var(--surface-2)';
    card.style.border = '1px solid var(--border)';
    card.style.borderRadius = '8px';
    card.style.padding = '12px';
    card.style.marginBottom = '8px';

    const ts = log.triggeredAt?.toDate ? log.triggeredAt.toDate() : new Date();
    const dateStr = ts.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true
    });

    const isPending = !log.outcome || log.outcome === 'PENDING';
    const isProfit  = log.outcome === 'PROFIT';
    const isLoss    = log.outcome === 'LOSS';

    card.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
        <div>
          <span style="font-size:11px; text-transform:uppercase; font-family:var(--font-mono); color:var(--accent); font-weight:bold;">${log.ruleName || 'Sequence Alert'}</span>
          <h4 style="margin:2px 0 0; font-weight:600;">${log.symbol} · ${log.timeframe || '—'}</h4>
        </div>
        <div style="text-align:right;">
          <span style="font-size:11px; color:var(--text-dim);">${dateStr}</span>
          <div style="font-size:13px; font-weight:bold; margin-top:2px;">₹${(log.price || 0).toLocaleString('en-IN')}</div>
        </div>
      </div>
      <div style="display:flex; gap:8px; align-items:center; margin-top:10px;">
        <select class="seq-log-outcome" style="padding:4px 8px; font-size:12px; border-radius:4px; border:1px solid var(--border);">
          <option value="PENDING" ${isPending ? 'selected' : ''}>Pending</option>
          <option value="PROFIT" ${isProfit ? 'selected' : ''}>Profit</option>
          <option value="LOSS" ${isLoss ? 'selected' : ''}>Loss</option>
        </select>
        <input type="text" class="seq-log-notes" placeholder="Add trade notes..." value="${log.notes || ''}" style="flex:1; padding:4px 8px; font-size:12px; border-radius:4px; border:1px solid var(--border);" />
        <button class="icon-btn delete-log-btn" title="Delete log">✕</button>
      </div>
    `;

    // Dropdown change listener
    const outcomeSelect = card.querySelector('.seq-log-outcome');
    const notesInput    = card.querySelector('.seq-log-notes');

    const handleUpdate = async () => {
      try {
        await updateTriggerLogOutcome(log.id, outcomeSelect.value, notesInput.value.trim());
      } catch (err) {
        showToast('Failed to save log details');
      }
    };

    outcomeSelect.addEventListener('change', handleUpdate);
    notesInput.addEventListener('blur', handleUpdate);
    notesInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        notesInput.blur();
      }
    });

    card.querySelector('.delete-log-btn').addEventListener('click', async () => {
      if (!confirm('Delete this trigger log?')) return;
      try {
        await deleteTriggerLog(log.id);
        showToast('Trigger log deleted');
      } catch (err) {
        showToast('Failed to delete');
      }
    });

    seqLogsList.appendChild(card);
  });
}

// Auto-init
initSequenceRulesUI();

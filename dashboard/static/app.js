/* ShipConsole AI Evaluation Command Center - Frontend SPA (vanilla JS, no build step) */

const CATEGORY_META = {
  safety: { label: 'Safety & Guardrails', icon: '\u{1F6E1}\u{FE0F}', cls: 'safety' },
  quality: { label: 'Answer Quality', icon: '\u{1F4CA}', cls: 'quality' },
  business: { label: 'Business Rules & Compliance', icon: '⚙️', cls: 'business' },
  other: { label: 'Other', icon: '\u{1F539}', cls: 'other' },
};

let currentScope = null; // run_id string or null (= latest)
let activeCharts = [];
let activeEventSource = null;

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fmtDate(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

function fmtPct(v) {
  if (v === null || v === undefined) return '—';
  return `${v.toFixed(1)}%`;
}

function statusColorForPct(pct) {
  if (pct >= 80) return 'var(--good)';
  if (pct >= 50) return 'var(--warn)';
  return 'var(--bad)';
}

function statusLevelForPct(pct) {
  if (pct >= 80) return 'healthy';
  if (pct >= 50) return 'warning';
  return 'critical';
}

async function fetchJSON(url, opts) {
  const res = await fetch(url, opts);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

function destroyCharts() {
  activeCharts.forEach((c) => { try { c.destroy(); } catch (e) { } });
  activeCharts = [];
}

function closeStream() {
  if (activeEventSource) {
    try { activeEventSource.close(); } catch (e) { }
    activeEventSource = null;
  }
}

async function fetchRunContext(runId) {
  const url = runId ? `/api/runs/${encodeURIComponent(runId)}` : '/api/runs/latest';
  return fetchJSON(url);
}

function emptyState(title, msg, ctaHtml) {
  return `<div class="empty-state"><h2>${escapeHtml(title)}</h2><p>${escapeHtml(msg)}</p>${ctaHtml || ''}</div>`;
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

function getHashParts() {
  const raw = location.hash.slice(1) || '/overview';
  const qIndex = raw.indexOf('?');
  const path = qIndex === -1 ? raw : raw.slice(0, qIndex);
  const params = new URLSearchParams(qIndex === -1 ? '' : raw.slice(qIndex + 1));
  return { path: path || '/overview', params };
}

function buildHash(path, params) {
  const qs = params.toString();
  return `#${path}${qs ? `?${qs}` : ''}`;
}

function setParam(key, value) {
  const { path, params } = getHashParts();
  if (value === null || value === undefined || value === '') params.delete(key);
  else params.set(key, value);
  location.hash = buildHash(path, params);
}

function navigate(path, extraParams) {
  const params = new URLSearchParams();
  if (currentScope) params.set('run', currentScope);
  if (extraParams) Object.entries(extraParams).forEach(([k, v]) => params.set(k, v));
  location.hash = buildHash(path, params);
}

function updateActiveNav(path) {
  document.querySelectorAll('#mainNav a').forEach((a) => {
    a.classList.toggle('active', a.getAttribute('data-route') === path);
  });
}

function updateScopeIndicator(runId) {
  currentScope = runId || null;
  const wrap = document.getElementById('scopeIndicator');
  const val = document.getElementById('scopeValue');
  if (currentScope) {
    wrap.style.display = 'block';
    val.textContent = currentScope;
  } else {
    wrap.style.display = 'none';
  }
}

async function render() {
  const { path, params } = getHashParts();
  updateActiveNav(path);
  updateScopeIndicator(params.get('run'));
  destroyCharts();
  if (path !== '/pipeline') closeStream();

  const content = document.getElementById('content');
  content.innerHTML = '<div class="loading-placeholder">Loading…</div>';

  try {
    if (path === '/overview' || path === '/') await renderOverview(content, params);
    else if (path === '/evaluations') await renderEvaluations(content, params);
    else if (path === '/test-cases') await renderTestCases(content, params);
    else if (path === '/metrics') await renderMetrics(content, params);
    else if (path === '/history') await renderHistory(content, params);
    else if (path === '/pipeline') await renderPipeline(content, params);
    else if (path === '/reports') await renderReports(content, params);
    else content.innerHTML = emptyState('Page not found', 'Choose a section from the sidebar.');
  } catch (e) {
    console.error(e);
    content.innerHTML = emptyState('Something went wrong', e.message || String(e));
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('mainNav').addEventListener('click', (e) => {
    const a = e.target.closest('a');
    if (!a) return;
    e.preventDefault();
    navigate(a.getAttribute('data-route'));
  });
  document.getElementById('clearScopeBtn').addEventListener('click', () => {
    currentScope = null;
    const { path } = getHashParts();
    location.hash = buildHash(path, new URLSearchParams());
  });
  window.addEventListener('hashchange', render);
  render();
});

// ---------------------------------------------------------------------------
// PAGE: Overview
// ---------------------------------------------------------------------------

async function renderOverview(content, params) {
  const runId = params.get('run');
  const ctx = await fetchRunContext(runId);

  if (!ctx.run) {
    content.innerHTML = `
      <div class="page-header"><div><h1>Overview</h1><div class="page-subtitle">Evaluation Command Center</div></div></div>
      ${emptyState('No evaluation runs yet', 'Run the pipeline to generate your first persisted Evaluation Run.',
      '<button class="btn btn-primary" onclick="navigate(\'/pipeline\')">Go to Pipeline</button>')}`;
    return;
  }

  const run = ctx.run;
  const insights = ctx.insights;
  const statusLevel = insights.status;
  const deltaHtml = insights.pass_rate_delta === null ? ''
    : `<span class="hero-delta ${insights.pass_rate_delta >= 0 ? 'up' : 'down'}">${insights.pass_rate_delta >= 0 ? '↑' : '↓'} ${Math.abs(insights.pass_rate_delta).toFixed(1)} pts vs previous run</span>`;

  const failingChips = insights.failing_case_ids.map((id) =>
    `<span class="chip fail-chip" onclick="navigate('/test-cases', {case: '${id}'})">${escapeHtml(id)}</span>`).join('') || '<span class="text-muted">None</span>';

  const failingMetricChips = insights.failing_metrics.map((m) =>
    `<span class="chip">${escapeHtml(m)}</span>`).join('') || '<span class="text-muted">None</span>';

  const regressionsHtml = insights.regressions.length
    ? insights.regressions.map((r) => `<div>${escapeHtml(r.name)}: <span class="gap-neg">${r.delta} pts</span> (${r.previous_pass_rate}% → ${r.current_pass_rate}%)</div>`).join('')
    : '<span class="text-muted">No regressions vs previous run</span>';

  content.innerHTML = `
    <div class="page-header">
      <div><h1>Overview</h1><div class="page-subtitle">Run ${escapeHtml(run.id)} &middot; ${fmtDate(run.timestamp)} &middot; ${escapeHtml(run.model_used)}</div></div>
    </div>

    <div class="hero">
      <div>
        <div class="hero-figure">
          <span class="hero-percent" style="color:${statusColorForPct(run.overall_pass_rate)}">${fmtPct(run.overall_pass_rate)}</span>
          ${deltaHtml}
        </div>
        <div class="hero-label">Overall Pass Rate &middot; ${run.total_cases} test case(s) evaluated</div>
      </div>
      <div class="status-badge ${statusLevel}">${escapeHtml(insights.status_label)}</div>
    </div>

    <div class="decision-block">
      <div class="decision-title">
        Can I ship this build?
        <span class="ship-answer ${insights.can_ship ? 'yes' : 'no'}">${insights.can_ship ? '✓ YES' : '✗ NO'}</span>
      </div>
      <div class="decision-grid">
        <div class="decision-item">
          <div class="decision-q">What's failing?</div>
          <div class="decision-a">${insights.failing_case_ids.length} case(s) across ${insights.failing_metrics.length} metric(s)<br><div class="chip-row" style="margin-top:8px;">${failingMetricChips}</div></div>
        </div>
        <div class="decision-item">
          <div class="decision-q">What's getting worse?</div>
          <div class="decision-a">${regressionsHtml}</div>
        </div>
        <div class="decision-item">
          <div class="decision-q">Which cases need investigation?</div>
          <div class="decision-a"><div class="chip-row">${failingChips}</div></div>
        </div>
      </div>
    </div>

    <div class="stats-grid">
      <div class="stat-card"><div class="stat-label">Total Test Cases</div><div class="stat-value accent">${run.total_cases}</div></div>
      <div class="stat-card"><div class="stat-label">Passed</div><div class="stat-value good">${run.passed_cases}</div></div>
      <div class="stat-card"><div class="stat-label">Failed</div><div class="stat-value bad">${run.failed_cases}</div></div>
      <div class="stat-card"><div class="stat-label">Active Metrics</div><div class="stat-value accent">${run.metrics_summary.length}</div></div>
    </div>

    <div class="section">
      <div class="section-title">Rule-Based Insights</div>
      <div class="card">
        <div style="margin-bottom:10px;"><strong>Lowest scoring metrics (by pass rate):</strong></div>
        ${insights.lowest_metrics.length
      ? insights.lowest_metrics.map((m) => `<div class="metric-line"><span class="metric-name">${escapeHtml(m.name)}</span><span class="metric-score" style="color:${statusColorForPct(m.pass_rate)}">${fmtPct(m.pass_rate)} pass &middot; avg ${m.avg_score.toFixed(2)}</span></div>`).join('')
      : '<div class="text-muted">Every metric is passing 100% of cases in this run.</div>'}
      </div>
    </div>

    <div class="section">
      <div class="section-title">Grouped Metric Performance</div>
      <div id="categoryGrid" class="category-grid"></div>
    </div>

    <div class="section">
      <div class="section-title">Recent Failed Tests</div>
      <div id="recentFailedWrap"></div>
    </div>
  `;

  renderCategoryGrid(document.getElementById('categoryGrid'), run.metrics_summary, insights);
  renderRecentFailed(document.getElementById('recentFailedWrap'), run);
}

function renderCategoryGrid(el, metricsSummary, insights) {
  const grouped = { safety: [], quality: [], business: [], other: [] };
  metricsSummary.forEach((m) => grouped[m.category || 'other'].push(m));

  const regByName = {};
  (insights?.regressions || []).forEach((r) => { regByName[r.name] = r; });
  const impByName = {};
  (insights?.improvements || []).forEach((r) => { impByName[r.name] = r; });

  el.innerHTML = Object.entries(grouped).filter(([, list]) => list.length).map(([key, list]) => {
    const meta = CATEGORY_META[key];
    const rows = list.map((m) => {
      let arrow = '';
      if (regByName[m.name]) arrow = `<span class="trend-arrow trend-down">↓ ${Math.abs(regByName[m.name].delta)}</span>`;
      else if (impByName[m.name]) arrow = `<span class="trend-arrow trend-up">↑ ${impByName[m.name].delta}</span>`;
      else if (insights?.pass_rate_delta !== null) arrow = `<span class="trend-arrow trend-flat">→</span>`;
      return `<div class="metric-line">
        <span class="metric-name">${escapeHtml(m.name)}</span>
        <span style="display:flex;align-items:center;">
          <span class="metric-score" style="color:${statusColorForPct(m.pass_rate)}">${m.avg_score.toFixed(2)}</span>
          <span class="mini-bar-track"><span class="mini-bar-fill" style="width:${m.pass_rate}%;background:${statusColorForPct(m.pass_rate)}"></span></span>
          ${arrow}
        </span>
      </div>`;
    }).join('');
    return `<div class="category-card">
      <div class="category-header ${meta.cls}">${meta.icon} ${escapeHtml(meta.label)}</div>
      ${rows}
    </div>`;
  }).join('');
}

function renderRecentFailed(el, run) {
  const failed = run.test_cases.filter((tc) => !tc.success).slice(0, 8);
  if (!failed.length) {
    el.innerHTML = `<div class="card text-muted">No failed test cases in this run. Nice work.</div>`;
    return;
  }
  el.innerHTML = `<div class="table-wrap"><table>
    <thead><tr><th>Case ID</th><th>Input Prompt</th><th>Failed Metrics</th><th></th></tr></thead>
    <tbody>${failed.map((tc) => {
    const failedCount = tc.metrics.filter((m) => !m.success).length;
    return `<tr class="clickable" onclick="navigate('/test-cases', {case:'${tc.id}'})">
        <td class="cell-mono">${escapeHtml(tc.id)}</td>
        <td class="cell-truncate">${escapeHtml(tc.input)}</td>
        <td>${failedCount} / ${tc.metrics.length}</td>
        <td><span class="link-ext">Investigate &rarr;</span></td>
      </tr>`;
  }).join('')}</tbody>
  </table></div>`;
}

// ---------------------------------------------------------------------------
// PAGE: Evaluations (Run List)
// ---------------------------------------------------------------------------

async function renderEvaluations(content, params) {
  const runs = await fetchJSON('/api/runs');
  content.innerHTML = `
    <div class="page-header"><div><h1>Evaluations</h1><div class="page-subtitle">${runs.length} persisted run(s)</div></div></div>
    <div id="runsList"></div>`;

  if (!runs.length) {
    document.getElementById('runsList').innerHTML = emptyState('No evaluation runs yet', 'Run the pipeline to generate your first persisted Evaluation Run.',
      '<button class="btn btn-primary" onclick="navigate(\'/pipeline\')">Go to Pipeline</button>');
    return;
  }

  document.getElementById('runsList').innerHTML = runs.map((r) => `
    <div class="run-card ${currentScope === r.id ? 'scoped' : ''}">
      <div class="run-meta">
        <div><div class="m-label">Run ID</div><div class="m-value cell-mono">${escapeHtml(r.id)}</div></div>
        <div><div class="m-label">Timestamp</div><div class="m-value">${fmtDate(r.timestamp)}</div></div>
        <div><div class="m-label">Model</div><div class="m-value">${escapeHtml(r.model_used)}</div></div>
        <div><div class="m-label">Cases</div><div class="m-value">${r.total_cases}</div></div>
        <div><div class="m-label">Pass Rate</div><div class="m-value" style="color:${statusColorForPct(r.overall_pass_rate)}">${fmtPct(r.overall_pass_rate)}</div></div>
        <div><div class="m-label">Passed / Failed</div><div class="m-value"><span class="good">${r.passed_cases}</span> / <span class="bad">${r.failed_cases}</span></div></div>
      </div>
      <button class="btn btn-primary" onclick="currentScope='${r.id}'; navigate('/overview')">View Run</button>
    </div>`).join('');
}

// ---------------------------------------------------------------------------
// PAGE: Test Cases (Explorer + Detail)
// ---------------------------------------------------------------------------

async function renderTestCases(content, params) {
  const runId = params.get('run');
  const caseId = params.get('case');
  const ctx = await fetchRunContext(runId);

  if (!ctx.run) {
    content.innerHTML = emptyState('No evaluation runs yet', 'Run the pipeline to generate your first persisted Evaluation Run.',
      '<button class="btn btn-primary" onclick="navigate(\'/pipeline\')">Go to Pipeline</button>');
    return;
  }

  if (caseId) {
    renderTestCaseDetail(content, ctx.run, caseId);
    return;
  }

  const run = ctx.run;
  content.innerHTML = `
    <div class="page-header"><div><h1>Test Cases</h1><div class="page-subtitle">Run ${escapeHtml(run.id)} &middot; ${run.total_cases} case(s)</div></div></div>
    <div class="filters-bar">
      <input type="text" id="tcSearch" class="search-input" placeholder="Search prompts or case IDs…">
      <button class="tab-btn active" data-status="all">All (${run.total_cases})</button>
      <button class="tab-btn" data-status="fail">Failed (${run.failed_cases})</button>
      <button class="tab-btn" data-status="pass">Passed (${run.passed_cases})</button>
      <select id="metricFilter" class="select-input">
        <option value="">All Metrics</option>
        ${run.metrics_summary.map((m) => `<option value="${escapeHtml(m.name)}">${escapeHtml(m.name)}</option>`).join('')}
      </select>
    </div>
    <div id="tcTableWrap"></div>
  `;

  let statusFilter = 'all';
  const searchInput = document.getElementById('tcSearch');
  const metricFilter = document.getElementById('metricFilter');
  const tableWrap = document.getElementById('tcTableWrap');

  function applyFilters() {
    const q = searchInput.value.toLowerCase();
    const metricName = metricFilter.value;
    const filtered = run.test_cases.filter((tc) => {
      if (statusFilter === 'fail' && tc.success) return false;
      if (statusFilter === 'pass' && !tc.success) return false;
      if (q && !(tc.input.toLowerCase().includes(q) || tc.id.toLowerCase().includes(q))) return false;
      if (metricName) {
        const m = tc.metrics.find((mm) => mm.name === metricName);
        if (!m || m.success) return false;
      }
      return true;
    });
    renderTestCaseTable(tableWrap, filtered);
  }

  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      statusFilter = btn.dataset.status;
      applyFilters();
    });
  });
  searchInput.addEventListener('input', applyFilters);
  metricFilter.addEventListener('change', applyFilters);

  applyFilters();
}

function renderTestCaseTable(el, cases) {
  if (!cases.length) {
    el.innerHTML = `<div class="card text-muted">No test cases match the current filters.</div>`;
    return;
  }
  el.innerHTML = `<div class="table-wrap"><table>
    <thead><tr><th>Case ID</th><th>Input Prompt Excerpt</th><th>Metrics Passed</th><th>Avg Score</th><th>Status</th><th></th></tr></thead>
    <tbody>${cases.map((tc) => {
    const scored = tc.metrics.filter((m) => m.score !== null);
    const avg = scored.length ? (scored.reduce((s, m) => s + m.score, 0) / scored.length) : 0;
    const passedCount = tc.metrics.filter((m) => m.success).length;
    return `<tr class="clickable" onclick="setParam('case','${tc.id}')">
        <td class="cell-mono">${escapeHtml(tc.id)}</td>
        <td class="cell-truncate">${escapeHtml(tc.input)}</td>
        <td>${passedCount} / ${tc.metrics.length}</td>
        <td class="cell-mono">${avg.toFixed(2)}</td>
        <td><span class="badge ${tc.success ? 'badge-pass' : 'badge-fail'}">${tc.success ? 'Pass' : 'Fail'}</span></td>
        <td><span class="link-ext">Investigate &rarr;</span></td>
      </tr>`;
  }).join('')}</tbody>
  </table></div>`;
}

function renderTestCaseDetail(content, run, caseId) {
  const tc = run.test_cases.find((c) => c.id === caseId);
  if (!tc) {
    content.innerHTML = emptyState('Case not found', `No test case with ID ${caseId} in run ${run.id}.`,
      `<button class="btn" onclick="setParam('case', null)">Back to Test Cases</button>`);
    return;
  }

  content.innerHTML = `
    <div class="page-header">
      <div><h1>${escapeHtml(tc.id)}</h1><div class="page-subtitle">Run ${escapeHtml(run.id)} &middot; <span class="badge ${tc.success ? 'badge-pass' : 'badge-fail'}">${tc.success ? 'Pass' : 'Fail'}</span></div></div>
      <div style="display:flex;gap:10px;">
        <button class="btn" onclick="setParam('case', null)">&larr; Back to Test Cases</button>
        <a class="btn btn-primary" href="/api/runs/${encodeURIComponent(run.id)}/cases/${encodeURIComponent(tc.id)}/export.xlsx">Export Case (Excel)</a>
      </div>
    </div>

    <div class="detail-grid">
      ${detailBlock('Input Prompt', tc.input, 'input')}
      ${detailBlock('Expected Output (Golden)', tc.expected_output, 'expected')}
      ${detailBlock('Actual UI Output', tc.actual_output, 'actual')}
    </div>

    <div class="section">
      <div class="section-title">
        ${tc.metrics.length}-Metric Results
      </div>
      <div class="card" style="padding:0;overflow:hidden;">
        <div class="metric-detail-row header"><div>Metric</div><div>Score</div><div>Threshold</div><div>Gap</div><div>Result</div></div>
        ${tc.metrics.map((m, idx) => {
    const gap = m.score !== null ? +(m.score - m.threshold).toFixed(2) : null;
    const reasonId = `reason-${idx}`;
    return `<div class="metric-detail-row">
            <div>${escapeHtml(m.name)}</div>
            <div class="cell-mono">${m.score !== null ? m.score.toFixed(2) : '—'}</div>
            <div class="cell-mono">${m.threshold.toFixed(2)}</div>
            <div class="${gap !== null && gap >= 0 ? 'gap-pos' : 'gap-neg'}">${gap !== null ? (gap >= 0 ? '+' : '') + gap : '—'}</div>
            <div><span class="badge ${m.success ? 'badge-pass' : 'badge-fail'}">${m.success ? 'Pass' : 'Fail'}</span>
              ${m.reason ? `<span class="reason-toggle" style="margin-left:8px;" onclick="toggleReason('${reasonId}')">[&#9660; Reason]</span>` : ''}
            </div>
          </div>
          ${m.reason ? `<div class="reason-panel" id="${reasonId}" style="display:none;">${escapeHtml(m.reason)}</div>` : ''}`;
  }).join('')}
      </div>
    </div>
  `;
}

function detailBlock(title, text, key) {
  const id = `block-${key}`;
  return `<div class="detail-block">
    <div class="detail-block-title">
      <span>${escapeHtml(title)}</span>
      <span class="expand-toggle" onclick="toggleExpand('${id}')">[&#10530; Expand]</span>
    </div>
    <div class="detail-block-content" id="${id}">${escapeHtml(text || '—')}</div>
  </div>`;
}

function toggleExpand(id) {
  document.getElementById(id).classList.toggle('expanded');
}

function toggleReason(id) {
  const el = document.getElementById(id);
  el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

// ---------------------------------------------------------------------------
// PAGE: Metrics (Health Dashboard)
// ---------------------------------------------------------------------------

async function renderMetrics(content, params) {
  const runId = params.get('run');
  const ctx = await fetchRunContext(runId);

  if (!ctx.run) {
    content.innerHTML = emptyState('No evaluation runs yet', 'Run the pipeline to generate your first persisted Evaluation Run.',
      '<button class="btn btn-primary" onclick="navigate(\'/pipeline\')">Go to Pipeline</button>');
    return;
  }

  const run = ctx.run;
  const insights = ctx.insights;
  const regByName = {};
  (insights?.regressions || []).forEach((r) => { regByName[r.name] = r; });
  const impByName = {};
  (insights?.improvements || []).forEach((r) => { impByName[r.name] = r; });

  const grouped = { safety: [], quality: [], business: [], other: [] };
  run.metrics_summary.forEach((m) => grouped[m.category || 'other'].push(m));

  content.innerHTML = `
    <div class="page-header"><div><h1>Metrics</h1><div class="page-subtitle">Run ${escapeHtml(run.id)} &middot; ${run.metrics_summary.length} production metrics</div></div></div>
    ${Object.entries(grouped).filter(([, l]) => l.length).map(([key, list]) => {
    const meta = CATEGORY_META[key];
    return `<div class="section">
        <div class="section-title">${meta.icon} ${escapeHtml(meta.label)}</div>
        <div class="table-wrap"><table>
          <thead><tr><th>Metric</th><th>Avg Score</th><th>Threshold</th><th>Passed</th><th>Failed</th><th>Pass Rate</th><th>Trend</th></tr></thead>
          <tbody>${list.map((m) => {
      let trend = '<span class="trend-flat">→ n/a</span>';
      if (regByName[m.name]) trend = `<span class="trend-down">↓ ${Math.abs(regByName[m.name].delta)} pts</span>`;
      else if (impByName[m.name]) trend = `<span class="trend-up">↑ ${impByName[m.name].delta} pts</span>`;
      else if (insights?.pass_rate_delta !== null) trend = '<span class="trend-flat">→ flat</span>';
      return `<tr>
              <td>${escapeHtml(m.name)}</td>
              <td class="cell-mono">${m.avg_score.toFixed(2)}</td>
              <td class="cell-mono">${m.threshold.toFixed(2)}</td>
              <td class="good">${m.passed}</td>
              <td class="bad">${m.failed}</td>
              <td style="color:${statusColorForPct(m.pass_rate)}">${fmtPct(m.pass_rate)}</td>
              <td>${trend}</td>
            </tr>`;
    }).join('')}</tbody>
        </table></div>
      </div>`;
  }).join('')}
  `;
}

// ---------------------------------------------------------------------------
// PAGE: History & Regression Analysis
// ---------------------------------------------------------------------------

async function renderHistory(content, params) {
  const history = await fetchJSON('/api/history');
  const runs = await fetchJSON('/api/runs');

  if (!history.trend.length) {
    content.innerHTML = `
      <div class="page-header"><div><h1>History</h1></div></div>
      ${emptyState('Not enough data yet', 'Run the pipeline at least once to start building run-over-run history.',
      '<button class="btn btn-primary" onclick="navigate(\'/pipeline\')">Go to Pipeline</button>')}`;
    return;
  }

  content.innerHTML = `
    <div class="page-header"><div><h1>History</h1><div class="page-subtitle">${history.trend.length} run(s) tracked</div></div></div>

    <div class="chart-card">
      <div class="section-title">Pass Rate Trend</div>
      <div class="chart-wrap"><canvas id="trendChart"></canvas></div>
    </div>

    <div class="section">
      <div class="section-title">Per-Metric Regression Matrix</div>
      <div id="matrixWrap"></div>
    </div>

    <div class="section">
      <div class="section-title">Run A vs Run B Comparison</div>
      <div class="card">
        <div class="filters-bar" style="margin-bottom:16px;">
          <select id="runASelect" class="select-input"></select>
          <span class="text-muted">vs</span>
          <select id="runBSelect" class="select-input"></select>
        </div>
        <div id="compareWrap"></div>
      </div>
    </div>
  `;

  renderTrendChart(history.trend);
  renderRegressionMatrix(document.getElementById('matrixWrap'), history.metric_matrix);

  const runASelect = document.getElementById('runASelect');
  const runBSelect = document.getElementById('runBSelect');
  const optionsHtml = runs.map((r) => `<option value="${r.id}">${r.id} (${fmtPct(r.overall_pass_rate)})</option>`).join('');
  runASelect.innerHTML = optionsHtml;
  runBSelect.innerHTML = optionsHtml;
  if (runs.length > 1) { runASelect.value = runs[0].id; runBSelect.value = runs[1].id; }

  async function refreshCompare() {
    if (!runASelect.value || !runBSelect.value) return;
    const [a, b] = await Promise.all([
      fetchJSON(`/api/runs/${encodeURIComponent(runASelect.value)}`),
      fetchJSON(`/api/runs/${encodeURIComponent(runBSelect.value)}`),
    ]);
    renderComparison(document.getElementById('compareWrap'), a.run, b.run);
  }
  runASelect.addEventListener('change', refreshCompare);
  runBSelect.addEventListener('change', refreshCompare);
  if (runs.length > 1) refreshCompare();
}

function renderTrendChart(trend) {
  const ctxEl = document.getElementById('trendChart');
  const chart = new Chart(ctxEl, {
    type: 'line',
    data: {
      labels: trend.map((t) => t.id),
      datasets: [{
        label: 'Overall Pass Rate (%)',
        data: trend.map((t) => t.overall_pass_rate),
        borderColor: '#3987e5',
        backgroundColor: 'rgba(57,135,229,0.12)',
        borderWidth: 2,
        pointRadius: 4,
        pointBackgroundColor: '#3987e5',
        tension: 0.25,
        fill: true,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { min: 0, max: 100, ticks: { color: '#9099ab' }, grid: { color: '#2b2f3d' } },
        x: { ticks: { color: '#9099ab' }, grid: { display: false } },
      },
      plugins: {
        legend: { labels: { color: '#f1f2f6' } },
        tooltip: { callbacks: { label: (i) => `Pass Rate: ${i.parsed.y.toFixed(1)}%` } },
      },
    },
  });
  activeCharts.push(chart);
}

function renderRegressionMatrix(el, matrix) {
  if (!matrix.length) { el.innerHTML = '<div class="card text-muted">No metric history yet.</div>'; return; }
  const runIds = matrix[0].points.map((p) => p.run_id);
  const fmtShortId = (id) => {
    const m = id.match(/run_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})/);
    if (m) return `${m[2]}/${m[3]} ${m[4]}:${m[5]}`;
    return id;
  };
  el.innerHTML = `<div class="table-wrap"><table class="matrix-table">
    <thead><tr><th class="sticky-col">Metric</th>${runIds.map((id) => `<th title="${escapeHtml(id)}">${escapeHtml(fmtShortId(id))}</th>`).join('')}</tr></thead>
    <tbody>${matrix.map((row) => `<tr>
      <td class="sticky-col">${escapeHtml(row.name)}</td>
      ${row.points.map((p) => p.pass_rate === null
    ? '<td class="text-muted">—</td>'
    : `<td style="color:${statusColorForPct(p.pass_rate)};font-family:var(--mono);">${p.pass_rate.toFixed(0)}%</td>`).join('')}
    </tr>`).join('')}</tbody>
  </table></div>`;
}

function renderComparison(el, a, b) {
  if (!a || !b) { el.innerHTML = ''; return; }
  const aMetrics = {}; a.metrics_summary.forEach((m) => { aMetrics[m.name] = m; });
  const bMetrics = {}; b.metrics_summary.forEach((m) => { bMetrics[m.name] = m; });
  const names = Array.from(new Set([...Object.keys(aMetrics), ...Object.keys(bMetrics)]));

  el.innerHTML = `
    <div class="stats-grid" style="margin-bottom:18px;">
      <div class="stat-card"><div class="stat-label">${escapeHtml(a.id)} Pass Rate</div><div class="stat-value" style="color:${statusColorForPct(a.overall_pass_rate)}">${fmtPct(a.overall_pass_rate)}</div></div>
      <div class="stat-card"><div class="stat-label">${escapeHtml(b.id)} Pass Rate</div><div class="stat-value" style="color:${statusColorForPct(b.overall_pass_rate)}">${fmtPct(b.overall_pass_rate)}</div></div>
      <div class="stat-card"><div class="stat-label">Delta</div><div class="stat-value ${b.overall_pass_rate - a.overall_pass_rate >= 0 ? 'good' : 'bad'}">${(b.overall_pass_rate - a.overall_pass_rate).toFixed(1)} pts</div></div>
    </div>
    <div class="table-wrap"><table>
      <thead><tr><th>Metric</th><th>${escapeHtml(a.id)}</th><th>${escapeHtml(b.id)}</th><th>Delta</th></tr></thead>
      <tbody>${names.map((n) => {
    const av = aMetrics[n] ? aMetrics[n].pass_rate : null;
    const bv = bMetrics[n] ? bMetrics[n].pass_rate : null;
    const delta = (av !== null && bv !== null) ? +(bv - av).toFixed(1) : null;
    return `<tr>
          <td>${escapeHtml(n)}</td>
          <td class="cell-mono">${av !== null ? av.toFixed(0) + '%' : '—'}</td>
          <td class="cell-mono">${bv !== null ? bv.toFixed(0) + '%' : '—'}</td>
          <td class="${delta === null ? '' : (delta >= 0 ? 'gap-pos' : 'gap-neg')}">${delta === null ? '—' : (delta >= 0 ? '+' : '') + delta}</td>
        </tr>`;
  }).join('')}</tbody>
    </table></div>
  `;
}

// ---------------------------------------------------------------------------
// PAGE: Pipeline Execution
// ---------------------------------------------------------------------------

async function renderPipeline(content) {
  content.innerHTML = `
    <div class="page-header"><div><h1>Pipeline</h1><div class="page-subtitle">Trigger the evaluation pipeline and watch live output</div></div></div>
    <div class="pipeline-actions">
      <button class="btn btn-primary" id="btnEval">&#9654; Run Evaluation</button>
      <button class="btn btn-primary" id="btnFull">&#9889; Full Pipeline</button>
      <button class="btn btn-primary" id="btnPlaywright">&#9673; Playwright Only</button>
      <button class="btn btn-danger" id="btnStop" style="display:none;">&#9632; Stop Execution</button>
    </div>
    <div class="pipeline-status-line" id="pipelineStatusLine" style="display:none;">
      <span class="dot" id="pipelineDot"></span><span id="pipelineStatusText"></span>
    </div>
    <div class="terminal" id="terminal"><span class="text-muted">Output will appear here once a pipeline job starts…</span></div>
  `;

  const btns = { eval: document.getElementById('btnEval'), full: document.getElementById('btnFull'), playwright: document.getElementById('btnPlaywright') };
  const btnStop = document.getElementById('btnStop');
  let activeJobId = null;

  document.getElementById('btnEval').addEventListener('click', () => startJob('eval'));
  document.getElementById('btnFull').addEventListener('click', () => startJob('full'));
  document.getElementById('btnPlaywright').addEventListener('click', () => startJob('playwright'));

  btnStop.addEventListener('click', async () => {
    btnStop.disabled = true;
    btnStop.textContent = 'Stopping…';
    try {
      await fetchJSON('/api/pipeline/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_id: activeJobId })
      });
    } catch (e) {
      appendTerminalLine(document.getElementById('terminal'), `[Dashboard] Error stopping pipeline: ${e.message}`);
    }
  });

  function setButtonsDisabled(disabled) {
    Object.values(btns).forEach((b) => { b.disabled = disabled; });
  }

  async function startJob(mode) {
    const terminal = document.getElementById('terminal');
    terminal.innerHTML = '';
    const statusLine = document.getElementById('pipelineStatusLine');
    const dot = document.getElementById('pipelineDot');
    const statusText = document.getElementById('pipelineStatusText');

    let res;
    try {
      res = await fetchJSON('/api/pipeline/run', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode }),
      });
    } catch (e) {
      appendTerminalLine(terminal, `[Dashboard] ${e.message}`);
      return;
    }

    activeJobId = res.job_id;
    setButtonsDisabled(true);
    btnStop.style.display = 'inline-flex';
    btnStop.disabled = false;
    btnStop.innerHTML = '&#9632; Stop Execution';

    statusLine.style.display = 'flex';
    dot.className = 'dot running';
    statusText.textContent = `Running "${res.label}"…`;

    closeStream();
    const es = new EventSource(`/api/pipeline/stream/${res.job_id}`);
    activeEventSource = es;
    const ansiUp = window.AnsiUp ? new window.AnsiUp() : null;

    es.onmessage = (evt) => {
      const line = JSON.parse(evt.data);
      appendTerminalLine(terminal, line, ansiUp);
    };
    es.addEventListener('done', (evt) => {
      const info = JSON.parse(evt.data);
      dot.className = `dot ${info.status}`;
      statusText.innerHTML = `Job finished: <strong>${info.status}</strong> (exit code ${info.returncode})` +
        (info.status === 'done' ? ` &middot; <a class="link-ext" href="#" onclick="currentScope=null; navigate('/overview'); return false;">View Latest Run &rarr;</a>` : '');
      setButtonsDisabled(false);
      btnStop.style.display = 'none';
      es.close();
    });
    es.onerror = () => {
      dot.className = 'dot error';
      statusText.textContent = 'Connection to pipeline log stream lost.';
      setButtonsDisabled(false);
      btnStop.style.display = 'none';
      es.close();
    };
  }
}

function appendTerminalLine(terminal, line, ansiUp) {
  const div = document.createElement('div');
  div.className = 'terminal-line';
  if (ansiUp) div.innerHTML = ansiUp.ansi_to_html(line);
  else div.textContent = line;
  terminal.appendChild(div);
  terminal.scrollTop = terminal.scrollHeight;
}

// ---------------------------------------------------------------------------
// PAGE: Reports & Exports
// ---------------------------------------------------------------------------

const REPORT_DESCRIPTIONS = {
  'evaluation_results.xlsx': 'Full run Excel workbook — Executive Summary, Test Cases, 13-Metric Breakdown, Failed Cases Log.',
  'failed_evaluations_report.md': 'Markdown failure report for the latest run.',
  'failed_evaluations.json': 'Structured JSON of failed evaluations for the latest run.',
  'latest_run_full.json': 'Raw DeepEval output for the most recent run.',
};

async function renderReports(content) {
  const reports = await fetchJSON('/api/reports');
  content.innerHTML = `
    <div class="page-header"><div><h1>Reports</h1><div class="page-subtitle">Downloads reflect the most recently executed pipeline run</div></div></div>
    <div id="reportsList"></div>
    <div class="section">
      <div class="card text-muted">
        Need a single test case export? Open any case from <a class="link-ext" href="#" onclick="navigate('/test-cases'); return false;">Test Cases</a> and use "Export Case (Excel)".
      </div>
    </div>
  `;
  document.getElementById('reportsList').innerHTML = reports.map((r) => `
    <div class="report-row ${r.exists ? '' : 'disabled'}">
      <div>
        <div class="r-name">${escapeHtml(r.name)}</div>
        <div class="r-meta">${escapeHtml(REPORT_DESCRIPTIONS[r.name] || '')}${r.exists ? ` &middot; ${(r.size_bytes / 1024).toFixed(1)} KB &middot; ${fmtDate(new Date(r.modified * 1000).toISOString())}` : ' &middot; Not yet generated'}</div>
      </div>
      ${r.exists ? `<a class="btn btn-primary btn-sm" href="/api/reports/download/${encodeURIComponent(r.name)}">Download</a>` : `<button class="btn btn-sm" disabled>Download</button>`}
    </div>`).join('');
}

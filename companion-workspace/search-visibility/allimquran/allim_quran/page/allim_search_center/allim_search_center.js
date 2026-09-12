frappe.pages['allim-search-center'].on_page_load = function (wrapper) {
  const page = frappe.ui.make_app_page({
    parent: wrapper,
    title: __('ALLIM Search Intelligence'),
    single_column: true,
  });

  page.set_primary_action(__('Run live audit'), () => runAudit(), 'play');
  page.add_inner_button(__('Refresh'), () => loadDashboard(), __('Actions'));

  const root = $('<div class="allim-search-center"></div>').appendTo(page.body);
  injectStyles();

  const esc = (value) => frappe.utils.escape_html(String(value ?? ''));
  const badge = (status) => `<span class="asi-badge asi-${esc(String(status).toLowerCase().replace(/\s+/g, '-'))}">${esc(status)}</span>`;

  function shell(message) {
    root.html(`<section class="asi-loading"><span class="spinner-border spinner-border-sm"></span>${esc(message)}</section>`);
  }

  function metric(label, value, note) {
    return `<article class="asi-metric"><small>${esc(label)}</small><strong>${esc(value)}</strong><span>${esc(note)}</span></article>`;
  }

  function render(data) {
    const summary = data.summary || {};
    const pages = data.pages || [];
    const opportunities = data.opportunities || [];
    const prompts = data.prompts || [];
    root.html(`
      <section class="asi-hero">
        <div><span class="asi-kicker">SEO · GEO · AEO</span><h2>${__('Search intelligence connected to learning outcomes')}</h2>
        <p>${__('Technical readiness, answerability, citability, multilingual parity and course discovery are measured together. Uncollected AI-engine data is never presented as a result.')}</p></div>
        <div class="asi-state">${badge(data.measurement_note || 'Not measured')}<small>${__('AI visibility state')}</small></div>
      </section>
      <section class="asi-metrics">
        ${metric(__('Audited pages'), summary.pages || 0, __('live public routes'))}
        ${metric(__('Average readiness'), `${summary.average_score || 0}/100`, __('technical + answer-ready'))}
        ${metric(__('Open opportunities'), summary.open_opportunities || 0, __('deduplicated actions'))}
        ${metric(__('Tracked prompts'), summary.active_prompts || 0, `${summary.measured_prompts || 0} ${__('measured')}`)}
        ${metric(__('Stored citations'), summary.citations || 0, `${summary.observations || 0} ${__('observations')}`)}
      </section>
      <nav class="asi-tabs" aria-label="${__('Search intelligence sections')}">
        <button class="active" data-tab="pages">${__('Pages')}</button>
        <button data-tab="opportunities">${__('Opportunities')}</button>
        <button data-tab="prompts">${__('AI prompts')}</button>
        <button data-tab="method">${__('Method')}</button>
      </nav>
      <section class="asi-panel active" data-panel="pages">${renderPages(pages)}</section>
      <section class="asi-panel" data-panel="opportunities">${renderOpportunities(opportunities)}</section>
      <section class="asi-panel" data-panel="prompts">${renderPrompts(prompts)}</section>
      <section class="asi-panel" data-panel="method">${renderMethod()}</section>
    `);
    root.find('[data-tab]').on('click', function () {
      const target = $(this).attr('data-tab');
      root.find('[data-tab]').removeClass('active');
      $(this).addClass('active');
      root.find('[data-panel]').removeClass('active');
      root.find(`[data-panel="${target}"]`).addClass('active');
    });
  }

  function renderPages(pages) {
    if (!pages.length) return `<div class="asi-empty"><h3>${__('No audit yet')}</h3><p>${__('Run a live audit to establish the evidence-based baseline.')}</p></div>`;
    return `<div class="asi-table-wrap"><table class="asi-table"><thead><tr><th>${__('Route')}</th><th>${__('Type')}</th><th>${__('Locale')}</th><th>${__('Score')}</th><th>${__('State')}</th><th>${__('Findings')}</th></tr></thead><tbody>${pages.map((row) => `
      <tr><td><a href="${esc(row.route)}" target="_blank" rel="noopener noreferrer">${esc(row.route)}</a><small>${esc(row.page_title)}</small></td>
      <td>${esc(row.page_type)}</td><td>${esc(row.locale)}</td><td><strong>${esc(row.score)}/100</strong></td><td>${badge(row.status)}</td>
      <td>${row.issues.length ? `<details><summary>${row.issues.length} ${__('items')}</summary><ul>${row.issues.map((issue) => `<li><b>${esc(issue.channel)} · ${esc(issue.priority)}</b>${esc(issue.message)}<small>${esc(issue.recommendation)}</small></li>`).join('')}</ul></details>` : `<span class="asi-pass">${__('Passed')}</span>`}</td></tr>`).join('')}</tbody></table></div>`;
  }

  function renderOpportunities(items) {
    if (!items.length) return `<div class="asi-empty"><h3>${__('No open opportunities')}</h3></div>`;
    return `<div class="asi-cards">${items.map((item) => `<article class="asi-card"><div>${badge(item.priority)} ${badge(item.channel)}</div><h3>${esc(item.route)}</h3><p>${esc(item.issue)}</p><strong>${__('Recommended action')}</strong><p>${esc(item.recommendation)}</p><small>${esc(item.status)}</small></article>`).join('')}</div>`;
  }

  function renderPrompts(items) {
    if (!items.length) return `<div class="asi-empty"><h3>${__('No prompts configured')}</h3></div>`;
    return `<div class="asi-cards">${items.map((item) => `<article class="asi-card"><div>${badge(item.language.toUpperCase())} ${badge(item.measurement_status)}</div><h3>${esc(item.prompt_text)}</h3><p>${esc(item.market)} · ${esc(item.audience)} · ${esc(item.journey_stage)}</p><a href="${esc(item.target_route)}" target="_blank" rel="noopener noreferrer">${esc(item.target_route)}</a></article>`).join('')}</div>`;
  }

  function renderMethod() {
    return `<div class="asi-method"><h3>${__('Beyond a generic SEO checklist')}</h3><div class="asi-method-grid">
      <article><b>SEO</b><p>${__('HTTP, titles, descriptions, canonical, robots, headings, social previews and crawlable server HTML.')}</p></article>
      <article><b>GEO</b><p>${__('Language and RTL integrity, evidence signals, localized parity, sources and citation-ready entities.')}</p></article>
      <article><b>AEO</b><p>${__('Direct-answer structure, schema entities, question coverage and prompt-level visibility history.')}</p></article>
      <article><b>${__('Learning outcomes')}</b><p>${__('Course routes can be connected to enrollments and learner journeys instead of measuring visibility in isolation.')}</p></article>
    </div><p class="asi-note">${__('Provider measurements begin only after approved server-side credentials and a controlled test. Until then the dashboard reports Not measured.')}</p></div>`;
  }

  async function loadDashboard() {
    shell(__('Loading verified search data…'));
    try {
      const response = await frappe.call('allimquran.search_intelligence.get_dashboard');
      render(response.message || {});
    } catch (error) {
      root.html(`<div class="asi-empty"><h3>${__('Unable to load search intelligence')}</h3><p>${esc(error.message || error)}</p></div>`);
    }
  }

  async function runAudit() {
    page.btn_primary.prop('disabled', true);
    shell(__('Auditing public routes and synchronizing opportunities…'));
    try {
      await frappe.call({ method: 'allimquran.search_intelligence.run_audit', freeze: true, freeze_message: __('Running live SEO, GEO and AEO checks…') });
      frappe.show_alert({ message: __('Live audit completed'), indicator: 'green' });
      await loadDashboard();
    } catch (error) {
      frappe.msgprint({ title: __('Audit failed'), message: esc(error.message || error), indicator: 'red' });
      await loadDashboard();
    } finally {
      page.btn_primary.prop('disabled', false);
    }
  }

  loadDashboard();
};

function injectStyles() {
  if (document.getElementById('allim-search-center-styles')) return;
  const style = document.createElement('style');
  style.id = 'allim-search-center-styles';
  style.textContent = `
    .allim-search-center{--asi-ink:#17352e;--asi-green:#0e7159;--asi-soft:#eef7f3;--asi-line:#d8e4de;color:var(--asi-ink);padding:18px 0 40px}.asi-hero{display:flex;justify-content:space-between;gap:28px;padding:28px;border:1px solid var(--asi-line);border-radius:24px;background:linear-gradient(135deg,#f7fbf9,#edf7f3)}.asi-hero h2{font:600 clamp(25px,3vw,38px)/1.08 Georgia,serif;max-width:760px;margin:8px 0}.asi-hero p{max-width:820px;color:#52645f}.asi-kicker{font-weight:700;letter-spacing:.12em;color:var(--asi-green)}.asi-state{display:flex;min-width:180px;flex-direction:column;align-items:flex-end;gap:8px}.asi-metrics{display:grid;grid-template-columns:repeat(5,minmax(150px,1fr));gap:12px;margin:16px 0}.asi-metric{padding:18px;border:1px solid var(--asi-line);border-radius:18px;background:#fff}.asi-metric small,.asi-metric span{display:block;color:#63736e}.asi-metric strong{display:block;font-size:25px;margin:8px 0}.asi-tabs{display:flex;gap:8px;overflow:auto;padding:4px 0 14px}.asi-tabs button{border:1px solid var(--asi-line);border-radius:999px;background:#fff;padding:9px 16px;color:var(--asi-ink)}.asi-tabs button.active{background:var(--asi-ink);color:#fff}.asi-panel{display:none}.asi-panel.active{display:block}.asi-table-wrap{overflow:auto;border:1px solid var(--asi-line);border-radius:20px;background:#fff}.asi-table{width:100%;border-collapse:collapse;min-width:980px}.asi-table th,.asi-table td{padding:14px;text-align:start;border-bottom:1px solid #e8efeb;vertical-align:top}.asi-table td>a{font-weight:650}.asi-table td>small,.asi-table li small{display:block;color:#6a7874;margin-top:4px}.asi-table details summary{cursor:pointer}.asi-table details ul{padding-inline-start:18px;margin:8px 0}.asi-table details li{margin:8px 0}.asi-badge{display:inline-flex;align-items:center;min-height:26px;padding:3px 10px;border-radius:999px;background:#edf1ef;color:#42534e;font-size:12px;font-weight:650}.asi-healthy,.asi-seo,.asi-geo,.asi-aeo,.asi-en,.asi-ar,.asi-ru,.asi-tr{background:#e4f5ed;color:#176248}.asi-critical{background:#fdebea;color:#9d3129}.asi-needs-work,.asi-high{background:#fff1d8;color:#835409}.asi-not-measured{background:#edf0f2;color:#59636a}.asi-pass{color:#176248;font-weight:650}.asi-cards{display:grid;grid-template-columns:repeat(3,minmax(240px,1fr));gap:14px}.asi-card,.asi-method{border:1px solid var(--asi-line);border-radius:20px;background:#fff;padding:20px}.asi-card h3{font-size:16px;margin:12px 0 8px}.asi-card p{color:#5a6b66}.asi-method-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.asi-method-grid article{padding:18px;border-radius:16px;background:var(--asi-soft)}.asi-note,.asi-empty,.asi-loading{padding:28px;border:1px dashed var(--asi-line);border-radius:18px;background:#fff}.asi-loading{display:flex;align-items:center;gap:10px}[dir=rtl] .asi-table th,[dir=rtl] .asi-table td{text-align:right}@media(max-width:1050px){.asi-metrics{grid-template-columns:repeat(2,1fr)}.asi-cards{grid-template-columns:repeat(2,1fr)}.asi-method-grid{grid-template-columns:repeat(2,1fr)}}@media(max-width:620px){.allim-search-center{padding-top:8px}.asi-hero{flex-direction:column;padding:20px;border-radius:18px}.asi-state{align-items:flex-start}.asi-metrics,.asi-cards,.asi-method-grid{grid-template-columns:1fr}.asi-metric{border-radius:15px}}
  `;
  document.head.appendChild(style);
}

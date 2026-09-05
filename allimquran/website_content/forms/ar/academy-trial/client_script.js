function apply_allim_diagnostic_context() {
  var params = new URLSearchParams(window.location.search);
  var values = {
    learner_stage: params.get('level') || '',
    learning_goal: params.get('goal') || '',
    recommended_route: params.get('route') || '',
    daily_minutes: Number(params.get('minutes')) || 15,
    language: params.get('lang') || document.documentElement.lang || 'en',
    source: params.get('source') || 'academy-diagnostic'
  };
  Object.keys(values).forEach(function (fieldname) {
    if (frappe.web_form && frappe.web_form.set_value) frappe.web_form.set_value(fieldname, values[fieldname]);
  });
}
frappe.web_form.after_load = apply_allim_diagnostic_context;
window.setTimeout(apply_allim_diagnostic_context, 0);
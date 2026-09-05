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

/* ALLIM_RETURN_ACTION_START */
function apply_allim_return_action() {
  var link = document.querySelector('.success-footer .success_url_message a');
  if (!link) return;
  link.textContent = "العودة إلى الأكاديمية";
  link.classList.add('allim-return-button');
}
var allim_previous_after_load = frappe.web_form.after_load;
frappe.web_form.after_load = function () {
  if (typeof allim_previous_after_load === 'function') allim_previous_after_load();
  apply_allim_return_action();
};
window.setTimeout(apply_allim_return_action, 0);
/* ALLIM_RETURN_ACTION_END */

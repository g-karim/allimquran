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
  link.textContent = "Back to Academy";
  link.classList.add('allim-return-button');
}
var allim_previous_after_load = frappe.web_form.after_load;
frappe.web_form.after_load = function () {
  if (typeof allim_previous_after_load === 'function') allim_previous_after_load();
  apply_allim_return_action();
};
window.setTimeout(apply_allim_return_action, 0);
/* ALLIM_RETURN_ACTION_END */

/* Reuse the signed-in learner's contact details; guests retain the standard form. */
(function () {
  var previous = frappe.web_form.after_load;
  var pending = false;
  function prefillContact() {
    if (pending || !frappe.web_form.fields_dict || !frappe.web_form.fields_dict.full_name) return;
    pending = true;
    window.fetch('/api/method/allimquran.academy_trial.contact', {credentials:'same-origin', cache:'no-store'})
      .then(function(response) { if (!response.ok) return null; return response.json(); })
      .then(function(data) {
        var contact = data && data.message;
        if (!contact) return;
        var hidden = [];
        ['full_name','email'].forEach(function(field) {
          var control = frappe.web_form.fields_dict[field];
          if (!control || !contact[field] || frappe.web_form.get_value(field)) return;
          frappe.web_form.set_value(field, contact[field]);
          control.df.hidden = 1; control.refresh(); hidden.push(field);
        });
        if (!hidden.length) return;
        var first = frappe.web_form.fields_dict[hidden[0]];
        var node = document.createElement('div'); node.className = 'allim-account-contact';
        var title = document.createElement('strong'); title.textContent = 'Contact details from your account';
        var details = document.createElement('p'); details.textContent = hidden.map(function(field){return contact[field]}).join(' · ');
        var edit = document.createElement('button'); edit.type = 'button'; edit.className = 'btn btn-default'; edit.textContent = 'Change contact details';
        edit.addEventListener('click',function(){hidden.forEach(function(field){var control=frappe.web_form.fields_dict[field];control.df.hidden=0;control.refresh()});node.remove()});
        node.append(title,details,edit); first.$wrapper[0].before(node);
      }).catch(function(){ /* Keep editable required fields when account lookup is unavailable. */ });
  }
  frappe.web_form.after_load = function(){if(typeof previous==='function')previous();prefillContact()};
  window.setTimeout(prefillContact,0);
}());

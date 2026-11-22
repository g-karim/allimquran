from frappe.model.document import Document


class ALLIMTrialLessonRequest(Document):
	"""Academy inquiry; existing fields, naming and System Manager permissions are preserved."""

	def before_validate(self):
		from allimquran.academy_trial import current_contact

		for field, value in current_contact().items():
			if not self.get(field) and value:
				self.set(field, value)

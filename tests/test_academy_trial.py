"""Test session-owned contact lookup without a running site."""
import importlib.util
from pathlib import Path
import sys
import types
import unittest
from unittest.mock import Mock, patch


class TrialContactTest(unittest.TestCase):
    def load(self, user):
        fake = types.SimpleNamespace(session=types.SimpleNamespace(user=user), db=types.SimpleNamespace(get_value=Mock(return_value={'full_name':'Test Learner','email':'learner@example.test'})), whitelist=lambda: lambda fn: fn)
        spec = importlib.util.spec_from_file_location('trial_contact_test', Path(__file__).parents[1] / 'allimquran/academy_trial.py')
        module = importlib.util.module_from_spec(spec)
        with patch.dict(sys.modules, {'frappe': fake}):
            spec.loader.exec_module(module)
        return module, fake

    def test_guest_has_no_contact_lookup(self):
        module, fake = self.load('Guest')
        self.assertEqual(module.current_contact(), {})
        fake.db.get_value.assert_not_called()

    def test_only_current_session_profile_is_read(self):
        module, fake = self.load('learner@example.test')
        self.assertEqual(module.contact(), {'full_name':'Test Learner','email':'learner@example.test'})
        fake.db.get_value.assert_called_once_with('User', 'learner@example.test', ['full_name','email'], as_dict=True)

    def test_missing_profile_has_editable_fallback(self):
        module, fake = self.load('learner@example.test')
        fake.db.get_value.return_value = None
        self.assertEqual(module.contact(), {})


if __name__ == '__main__':
    unittest.main()

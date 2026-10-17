import importlib.util
import json
import sys
import threading
import unittest
from copy import deepcopy
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, patch


class DeadlockError(Exception):
	pass


class QueryTimeoutError(Exception):
	pass


class Data(dict):
	def __getattr__(self, name):
		return self.get(name)

	def __setattr__(self, name, value):
		self[name] = value


class SessionSecurityTests(unittest.TestCase):
	def setUp(self):
		self.local = threading.local()
		self.frappe = MagicMock()
		self.frappe.local = self.local
		self.frappe.parse_json.side_effect = lambda value: Data(json.loads(value))
		self.frappe.AuthenticationError = RuntimeError
		self.frappe.QueryDeadlockError = DeadlockError
		self.frappe.QueryTimeoutError = QueryTimeoutError
		self.frappe.throw.side_effect = lambda message, error: self.fail_session(message, error)
		self.persisted = {"user": "fixture", "last_updated": "new", "csrf_token": "stored"}
		self.query = self.frappe.qb.from_.return_value
		self.query.select.return_value.where.return_value.for_update.return_value.run.side_effect = self.read
		self.sessions = SimpleNamespace(get_csrf_token=MagicMock(side_effect=self.native_token))
		spec = importlib.util.spec_from_file_location(
			"tested_session_security", Path("allimquran/session_security.py")
		)
		self.security = importlib.util.module_from_spec(spec)
		with patch.dict(sys.modules, {"frappe": self.frappe}):
			spec.loader.exec_module(self.security)
		self.local.session = Data(user="fixture", sid="fixture-session", data=Data(last_updated="old"))

	@staticmethod
	def fail_session(message, error):
		raise error(message)

	def read(self, **kwargs):
		return [SimpleNamespace(user="fixture", sessiondata=json.dumps(self.persisted))]

	def native_token(self):
		if not self.local.session.data.csrf_token:
			self.local.session.data.csrf_token = "generated"
			self.persisted = deepcopy(self.local.session.data)
		return self.local.session.data.csrf_token

	def run_hook(self):
		with patch.dict(sys.modules, {"frappe.sessions": self.sessions}):
			self.security.before_request()

	def test_guest_options_and_initialized_sessions_do_not_lock_or_write(self):
		for session in (
			None,
			Data(user="Guest", sid="Guest"),
			Data(user="fixture", sid="s", data=Data(csrf_token="keep")),
		):
			self.local.session = session
			self.run_hook()
		self.frappe.qb.from_.assert_not_called()
		self.sessions.get_csrf_token.assert_not_called()

	def test_stale_snapshot_uses_persisted_token_and_metadata(self):
		self.run_hook()
		self.assertEqual(self.local.session.data.csrf_token, "stored")
		self.assertEqual(self.local.session.data.last_updated, "new")
		self.frappe.qb.from_.return_value.select.return_value.where.return_value.for_update.assert_called_once()

	def test_missing_token_uses_native_generator(self):
		del self.persisted["csrf_token"]
		self.run_hook()
		self.assertEqual(self.local.session.data.csrf_token, "generated")
		self.assertEqual(self.persisted["csrf_token"], "generated")
		self.sessions.get_csrf_token.assert_called_once()

	def test_deleted_or_changed_session_is_never_recreated(self):
		for rows in ([], [SimpleNamespace(user="another", sessiondata="{}")]):
			self.query.select.return_value.where.return_value.for_update.return_value.run.side_effect = None
			self.query.select.return_value.where.return_value.for_update.return_value.run.return_value = rows
			with self.assertRaisesRegex(RuntimeError, "Session expired"):
				self.run_hook()
		self.sessions.get_csrf_token.assert_not_called()

	def test_deadlock_and_timeout_restart_the_locked_read(self):
		self.query.select.return_value.where.return_value.for_update.return_value.run.side_effect = [
			DeadlockError(),
			QueryTimeoutError(),
			self.read(),
		]
		with patch.object(self.security.time, "sleep"):
			self.run_hook()
		self.assertEqual(self.frappe.db.rollback.call_count, 2)
		self.assertEqual(self.local.session.data.csrf_token, "stored")
		self.sessions.get_csrf_token.assert_called_once()

	def test_retries_are_bounded_and_do_not_create_a_token_after_failed_lock(self):
		self.query.select.return_value.where.return_value.for_update.return_value.run.side_effect = (
			DeadlockError()
		)
		with patch.object(self.security.time, "sleep"), self.assertRaises(DeadlockError):
			self.run_hook()
		self.assertEqual(self.frappe.db.rollback.call_count, 8)
		self.sessions.get_csrf_token.assert_not_called()

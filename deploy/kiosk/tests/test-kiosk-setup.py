#!/usr/bin/env python3
"""Menu behavior with a temporary filesystem and no real system commands."""
import contextlib
import importlib.machinery
import importlib.util
import io
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.dont_write_bytecode = True
SOURCE = Path(__file__).resolve().parents[1] / 'gmib-configure'
loader = importlib.machinery.SourceFileLoader('kiosk_setup', str(SOURCE))
spec = importlib.util.spec_from_loader(loader.name, loader)
setup = importlib.util.module_from_spec(spec)
loader.exec_module(setup)


class ExecCalled(Exception):
    pass


class MenuTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.addCleanup(patch.stopall)
        self.root = Path(self.temp.name)
        patch.object(setup, 'ROOT', self.root).start()
        self.write('/etc/gmib/clone.conf', 'CLONE_IMAGE=1\n')
        self.write('/etc/gmib/setup.conf', "ADMIN_USER='custom-admin'\n")
        self.write('/run/.placeholder', '')
        self.calls = []
        self.service_state = 'ActiveState=inactive\nJob=\n'
        self.output = io.StringIO()
        patch.object(setup, 'command', self.command).start()
        patch.object(setup, 'run_provision', self.run_provision).start()

    def write(self, name, content):
        p = setup.path(name)
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(content)

    def command(self, *args, capture=False):
        self.calls.append(args)
        if args[0] == 'ip':
            return '2: eth0    inet 192.168.1.22/24 brd 192.168.1.255 scope global eth0\n'
        if args[:2] == ('systemctl', 'show'):
            return self.service_state
        if args[0] == setup.PREPARE:
            self.service_state = 'ActiveState=activating\nJob=123\n'
        return ''

    def run_provision(self, manual=False):
        self.calls.append(('provision', manual))
        if not manual:
            raise ExecCalled()

    def run_menu(self, choices, boot=False):
        values = iter(choices)
        def read(prompt):
            try:
                return next(values)
            except StopIteration:
                raise EOFError() from None
        with contextlib.redirect_stdout(self.output), contextlib.redirect_stderr(self.output):
            setup.menu(boot, read)

    def mutations(self):
        return [call for call in self.calls if call[0] not in ('ip',) and call[:2] != ('systemctl', 'show')]

    def test_initial_menu_has_ip_and_custom_ssh_user(self):
        self.run_menu(['0'])
        self.assertIn('ssh custom-admin@192.168.1.22', self.output.getvalue())
        self.assertIn('Подготовить к клонированию', self.output.getvalue())
        self.assertEqual(self.mutations(), [])

    def test_initial_boot_choice_enters_existing_enrollment(self):
        with self.assertRaises(ExecCalled):
            self.run_menu(['1'], boot=True)
        self.assertEqual(self.mutations(), [('provision', False)])

    def test_personalized_boot_bypasses_menu(self):
        self.write('/var/lib/gmib-clone/personalized.json', '{}')
        with self.assertRaises(ExecCalled):
            self.run_menu([], boot=True)
        self.assertNotIn('Выберите', self.output.getvalue())
        self.assertNotIn('Раскладка', self.output.getvalue())
        self.assertEqual(self.mutations(), [('provision', False)])

    def test_complete_boot_retains_original_recovery(self):
        self.write('/var/lib/gmib-provision/complete', 'vpn-profile')
        with self.assertRaises(ExecCalled):
            self.run_menu([], boot=True)
        self.assertEqual(self.mutations(), [('provision', False)])

    def test_manual_menu_after_enrollment_can_prepare(self):
        self.write('/var/lib/gmib-provision/complete', 'vpn-profile')
        self.write('/var/lib/gmib-clone/personalized.json', '{}')
        self.run_menu(['2', 'CLONE'])
        self.assertEqual(self.mutations(), [('systemctl', 'stop', setup.SERVICE), (setup.PREPARE, '--poweroff')])

    def test_boot_prepare_does_not_stop_itself_before_queueing(self):
        self.run_menu(['2', 'CLONE'], boot=True)
        self.assertEqual(self.mutations(), [(setup.PREPARE, '--poweroff')])

    def test_cancel_or_eof_never_stops_service_or_resets(self):
        for choices in (['2', '', '0'], ['2', 'clone', '0'], ['2'], []):
            self.calls.clear()
            self.run_menu(choices)
            self.assertEqual(self.mutations(), [])

    def test_confirmation_interrupt_is_cancellation(self):
        def interrupted(prompt):
            raise KeyboardInterrupt()
        with contextlib.redirect_stdout(self.output):
            self.assertFalse(setup.confirm_prepare(True, interrupted))
        self.assertEqual(self.mutations(), [])

    def test_boot_eof_idles_without_restart_or_mutation(self):
        with patch.object(setup, 'idle_after_eof') as idle:
            self.run_menu([], boot=True)
        idle.assert_called_once_with()
        self.assertEqual(self.mutations(), [])

    def test_manual_vpn_runs_in_current_terminal_and_restores_console(self):
        self.run_menu(['1', '0'])
        self.assertEqual(self.mutations(), [('systemctl', 'stop', setup.SERVICE),
                                            ('provision', True),
                                            ('systemctl', 'start', '--no-block', setup.SERVICE)])
        self.assertIn('в этом терминале', self.output.getvalue())

    def test_already_enrolled_manual_vpn_is_read_only(self):
        self.write('/var/lib/gmib-provision/complete', 'vpn-profile')
        self.run_menu(['1', '0'])
        self.assertEqual(self.mutations(), [])
        self.assertIn('VPN уже настроен', self.output.getvalue())

    def test_enrollment_lock_rejects_parallel_boot(self):
        with setup.action_lock():
            self.run_menu(['1', '0'])
        self.assertEqual(self.mutations(), [])
        self.assertIn('Другая операция', self.output.getvalue())

    def test_pending_preparation_prevents_enrollment(self):
        for active in ('ActiveState=activating\nJob=\n', 'ActiveState=inactive\nJob=123\n'):
            self.calls.clear()
            self.service_state = active
            self.run_menu(['1', '0'])
            self.assertEqual(self.mutations(), [])
        self.write('/var/lib/gmib-clone/state.json', '{"phase":"preparing"}')
        self.calls.clear()
        self.run_menu(['1', '0'])
        self.assertEqual(self.mutations(), [])

    def test_unavailable_preparation_status_blocks_enrollment(self):
        original = self.command
        def unavailable(*args, capture=False):
            if args[:2] == ('systemctl', 'show'):
                raise subprocess.CalledProcessError(1, args)
            return original(*args, capture=capture)
        with patch.object(setup, 'command', unavailable):
            self.run_menu(['1', '0'])
        self.assertEqual(self.mutations(), [])
        self.assertIn('Не удалось проверить', self.output.getvalue())
        self.service_state = ''
        self.calls.clear()
        self.run_menu(['1', '0'])
        self.assertEqual(self.mutations(), [])

    def test_missing_clone_opt_in_refused(self):
        setup.path('/etc/gmib/clone.conf').unlink()
        with self.assertRaisesRegex(RuntimeError, 'универсальный'):
            self.run_menu(['2', 'CLONE'])
        self.assertEqual(self.mutations(), [])

    def test_second_manual_session_does_not_touch_screen(self):
        with setup.action_lock('gmib-configure-manual.lock'):
            self.run_menu(['1', '0'])
        self.assertEqual(self.mutations(), [])

    def test_cancel_provision_restores_console(self):
        with patch.object(setup, 'run_provision', side_effect=KeyboardInterrupt):
            with self.assertRaises(KeyboardInterrupt):
                setup.enroll_on_console(False)
        self.assertEqual(self.mutations(), [('systemctl', 'stop', setup.SERVICE),
                                            ('systemctl', 'start', '--no-block', setup.SERVICE)])

    def test_interrupted_new_completion_starts_recovery(self):
        def completed_then_interrupted(manual=False):
            self.write('/var/lib/gmib-provision/complete', 'vpn')
            raise SystemExit(0)
        with patch.object(setup, 'run_provision', completed_then_interrupted):
            with self.assertRaises(SystemExit):
                setup.enroll_on_console(False)
        self.assertEqual(self.mutations(), [('systemctl', 'stop', setup.SERVICE),
                                            ('systemctl', 'start', '--no-block', setup.SERVICE)])

    def test_success_does_not_restore_console(self):
        def completed(manual=False):
            self.write('/var/lib/gmib-provision/complete', 'vpn')
        with patch.object(setup, 'run_provision', completed):
            setup.enroll_on_console(False)
        self.assertEqual(self.mutations(), [('systemctl', 'stop', setup.SERVICE)])

    def test_boot_restart_during_manual_session_exits_without_prompt(self):
        with setup.action_lock('gmib-configure-manual.lock'):
            with patch.object(sys, 'argv', ['gmib-configure', '--boot']), \
                 patch.object(setup.os, 'geteuid', return_value=0), \
                 patch.object(setup, 'menu') as menu:
                with self.assertRaisesRegex(RuntimeError, 'по SSH'):
                    setup.main()
        menu.assert_not_called()
        self.assertEqual(self.mutations(), [])

    def test_cli_defaults_to_vpn_and_advanced_to_menu(self):
        for args, advanced in (([], False), (['--advanced'], True)):
            with patch.object(sys, 'argv', ['gmib-configure', *args]), \
                 patch.object(setup.os, 'geteuid', return_value=0), \
                 patch.object(setup, 'menu') as menu, \
                 patch.object(setup, 'enroll_on_console') as enroll:
                setup.main()
                if advanced:
                    menu.assert_called_once_with(False)
                    enroll.assert_not_called()
                else:
                    enroll.assert_called_once_with(False)
                    menu.assert_not_called()


    def test_code_validated_before_service_mutations(self):
        for args in (['--code'], ['--code', 'abc'], ['--code', 'a b c'],
                     ['--code', 'CODE\n'], ['--code', 'КОД123'],
                     ['--code', 'A' * 21], ['--code', 'CODE', '--advanced']):
            with self.subTest(args=args), patch.object(sys, 'argv', ['gmib-configure', *args]):
                with self.assertRaises(RuntimeError):
                    setup.main()
        self.assertEqual(self.mutations(), [])

    def test_code_cli_dispatches_without_menu(self):
        with patch.object(sys, 'argv', ['gmib-configure', '--code', 'TEST-CODE']), \
             patch.object(setup.os, 'geteuid', return_value=0), \
             patch.object(setup.signal, 'signal'), \
             patch.object(setup, 'menu') as menu, \
             patch.object(setup, 'enroll_on_console') as enroll:
            setup.main()
        menu.assert_not_called()
        enroll.assert_called_once_with(False, code='TEST-CODE')

    def test_code_duplicate_owner_never_stops_screen(self):
        with setup.action_lock('gmib-configure-manual.lock'):
            with self.assertRaisesRegex(RuntimeError, 'Другая операция'):
                setup.enroll_on_console(False, code='TEST-CODE')
        self.assertEqual(self.mutations(), [])

    def test_code_already_complete_does_not_redeem(self):
        self.write('/var/lib/gmib-provision/complete', 'vpn')
        with contextlib.redirect_stdout(self.output):
            setup.enroll_on_console(False, code='TEST-CODE')
        self.assertEqual(self.mutations(), [])

    def test_cursor_restored_on_terminal_only(self):
        with patch.object(self.output, 'isatty', return_value=True):
            self.run_menu(['0'])
        self.assertIn('\033[?25h', self.output.getvalue())
        self.output = io.StringIO()
        self.run_menu(['0'])
        self.assertNotIn('\033', self.output.getvalue())

    def test_ip_refresh(self):
        self.run_menu(['r', '0'])
        self.assertEqual(len([call for call in self.calls if call[0] == 'ip']), 2)


if __name__ == '__main__':
    unittest.main()

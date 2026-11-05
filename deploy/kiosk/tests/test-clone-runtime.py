#!/usr/bin/env python3
"""Exercise clone state transitions with all commands mocked and an isolated root."""
import importlib.machinery
import importlib.util
import json
from pathlib import Path
import subprocess
import shutil
import tempfile
import sys
import unittest
from unittest.mock import patch

sys.dont_write_bytecode = True
SOURCE = Path(__file__).resolve().parents[1] / 'gmib-clone-personalize'
loader = importlib.machinery.SourceFileLoader('clone_runtime', str(SOURCE))
spec = importlib.util.spec_from_loader(loader.name, loader)
clone = importlib.util.module_from_spec(spec)
loader.exec_module(clone)
PARENT = 'a' * 32
CHILD = 'b' * 32


class CloneTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.addCleanup(patch.stopall)
        patch.object(clone, 'ROOT', self.root).start()
        self.commands = []
        self.profiles = []
        patch.object(clone, 'run', self.run_command).start()
        patch.object(clone, 'generate_id', lambda: clone.path('/proc/sys/kernel/random/uuid').read_text()).start()
        patch.object(clone.subprocess, 'run', lambda *a, **k: subprocess.CompletedProcess(a, 1)).start()
        self.write('/etc/gmib/clone.conf', 'CLONE_IMAGE=1\nKIOSK_USER=gmib\nKIOSK_HOME=/home/gmib\n')
        self.write('/etc/machine-id', PARENT)
        self.write('/proc/sys/kernel/random/uuid', CHILD)
        self.write('/proc/sys/kernel/random/boot_id', 'boot-one')
        self.write('/etc/ssh/ssh_host_ed25519_key', 'private-parent')
        self.write('/home/admin/.ssh/authorized_keys', 'public-admin')
        self.write('/home/gmib/customer/identity', 'customer-managed')
        self.write('/home/gmib/.config/gmib/gmib-local.json', json.dumps({
            'signedLicense': 'secret', 'announce': 'legacy', 'iv': 'vector', 'identifier': 'parent',
            'remoteAuth': {'secret': 'value'}, 'autoUpdate': True,
        }))
        self.write('/var/lib/gmib-provision/complete', 'parent-profile')
        self.write('/var/lib/systemd/random-seed', 'parent-seed')
        self.write('/var/lib/cloud/instance/user-data.txt', 'cached installer')

    def write(self, name, value):
        target = clone.path(name)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(value)

    def run_command(self, *args, capture=False):
        self.commands.append(args)
        if args[:2] == ('pritunl-client', 'list'):
            return json.dumps(self.profiles)
        if args == ('ssh-keygen', '-A'):
            key = clone.path('/etc/ssh/ssh_host_ed25519_key')
            if not key.exists():
                self.write('/etc/ssh/ssh_host_ed25519_key', 'key-for-' + clone.machine_id())
        if args[:2] == ('pritunl-client', 'remove'):
            self.profiles = [p for p in self.profiles if p['id'] != args[2]]
        return ''

    def arm(self):
        clone.save({'phase': 'armed', 'parent_id': PARENT})

    def test_reference_boot_is_noop(self):
        clone.personalize()
        self.assertEqual(clone.machine_id(), PARENT)
        self.assertEqual(self.commands, [])

    def test_preparation_cleans_only_owned_identity(self):
        self.profiles = [{'id': 'profile-1'}]
        clone.prepare()
        self.assertEqual(clone.state_read()['phase'], 'armed')
        gate_stop = self.commands.index(('systemctl', 'stop', 'gmib-clone-personalize.service'))
        kiosk_stop = self.commands.index(('systemctl', 'stop', 'gmib-provision.service', 'gmib-cage@tty1.service'))
        daemon_start = self.commands.index(('systemctl', '--job-mode=ignore-dependencies', 'start', 'pritunl-client.service'))
        self.assertLess(gate_stop, kiosk_stop)
        self.assertLess(kiosk_stop, daemon_start)
        self.assertEqual(clone.machine_id(), PARENT)  # Replaced only on the clone boot.
        self.assertFalse(clone.path('/etc/ssh/ssh_host_ed25519_key').exists())
        self.assertFalse(clone.path('/var/lib/gmib-provision').exists())
        self.assertFalse(clone.path('/var/lib/systemd/random-seed').exists())
        self.assertFalse(clone.path('/var/lib/cloud').exists())
        self.assertTrue(clone.path('/etc/cloud/cloud-init.disabled').exists())
        self.assertEqual(clone.path('/home/admin/.ssh/authorized_keys').read_text(), 'public-admin')
        self.assertEqual(clone.path('/home/gmib/customer/identity').read_text(), 'customer-managed')
        self.assertEqual(json.loads(clone.path('/home/gmib/.config/gmib/gmib-local.json').read_text()), {'autoUpdate': True})
        self.assertEqual(self.profiles, [])
        self.assertEqual(self.commands[-1], ('systemctl', 'poweroff'))

    def test_failure_during_preparation_blocks_boot(self):
        self.profiles = [{'id': '../bad'}]
        with self.assertRaisesRegex(RuntimeError, 'profile ID'):
            clone.prepare()
        self.assertEqual(clone.state_read()['phase'], 'preparing')
        with self.assertRaisesRegex(RuntimeError, 'interrupted'):
            clone.personalize()
        self.assertNotIn(('systemctl', 'poweroff'), self.commands)

    def test_interrupted_preparation_can_restart_cleanup_daemon(self):
        clone.save({'phase': 'preparing', 'parent_id': PARENT})
        clone.prepare()
        self.assertEqual(clone.state_read()['phase'], 'armed')
        self.assertIn(('systemctl', '--job-mode=ignore-dependencies', 'start', 'pritunl-client.service'), self.commands)
        self.assertNotIn(('cloud-init', 'status', '--wait'), self.commands)

    def test_relative_dbus_symlink_is_supported(self):
        self.arm()
        dbus = clone.path('/var/lib/dbus/machine-id')
        dbus.parent.mkdir(parents=True)
        dbus.symlink_to('../../../etc/machine-id')
        with self.assertRaisesRegex(RuntimeError, 'reboot scheduled'):
            clone.personalize()
        self.assertTrue(dbus.is_symlink())
        self.assertEqual(dbus.read_text().strip(), CHILD)

    def test_first_boot_reboots_then_keeps_identity(self):
        self.arm()
        with self.assertRaisesRegex(RuntimeError, 'reboot scheduled'):
            clone.personalize()
        self.assertEqual(clone.machine_id(), CHILD)
        self.assertEqual(clone.path('/var/lib/dbus/machine-id').read_text().strip(), CHILD)
        self.assertIn(('ssh-keygen', '-A'), self.commands)
        with self.assertRaisesRegex(RuntimeError, 'reboot is required'):
            clone.personalize()
        self.write('/proc/sys/kernel/random/boot_id', 'boot-two')
        clone.personalize()
        self.assertIsNone(clone.state_read())
        self.commands.clear()
        clone.personalize()
        self.assertEqual(clone.machine_id(), CHILD)
        self.assertEqual(self.commands, [])

    def test_power_loss_reuses_pending_id(self):
        self.arm()
        original = clone.atomic
        def fail_machine_id(name, *args, **kwargs):
            if str(name) == '/etc/machine-id':
                raise OSError('simulated power loss')
            original(name, *args, **kwargs)
        with patch.object(clone, 'atomic', fail_machine_id):
            with self.assertRaises(OSError):
                clone.personalize()
        self.assertEqual(clone.state_read()['device_id'], CHILD)
        self.write('/proc/sys/kernel/random/uuid', 'c' * 32)
        with self.assertRaisesRegex(RuntimeError, 'reboot scheduled'):
            clone.personalize()
        self.assertEqual(clone.machine_id(), CHILD)

    def test_two_copies_receive_distinct_identity_and_keys(self):
        clone.prepare()
        with tempfile.TemporaryDirectory() as second:
            second_root = Path(second) / 'copy'
            shutil.copytree(self.root, second_root)
            with self.assertRaisesRegex(RuntimeError, 'reboot scheduled'):
                clone.personalize()
            first_key = clone.path('/etc/ssh/ssh_host_ed25519_key').read_text()
            with patch.object(clone, 'ROOT', second_root):
                self.write('/proc/sys/kernel/random/uuid', 'c' * 32)
                with self.assertRaisesRegex(RuntimeError, 'reboot scheduled'):
                    clone.personalize()
                self.assertEqual(clone.machine_id(), 'c' * 32)
                self.assertNotEqual(clone.path('/etc/ssh/ssh_host_ed25519_key').read_text(), first_key)
            self.assertEqual(clone.machine_id(), CHILD)

    def test_missing_opt_in_refused(self):
        clone.path('/etc/gmib/clone.conf').unlink()
        with self.assertRaisesRegex(RuntimeError, 'not a cloning image'):
            clone.prepare()
        self.assertEqual(self.commands, [])

    def test_symlink_preflight_preserves_external_file(self):
        target = clone.path('/home/gmib/.config/gmib/gmib-local.json')
        target.unlink()
        target.symlink_to(self.root / 'outside')
        with self.assertRaisesRegex(RuntimeError, 'symlink'):
            clone.prepare()
        self.assertIsNone(clone.state_read())

    def test_malformed_pending_id_refused(self):
        clone.save({'phase': 'armed', 'parent_id': PARENT, 'device_id': '../bad'})
        with self.assertRaisesRegex(RuntimeError, 'pending machine-id'):
            clone.personalize()
        self.assertEqual(clone.machine_id(), PARENT)


if __name__ == '__main__':
    unittest.main()

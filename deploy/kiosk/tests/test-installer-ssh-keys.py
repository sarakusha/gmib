#!/usr/bin/env python3
"""Installer key import tests: real key validation, isolated target, mocked mounts."""
import importlib.machinery
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.dont_write_bytecode = True
SOURCE = Path(__file__).resolve().parents[1] / 'import-installer-ssh-keys'
loader = importlib.machinery.SourceFileLoader('installer_keys', str(SOURCE))
spec = importlib.util.spec_from_loader(loader.name, loader)
helper = importlib.util.module_from_spec(spec)
loader.exec_module(helper)


def inventory():
    return {'blockdevices': [
        {'name': '/dev/sda', 'type': 'disk', 'pkname': None, 'maj:min': '8:0', 'children': [
            {'name': '/dev/sda1', 'type': 'part', 'pkname': '/dev/sda', 'maj:min': '8:1',
             'fstype': 'iso9660', 'label': 'GMIB_KIOSK_2404'},
            {'name': '/dev/sda3', 'type': 'part', 'pkname': '/dev/sda', 'maj:min': '8:3',
             'fstype': 'vfat', 'label': 'GMIB-SETUP'}]},
        {'name': '/dev/sdb', 'type': 'disk', 'pkname': None, 'maj:min': '8:16', 'children': [
            {'name': '/dev/sdb1', 'type': 'part', 'pkname': '/dev/sdb', 'maj:min': '8:17',
             'fstype': 'vfat', 'label': 'GMIB-SETUP'}]}]}


MOUNT = {'filesystems': [{'source': '/dev/disk/by-label/GMIB_KIOSK_2404', 'maj:min': '8:1',
                          'fstype': 'iso9660'}]}


class InstallerKeyTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.keys_temp = tempfile.TemporaryDirectory()
        cls.addClassCleanup(cls.keys_temp.cleanup)
        cls.keys = []
        for index in range(3):
            key = Path(cls.keys_temp.name) / str(index)
            subprocess.run(['ssh-keygen', '-q', '-t', 'ed25519', '-N', '', '-f', str(key)], check=True)
            cls.keys.append(' '.join(key.with_suffix('.pub').read_text().split()[:2]))

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.target = self.root / 'target'
        self.target.mkdir()
        (self.target / 'etc').mkdir()
        (self.target / 'etc/passwd').write_text(f'admin:x:{os.getuid()}:{os.getgid()}:Admin:/home/admin:/bin/bash\n')
        self.ssh = self.target / 'home/admin/.ssh'
        self.ssh.mkdir(parents=True)
        self.authorized = self.ssh / 'authorized_keys'
        self.original = '# maintenance key\n' + self.keys[0] + ' maintenance\n'
        self.authorized.write_text(self.original)
        self.external = self.root / 'authorized_keys'

    def test_source_alias_is_matched_by_device_id_and_only_same_disk_is_used(self):
        self.assertEqual(helper.select_partition(MOUNT, inventory()), '/dev/sda3')
        whole = {'filesystems': [{'source': '/dev/sda', 'maj:min': '8:0', 'fstype': 'iso9660'}]}
        self.assertEqual(helper.select_partition(whole, inventory()), '/dev/sda3')

    def test_unrelated_usb_is_never_used_as_fallback(self):
        devices = inventory()
        devices['blockdevices'][0]['children'].pop()
        self.assertIsNone(helper.select_partition(MOUNT, devices))

    def test_optical_or_loop_boot_skips_unrelated_labeled_partition(self):
        for kind in ('rom', 'loop'):
            devices = inventory()
            devices['blockdevices'].append({'name': '/dev/sr0', 'type': kind, 'maj:min': '11:0'})
            mount = {'filesystems': [{'source': '/dev/sr0', 'maj:min': '11:0', 'fstype': 'iso9660'}]}
            self.assertIsNone(helper.select_partition(mount, devices))

    def test_multiple_siblings_or_nonfat_partition_are_errors(self):
        devices = inventory()
        devices['blockdevices'][0]['children'].append(dict(devices['blockdevices'][0]['children'][1],
                                                         name='/dev/sda4', **{'maj:min': '8:4'}))
        with self.assertRaisesRegex(RuntimeError, 'Multiple'):
            helper.select_partition(MOUNT, devices)
        devices = inventory()
        devices['blockdevices'][0]['children'][1]['fstype'] = 'ext4'
        with self.assertRaisesRegex(RuntimeError, 'FAT'):
            helper.select_partition(MOUNT, devices)

    def test_missing_empty_comments_only_are_noop(self):
        self.assertEqual(helper.read_keys(self.external), [])
        for contents in ('', '# Put your public keys below.\n# Один ключ на строку.\n', '\ufeff# comments\r\n\r\n'):
            self.external.write_text(contents)
            self.assertEqual(helper.read_keys(self.external), [])
            self.assertEqual(helper.merge_keys(self.target, 'admin', []), 0)
            self.assertEqual(self.authorized.read_text(), self.original)

    def test_all_keys_crlf_bom_comments_duplicates_and_idempotence(self):
        self.external.write_bytes(('\ufeff# Client public keys\r\n' + self.keys[1] + " client's laptop\r\n"
                                  + self.keys[2] + '\r\n' + self.keys[1] + '\r\n' + self.keys[0] + '\r\n').encode())
        keys = helper.read_keys(self.external)
        self.assertEqual(keys, [self.keys[1], self.keys[2], self.keys[0]])
        self.assertEqual(helper.merge_keys(self.target, 'admin', keys), 2)
        expected = self.original + self.keys[1] + '\n' + self.keys[2] + '\n'
        self.assertEqual(self.authorized.read_text(), expected)
        self.assertEqual(helper.merge_keys(self.target, 'admin', keys), 0)
        self.assertEqual(self.authorized.read_text(), expected)
        self.assertEqual(self.ssh.stat().st_mode & 0o777, 0o700)
        self.assertEqual(self.authorized.stat().st_mode & 0o777, 0o600)
        self.assertEqual(self.authorized.stat().st_uid, os.getuid())
        self.assertEqual(self.authorized.stat().st_gid, os.getgid())

    def test_invalid_private_options_and_mixed_invalid_leave_existing_keys_intact(self):
        values = ('not a public key', '-----BEGIN OPENSSH PRIVATE KEY-----\n',
                  'command="touch /tmp/injected" ' + self.keys[1],
                  'ssh-ed25519 AAAA', self.keys[1] + '\ninvalid second line')
        for value in values:
            self.external.write_text(value)
            with self.assertRaises(RuntimeError):
                helper.read_keys(self.external)
            self.assertEqual(self.authorized.read_text(), self.original)

    def test_oversized_binary_and_symlink_are_rejected(self):
        for data in (b'x' * (helper.MAX_BYTES + 1), b'\x00text', b'\xff'):
            self.external.write_bytes(data)
            with self.assertRaises(RuntimeError):
                helper.read_keys(self.external)
        self.external.unlink()
        self.external.symlink_to(self.authorized)
        with self.assertRaises(OSError):
            helper.read_keys(self.external)

    def test_many_lines_are_validated_and_deduplicated_without_a_key_count_cap(self):
        self.external.write_text((self.keys[1] + '\n') * 65 + self.keys[2] + '\n')
        self.assertEqual(helper.read_keys(self.external), [self.keys[1], self.keys[2]])

    def test_target_symlink_is_refused(self):
        self.authorized.unlink()
        external = self.root / 'outside'
        external.write_text('unchanged')
        self.authorized.symlink_to(external)
        with self.assertRaisesRegex(RuntimeError, 'symlink'):
            helper.merge_keys(self.target, 'admin', [self.keys[1]])
        self.assertEqual(external.read_text(), 'unchanged')

    def test_import_mounts_selected_partition_readonly_and_unmounts_before_merge(self):
        calls = []
        actual_command = helper.command
        def commands(*args):
            calls.append(args)
            if args[0] == 'findmnt':
                return json.dumps(MOUNT)
            if args[0] == 'lsblk':
                return json.dumps(inventory())
            if args[0] == 'mount':
                (Path(args[-1]) / 'authorized_keys').write_text(self.keys[1] + '\n' + self.keys[2] + '\n')
                return ''
            if args[0] == 'umount':
                self.assertEqual(self.authorized.read_text(), self.original)
                return ''
            return actual_command(*args)
        with patch.object(helper, 'command', commands):
            helper.import_keys(self.target, 'admin')
        mounts = [args for args in calls if args[0] == 'mount']
        self.assertEqual(len(mounts), 1)
        self.assertEqual(mounts[0][1:-1], ('-t', 'vfat', '-o', 'ro,nosuid,nodev,noexec', '/dev/sda3'))
        self.assertEqual(self.authorized.read_text(), self.original + self.keys[1] + '\n' + self.keys[2] + '\n')

    def test_invalid_file_still_unmounts_and_no_partial_import_occurs(self):
        calls = []
        actual_command = helper.command
        def commands(*args):
            calls.append(args)
            if args[0] == 'mount':
                (Path(args[-1]) / 'authorized_keys').write_text(self.keys[1] + '\ninvalid')
                return ''
            if args[0] == 'umount':
                return ''
            return actual_command(*args)
        with patch.object(helper, 'discover_partition', return_value='/dev/sda3'), patch.object(helper, 'command', commands):
            with self.assertRaises(RuntimeError):
                helper.import_keys(self.target, 'admin')
        self.assertEqual(len([args for args in calls if args[0] == 'umount']), 1)
        self.assertEqual(self.authorized.read_text(), self.original)


if __name__ == '__main__':
    unittest.main()

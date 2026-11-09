#!/usr/bin/env python3
"""Build synthetic ISOs to check the unified installer payload without touching a host."""
import hashlib
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

KIOSK = Path(__file__).resolve().parents[1]

STUB = r'''#!/usr/bin/env python3
import os
from pathlib import Path
import shutil
import sys
name = Path(sys.argv[0]).name
args = sys.argv[1:]
if name == 'file':
    print('ELF 64-bit LSB executable, x86-64')
elif name == 'dpkg-deb':
    package = 'zabbix-agent2' if 'zabbix' in args[1] else 'pritunl-client'
    print({'Package': package, 'Architecture': 'amd64', 'Version': '1:7.4.14-1+ubuntu24.04'}[args[2]])
elif name == 'xorriso':
    if '-extract' in args:
        pos = args.index('-extract')
        source, destination = args[pos + 1:pos + 3]
        Path(destination).write_text('Ubuntu-Server 24.04.4 LTS amd64\n' if source == '/.disk/info'
            else 'linux /casper/vmlinuz ---\n')
    else:
        output = Path(args[args.index('-outdev') + 1])
        output.write_text('synthetic ISO\n')
        capture = Path(os.environ['CAPTURE'])
        for i, arg in enumerate(args):
            if arg == '-map':
                source, destination = args[i + 1:i + 3]
                if destination == '/gmib-installer':
                    shutil.copytree(source, capture / 'payload')
                elif destination == '/autoinstall.yaml':
                    shutil.copyfile(source, capture / 'autoinstall.yaml')
else:
    raise SystemExit('unexpected test tool')
'''


class CloneBuilderTest(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix='gmib-clone-builder-')
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.bin = self.root / 'bin'
        self.bin.mkdir()
        for name in ('file', 'dpkg-deb', 'xorriso'):
            script = self.bin / name
            script.write_text(STUB)
            script.chmod(0o755)
        self.capture = self.root / 'capture'
        self.capture.mkdir()
        self.env = dict(os.environ, PATH=str(self.bin) + os.pathsep + os.environ['PATH'],
                        CAPTURE=str(self.capture))
        self.base = self.root / 'ubuntu.iso'
        self.base.write_bytes(b'synthetic base')
        for filename in ('gmib.AppImage', 'pritunl.deb', 'zabbix.deb'):
            (self.root / filename).write_bytes(b'fixture')
        subprocess.run(['ssh-keygen', '-q', '-t', 'ed25519', '-N', '', '-f', str(self.root / 'key')],
                       check=True, capture_output=True)

    def build(self, variant=False, revision=None):
        suffix = '-patch1' if revision is None else (f'-{revision}' if revision else '')
        output = self.root / f'gmib-kiosk-5.7.6{suffix}-ubuntu-24.04.4-amd64.iso'
        args = ['bash', str(KIOSK / 'build-autoinstall-iso.sh'),
                '--base-iso', str(self.base), '--base-iso-sha256', hashlib.sha256(self.base.read_bytes()).hexdigest(),
                '--appimage', str(self.root / 'gmib.AppImage'), '--gmib-version', '5.7.6',
                '--pritunl-deb', str(self.root / 'pritunl.deb'), '--zabbix-agent2-deb', str(self.root / 'zabbix.deb'),
                '--bootstrap-url', 'https://example.test/enroll/gmib', '--ssh-authorized-key', str(self.root / 'key.pub'),
                '--output', str(output)]
        if variant:
            args.append('--clone-image')
        if revision is not None:
            args += ['--image-revision', revision]
        return subprocess.run(args, env=self.env, text=True, capture_output=True)

    def test_multiple_public_keys_are_separate_yaml_entries(self):
        first = (self.root / 'key.pub').read_text().split()[:2]
        second_path = self.root / 'second'
        subprocess.run(['ssh-keygen', '-q', '-t', 'ed25519', '-N', '', '-f', str(second_path)],
                       check=True, capture_output=True)
        second = second_path.with_suffix('.pub').read_text().split()[:2]
        (self.root / 'key.pub').write_bytes((
            "# customer and maintenance keys\r\n\r\n" + ' '.join(first) + " user's key\r\n"
            + ' '.join(second) + " second\r\n" + ' '.join(first) + " duplicate\r\n").encode())
        result = self.build()
        self.assertEqual(result.returncode, 0, result.stderr)
        yaml = (self.capture / 'autoinstall.yaml').read_text()
        entries = yaml.split('    authorized-keys:\n', 1)[1].split('  storage:', 1)[0].splitlines()
        self.assertEqual(entries, ["      - '" + ' '.join(key) + "'" for key in (first, second)])

    def test_public_key_validation_rejects_unsafe_or_invalid_input(self):
        valid = (self.root / 'key.pub').read_text()
        invalid = ['', '# only a comment\n', 'ssh-ed25519 AAAATEST invalid\n',
                   '-----BEGIN OPENSSH PRIVATE KEY-----\n',
                   'command="echo unsafe" ' + valid, valid + 'not a key\n']
        for contents in invalid:
            with self.subTest(contents=contents[:35]):
                (self.root / 'key.pub').write_text(contents)
                result = subprocess.run(['bash', str(KIOSK / 'read-ssh-public-keys.sh'), str(self.root / 'key.pub')],
                                        text=True, capture_output=True)
                self.assertNotEqual(result.returncode, 0)
                self.assertEqual(result.stdout, '')

    def test_default_payload_complete_and_checksummed(self):
        result = self.build()
        self.assertEqual(result.returncode, 0, result.stderr)
        payload = self.capture / 'payload'
        for name in ('clone.conf', 'gmib-prepare-clone', 'gmib-clone-personalize',
                     'gmib-clone-personalize.service', 'gmib-clone-identity.conf',
                     'gmib-configure', 'gmib-kiosk-setup', 'gmib-kiosk-setup.conf', 'setup.conf'):
            self.assertTrue((payload / name).is_file(), name)
            self.assertIn(f'  {name}\n', (payload / 'SHA256SUMS').read_text())
        self.assertIn('CLONE_IMAGE=1', (payload / 'clone.conf').read_text())
        self.assertIn("IMAGE_REVISION='patch1'", (payload / 'image-release').read_text())
        self.assertEqual((payload / 'setup.conf').read_text(), "ADMIN_USER='admin'\n")
        subprocess.run(['sha256sum', '-c', 'SHA256SUMS'], cwd=payload, check=True, capture_output=True)

    def test_default_install_stages_configuration_and_identity_gates(self):
        result = self.build()
        self.assertEqual(result.returncode, 0, result.stderr)
        payload = self.capture / 'payload'
        installer = (KIOSK / 'install-target.sh').read_text()
        block = installer.split('# Install configuration and gate boot services on clone identity.', 1)[1].split('# Keep the kiosk boot clean', 1)[0]
        # Execute only the staging block, redirecting every destination.
        for base in ('/etc', '/usr/local'):
            block = block.replace(base, str(self.root / 'target') + base)
        target = self.root / 'target'
        for base in ('etc/gmib', 'etc/systemd/system', 'usr/local/sbin'):
            (target / base).mkdir(parents=True, exist_ok=True)
        env = dict(self.env, PAYLOAD_DIR=str(payload))
        subprocess.run(['bash', '-euc', block], env=env, check=True)
        units = ('systemd-networkd.service', 'NetworkManager.service', 'networking.service',
                 'ssh.service', 'ssh.socket', 'pritunl-client.service', 'gmib-provision.service',
                 'gmib-cage@.service', 'zabbix-agent2.service')
        for unit in units:
            dropin = target / f'etc/systemd/system/{unit}.d/clone-identity.conf'
            self.assertEqual(dropin.read_bytes(), (payload / 'gmib-clone-identity.conf').read_bytes())
        self.assertEqual((target / 'usr/local/sbin/gmib-clone-personalize').stat().st_mode & 0o777, 0o755)
        for name in ('gmib-configure', 'gmib-kiosk-setup'):
            installed = target / 'usr/local/sbin' / name
            self.assertEqual(installed.stat().st_mode & 0o777, 0o755)
            self.assertEqual(installed.read_bytes(), (payload / name).read_bytes())
        self.assertEqual((target / 'etc/gmib/setup.conf').read_bytes(), (payload / 'setup.conf').read_bytes())
        self.assertEqual((target / 'etc/systemd/system/gmib-provision.service.d/setup-menu.conf').read_bytes(),
                         (payload / 'gmib-kiosk-setup.conf').read_bytes())

    def test_deprecated_alias_builds_the_same_default_filename(self):
        result = self.build(variant=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('--clone-image is deprecated', result.stderr)
        self.assertTrue((self.root / 'gmib-kiosk-5.7.6-patch1-ubuntu-24.04.4-amd64.iso').is_file())

    def test_legacy_clone_and_invalid_revision_labels_are_rejected(self):
        for revision, error in (('clone1', 'reserved for legacy images'), ('../patch1', 'lowercase label')):
            with self.subTest(revision=revision):
                result = self.build(revision=revision)
                self.assertNotEqual(result.returncode, 0)
                self.assertIn(error, result.stderr)

    def test_server_build_rejects_legacy_destination_before_any_changes(self):
        for options in (['--public-dir', str(self.root / 'gmib-kiosk-clone')],
                        ['--public-base-url', 'https://example.test/downloads/gmib-kiosk-clone']):
            with self.subTest(options=options):
                result = subprocess.run(['bash', str(KIOSK / 'build-and-publish-on-server.sh'),
                                         '--clone-image', *options],
                                        env=self.env, text=True, capture_output=True)
                self.assertNotEqual(result.returncode, 0)
                self.assertIn('reserved for legacy images', result.stderr)


if __name__ == '__main__':
    unittest.main()

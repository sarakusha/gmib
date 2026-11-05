#!/usr/bin/env python3
"""Build synthetic ISOs to check clone payload isolation without touching a host."""
import hashlib
import os
from pathlib import Path
import shutil
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
        (self.root / 'key.pub').write_text('ssh-ed25519 AAAATEST fixture\n')

    def build(self, variant=False, revision=None):
        suffix = '-clone1' if variant and revision is None else (f'-{revision}' if revision else '')
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

    def test_ordinary_image_has_no_clone_runtime(self):
        result = self.build()
        self.assertEqual(result.returncode, 0, result.stderr)
        payload = self.capture / 'payload'
        self.assertFalse((payload / 'clone.conf').exists())
        self.assertFalse((payload / 'gmib-clone-personalize').exists())
        self.assertNotIn('gmib-clone-', (payload / 'SHA256SUMS').read_text())

    def test_clone_payload_complete_and_checksummed(self):
        result = self.build(variant=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        payload = self.capture / 'payload'
        for name in ('clone.conf', 'gmib-prepare-clone', 'gmib-clone-personalize',
                     'gmib-clone-personalize.service', 'gmib-clone-identity.conf'):
            self.assertTrue((payload / name).is_file(), name)
            self.assertIn(f'  {name}\n', (payload / 'SHA256SUMS').read_text())
        self.assertIn('CLONE_IMAGE=1', (payload / 'clone.conf').read_text())
        self.assertIn("IMAGE_REVISION='clone1'", (payload / 'image-release').read_text())
        subprocess.run(['sha256sum', '-c', 'SHA256SUMS'], cwd=payload, check=True, capture_output=True)

    def test_clone_install_stages_gates_only_when_opted_in(self):
        result = self.build(variant=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        payload = self.capture / 'payload'
        installer = (KIOSK / 'install-target.sh').read_text()
        block = installer.split('# Only the explicitly selected clone installer', 1)[1].split('# Keep the kiosk boot clean', 1)[0]
        # Execute only the install-only branch, redirecting every destination.
        block = '#' + block
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
        shutil.rmtree(target)
        (payload / 'clone.conf').unlink()
        subprocess.run(['bash', '-euc', block], env=env, check=True)
        self.assertFalse(target.exists())

    def test_revision_cannot_mislabel_variant(self):
        for variant, revision in ((True, 'patch1'), (False, 'clone1'), (True, '../clone1')):
            with self.subTest(variant=variant, revision=revision):
                result = self.build(variant=variant, revision=revision)
                self.assertNotEqual(result.returncode, 0)
                self.assertIn('Clone', result.stderr)

    def test_clone_publisher_rejects_old_namespace_and_deletion(self):
        for options in (['--replace-current'],
                        ['--public-dir', '/home/user/src/app-server/public/downloads/gmib-kiosk'],
                        ['--public-base-url', 'https://example.test/downloads/gmib-kiosk']):
            with self.subTest(options=options):
                result = subprocess.run(['bash', str(KIOSK / 'build-and-publish-on-server.sh'), '--clone-image', *options],
                                        env=self.env, text=True, capture_output=True)
                self.assertNotEqual(result.returncode, 0)
                self.assertTrue('Clone publication' in result.stderr or 'cannot be combined' in result.stderr, result.stderr)


if __name__ == '__main__':
    unittest.main()

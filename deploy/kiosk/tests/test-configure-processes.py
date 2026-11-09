#!/usr/bin/env python3
"""Linux process tests: real flock ownership, terminal EOF and signal cleanup."""
import fcntl
import importlib.machinery
import importlib.util
import os
from pathlib import Path
import select
import signal
import subprocess
import sys
import tempfile
import time
import unittest

KIOSK = Path(__file__).resolve().parents[1]
CONFIGURE = KIOSK / 'gmib-configure'


def wait_until(predicate, timeout=5):
    end = time.monotonic() + timeout
    while time.monotonic() < end:
        if predicate():
            return
        time.sleep(.02)
    raise AssertionError('Timed out waiting for process condition')


@unittest.skipUnless(sys.platform == 'linux', 'installed runtime targets Linux')
class ProcessTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.bin = self.root / 'bin'
        self.bin.mkdir()
        (self.root / 'run').mkdir()
        (self.root / 'etc/gmib').mkdir(parents=True)
        (self.root / 'etc/gmib/clone.conf').write_text('CLONE_IMAGE=1\n')
        (self.root / 'etc/gmib/setup.conf').write_text('ADMIN_USER=admin\n')
        (self.root / 'config').write_text('BOOTSTRAP_URL=https://example.invalid/enroll\n')
        (self.root / 'id').write_text('a' * 32)
        self.script('systemctl', '''echo "$*" >>"$FIXTURE/commands"
if [ "$1" = show ]; then
  printf 'ActiveState=inactive\\nJob=\\n'
fi
''')
        for name in ('hostnamectl', 'clear'):
            self.script(name, 'exit 0\n')
        self.script('jq', 'cat\n')
        self.script('curl', '''touch "$FIXTURE/request"
while [ ! -e "$FIXTURE/release" ]; do sleep .05; done
exit 1
''')
        self.env = dict(os.environ, FIXTURE=str(self.root), PATH=str(self.bin) + ':' + os.environ['PATH'],
                        GMIB_PROVISION_CONFIG=str(self.root / 'config'),
                        GMIB_PROVISION_MACHINE_ID_FILE=str(self.root / 'id'),
                        GMIB_PROVISION_STATE_DIR=str(self.root / 'state'),
                        GMIB_PROVISION_MAC_ADDRESSES_JSON='[]',
                        GMIB_PROVISION_LOCK_DIR=str(self.root / 'run'),
                        GMIB_PROVISION_CLONE_STATE=str(self.root / 'clone-state'))
        self.children = []
        self.addCleanup(self.stop_children)

    def script(self, name, text):
        target = self.bin / name
        target.write_text('#!/bin/sh\n' + text)
        target.chmod(0o755)
        return target

    def stop_children(self):
        for child in self.children:
            if child.poll() is None:
                os.killpg(child.pid, signal.SIGKILL)
            child.wait()
            for pipe in (child.stdin, child.stdout, child.stderr):
                if pipe:
                    pipe.close()

    def launch(self, args):
        child = subprocess.Popen(args, env=self.env, stdin=subprocess.PIPE,
                                 stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                                 start_new_session=True)
        self.children.append(child)
        return child

    def available(self, name):
        with (self.root / 'run' / name).open('a') as lock:
            try:
                fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError:
                return False
        return True

    def wait_prompt(self, child):
        seen = b''
        end = time.monotonic() + 5
        while time.monotonic() < end:
            readable, _, _ = select.select([child.stdout], [], [], .1)
            if readable:
                data = os.read(child.stdout.fileno(), 4096)
                if not data:
                    self.fail('Process exited before prompt: ' + seen.decode())
                seen += data
                if 'Получите одноразовый код'.encode() in seen:
                    wait_until(lambda: self.available('gmib-kiosk-setup.lock'))
                    return
        self.fail('No prompt: ' + seen.decode())

    def provision(self):
        return self.launch(['bash', str(KIOSK / 'first-boot-provision.sh')])

    def configure(self, args, provision=None):
        # Inject test filesystem/child path through import, with no production
        # environment escape hatch for root paths or command identities.
        program = f'''import importlib.machinery, importlib.util, pathlib, sys
loader = importlib.machinery.SourceFileLoader('configure', {str(CONFIGURE)!r})
spec = importlib.util.spec_from_loader(loader.name, loader)
m = importlib.util.module_from_spec(spec)
loader.exec_module(m)
m.ROOT = pathlib.Path({str(self.root)!r})
m.PROVISION = {str(provision or KIOSK / 'first-boot-provision.sh')!r}
m.os.geteuid = lambda: 0
sys.argv = ['gmib-configure'] + {args!r}
m.main()
'''
        return self.launch([sys.executable, '-u', '-c', program])

    def test_prompt_unlocks_transaction_but_second_raw_reader_is_rejected(self):
        first = self.provision()
        self.wait_prompt(first)
        second = self.provision()
        self.assertEqual(second.wait(timeout=5), 1)
        self.assertFalse((self.root / 'request').exists())
        first.stdin.close()
        first.stdin = None
        self.assertEqual(first.wait(timeout=5), 130)
        self.assertTrue(self.available('gmib-provision-session.lock'))

    def test_ssh_takes_idle_screen_and_eof_restores_it(self):
        # systemctl's stop is synchronous: terminate the real boot supervisor,
        # which reaps its real provisioning group before the SSH prompt starts.
        self.script('systemctl', '''echo "$*" >>"$FIXTURE/commands"
if [ "$1" = show ]; then
  printf 'ActiveState=inactive\\nJob=\\n'
elif [ "$1" = stop ] && [ -f "$FIXTURE/screen-pid" ]; then
  pid=$(cat "$FIXTURE/screen-pid")
  kill -TERM "$pid"
  while [ -e "/proc/$pid/stat" ] && [ "$(awk '{print $3}' "/proc/$pid/stat")" != Z ]; do sleep .02; done
fi
''')
        (self.root / 'var/lib/gmib-clone').mkdir(parents=True)
        (self.root / 'var/lib/gmib-clone/personalized.json').write_text('{}')
        screen = self.configure(['--boot'])
        self.wait_prompt(screen)
        (self.root / 'screen-pid').write_text(str(screen.pid))
        ssh = self.configure([])
        self.wait_prompt(ssh)
        self.assertEqual(screen.wait(timeout=5), 0)
        duplicate = self.configure([])
        self.assertNotEqual(duplicate.wait(timeout=5), 0)
        ssh.stdin.close()
        ssh.stdin = None
        self.assertEqual(ssh.wait(timeout=5), 0)
        commands = (self.root / 'commands').read_text()
        self.assertEqual(commands.count('stop gmib-provision.service'), 1)
        self.assertIn('start --no-block gmib-provision.service', commands)
        self.assertTrue(self.available('gmib-provision-session.lock'))

    def test_network_exchange_keeps_transaction_and_blocks_ssh_without_stop(self):
        first = self.provision()
        self.wait_prompt(first)
        first.stdin.write(b'CODE123\n')
        first.stdin.flush()
        wait_until(lambda: (self.root / 'request').exists())
        self.assertFalse(self.available('gmib-kiosk-setup.lock'))
        ssh = self.configure([])
        self.assertNotEqual(ssh.wait(timeout=5), 0)
        self.assertNotIn('stop gmib-provision.service', (self.root / 'commands').read_text())

    def test_hup_reaps_manual_group_restores_console_and_releases_locks(self):
        child_script = self.script('child', '''echo $$ >"$FIXTURE/child-pid"
sleep 100 &
echo $! >"$FIXTURE/grandchild-pid"
wait
''')
        ssh = self.configure([], child_script)
        wait_until(lambda: (self.root / 'grandchild-pid').exists())
        second = self.configure([])
        self.assertNotEqual(second.wait(timeout=5), 0)
        os.kill(ssh.pid, signal.SIGHUP)
        self.assertEqual(ssh.wait(timeout=5), 0)
        commands = (self.root / 'commands').read_text()
        self.assertEqual(commands.count('stop gmib-provision.service'), 1)
        self.assertIn('start --no-block gmib-provision.service', commands)
        for name in ('gmib-kiosk-setup.lock', 'gmib-configure-manual.lock'):
            self.assertTrue(self.available(name))
        for name in ('child-pid', 'grandchild-pid'):
            pid = int((self.root / name).read_text())
            def exited():
                stat = Path(f'/proc/{pid}/stat')
                return not stat.exists() or stat.read_text().split()[2] == 'Z'
            wait_until(exited)

    def test_sigterm_exits_boot_menu_instead_of_being_treated_as_ctrl_c(self):
        boot = self.configure(['--boot'])
        wait_until(lambda: select.select([boot.stdout], [], [], 0)[0])
        os.kill(boot.pid, signal.SIGTERM)
        self.assertEqual(boot.wait(timeout=5), 0)

    def test_personalized_eof_idles_without_restarting_provision(self):
        (self.root / 'var/lib/gmib-clone').mkdir(parents=True)
        (self.root / 'var/lib/gmib-clone/personalized.json').write_text('{}')
        boot = self.configure(['--boot'])
        self.wait_prompt(boot)
        boot.stdin.close()
        boot.stdin = None
        time.sleep(.2)
        self.assertIsNone(boot.poll())
        self.assertTrue(self.available('gmib-provision-session.lock'))
        os.kill(boot.pid, signal.SIGTERM)
        self.assertEqual(boot.wait(timeout=5), 0)


if __name__ == '__main__':
    unittest.main()

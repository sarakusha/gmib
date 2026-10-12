#!/usr/bin/env python3
"""Linux integration test of launcher process/pipe lifetimes without a display."""
import os
from pathlib import Path
import signal
import subprocess
import sys
import tempfile
import time
import unittest

LAUNCHER = Path(__file__).with_name("gmib-kiosk-launch.sh")


def fake_cage(directory, mode):
    """Model Cage's inherited pipe; descendants deliberately keep it open."""
    directory = Path(directory)
    app = directory / "app.sh"
    if mode == "exit":
        app.write_text('sleep 60 &\necho $! > "$1/descendant"\nexit 7\n')
    elif mode == "stop":
        app.write_text('trap \'echo TERM > "$1/stopped"; exit 0\' TERM\n'
                       'sleep 60 &\necho $! > "$1/descendant"\nwait\n')
    else:
        app.write_text('trap "" TERM\nsleep 60 &\necho $! > "$1/descendant"\nwait\n')
    terminated = []
    signal.signal(signal.SIGTERM, lambda *_: terminated.append(True))
    read_fd, write_fd = os.pipe()
    os.set_inheritable(write_fd, True)
    env = dict(os.environ, GMIB_KIOSK_CAGE_EXECUTABLE=sys.executable)
    child = subprocess.Popen(
        ["bash", str(LAUNCHER), "bash", str(app), str(directory)],
        env=env, pass_fds=(write_fd,), start_new_session=True,
    )
    os.close(write_fd)
    os.set_blocking(read_fd, False)
    try:
        deadline = time.monotonic() + 5
        sent_stop = False
        while not terminated and time.monotonic() < deadline:
            if mode != "exit" and (directory / "descendant").exists() and not sent_stop:
                # Wait until Bash is in wait(), where the signal trap is delivered.
                time.sleep(0.05)
                child.send_signal(signal.SIGTERM)
                sent_stop = True
            time.sleep(0.01)
        assert terminated, "launcher did not terminate its Cage parent"
        descendant = int((directory / "descendant").read_text())
        os.kill(descendant, 0)
        try:
            result = os.read(read_fd, 1)
        except BlockingIOError:
            result = None
        assert result is None, "fixture must retain Cage pipe when main app exits"
        assert child.wait(timeout=2) == (7 if mode == "exit" else 143)
        if mode == "stop":
            while not (directory / "stopped").exists() and time.monotonic() < deadline:
                time.sleep(0.01)
            assert (directory / "stopped").read_text().strip() == "TERM"
    finally:
        # Model systemd KillMode=control-group and leave no fixture descendants.
        try:
            os.killpg(child.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
        child.wait(timeout=2)
        os.close(read_fd)


@unittest.skipUnless(sys.platform == "linux", "requires Linux /proc")
class KioskLauncherTest(unittest.TestCase):
    def test_primary_exit_stops_cage_despite_inherited_pipe(self):
        self.run_parent("exit")

    def test_stop_forwards_signal(self):
        self.run_parent("stop")

    def test_unresponsive_primary_cannot_delay_cage_termination(self):
        self.run_parent("ignore")

    def run_parent(self, mode):
        with tempfile.TemporaryDirectory(prefix="gmib-kiosk-launch-") as directory:
            subprocess.run([sys.executable, __file__, "parent", directory, mode],
                           check=True, timeout=10)

    def test_refuses_unrelated_parent_without_starting_app(self):
        with tempfile.TemporaryDirectory(prefix="gmib-kiosk-launch-") as directory:
            marker = Path(directory) / "started"
            result = subprocess.run(
                ["bash", str(LAUNCHER), "touch", str(marker)],
                env=dict(os.environ, GMIB_KIOSK_CAGE_EXECUTABLE="/not-cage"),
                capture_output=True, timeout=3,
            )
            self.assertEqual(result.returncode, 64)
            self.assertFalse(marker.exists())


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "parent":
        fake_cage(sys.argv[2], sys.argv[3])
    else:
        unittest.main()

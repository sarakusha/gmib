#!/usr/bin/env python3
"""Exercise the installer's real staging commands without running host setup."""

import os
from pathlib import Path
import shlex
import subprocess
import tempfile


REPO = Path(__file__).resolve().parents[3]


def install_block(source, start, end):
    """Select a bounded install-only block; never execute the surrounding installer."""
    block = source.split(start, 1)[1].split(end, 1)[0]
    block = start + block
    commands = block.replace("\\\n", "").splitlines()
    if not commands or any(not line.startswith("install ") for line in commands):
        raise AssertionError("Expected an install-only block, refusing to execute")
    if any(not shlex.split(line)[-1].startswith("/usr/local/libexec") for line in commands):
        raise AssertionError("Unexpected install destination, refusing to execute")
    return block


def main():
    installer = (REPO / "deploy/kiosk/install-target.sh").read_text()
    setup = (REPO / "scripts/setup-linux-kiosk.sh").read_text()
    staging = install_block(
        installer,
        "install -d -m 0755 /usr/local/libexec/gmib-kiosk\n",
        "/usr/local/libexec/gmib-kiosk/setup-linux-kiosk.sh \\\n",
    )
    launcher_install = install_block(
        setup,
        "install -d -m 0755 /usr/local/libexec\n",
        "\ninstall -m 0644 /dev/stdin /etc/pam.d/gmib-cage",
    )
    with tempfile.TemporaryDirectory(prefix="gmib-kiosk-staging-") as temporary:
        root = Path(temporary)
        payload = root / "payload"
        payload.mkdir()
        for name in ("setup-linux-kiosk.sh", "gmib-kiosk-launch.sh", "gmib-hide-cursor.c"):
            (payload / name).write_bytes((REPO / "scripts" / name).read_bytes())
        libexec = root / "usr/local/libexec"
        staged = libexec / "gmib-kiosk"
        env = dict(os.environ, PAYLOAD_DIR=str(payload), SCRIPT_DIR=str(staged))
        for block in (staging, launcher_install):
            # Redirect every install destination into the temporary root. Sources
            # come only from the temporary payload and the resulting staged tree.
            isolated = block.replace("/usr/local/libexec", shlex.quote(str(libexec)))
            subprocess.run(["bash", "-euc", isolated], env=env, check=True)
        installed = libexec / "gmib-kiosk-launch"
        assert installed.read_bytes() == (payload / "gmib-kiosk-launch.sh").read_bytes()
        assert installed.stat().st_mode & 0o777 == 0o755
        assert (staged / "setup-linux-kiosk.sh").stat().st_mode & 0o777 == 0o755
        assert (staged / "gmib-hide-cursor.c").read_bytes() == (payload / "gmib-hide-cursor.c").read_bytes()
    print("installer kiosk staging test passed")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Verify a built ISO and exercise FAT writes on a temporary partition copy."""
import json
from pathlib import Path
import subprocess
import sys
import tempfile


def run(*args):
    return subprocess.run(args, check=True, text=True, capture_output=True).stdout


def verify(iso):
    partitions = json.loads(run('sfdisk', '--json', str(iso)))['partitiontable']['partitions']
    assert len(partitions) == 3, 'Expected ISO, EFI and setup partitions'
    assert partitions[1]['type'].upper() == 'C12A7328-F81F-11D2-BA4B-00A0C93EC93B'
    setup = partitions[2]
    assert setup['type'].upper() == 'EBD0A0A2-B9E5-4433-87C0-68B6B72699C7'
    assert not setup.get('attrs'), 'Setup partition must not be hidden or read-only'
    assert setup['size'] * 512 == 16 * 1024 * 1024
    for left, right in zip(partitions, partitions[1:]):
        assert left['start'] + left['size'] <= right['start'], 'Overlapping partitions'
    with tempfile.TemporaryDirectory(prefix='gmib-setup-verify-') as temporary:
        root = Path(temporary)
        fat = root / 'setup.fat'
        with iso.open('rb') as stream:
            stream.seek(setup['start'] * 512)
            contents = stream.read(setup['size'] * 512)
        assert contents[43:54].decode('ascii').strip() == 'GMIB-SETUP'
        assert contents[54:62] == b'FAT16   '
        fat.write_bytes(contents)
        original = root / 'original'
        run('mcopy', '-i', str(fat), '::authorized_keys', str(original))
        template = Path(__file__).resolve().parents[1] / 'setup-authorized_keys'
        assert original.read_bytes() == template.read_bytes(), 'Wrong shipped template'
        assert all(not line.strip() or line.startswith('#') for line in original.read_text().splitlines())
        # Generate two disposable customer keys. Their private halves stay in
        # this temporary directory and are never written into the ISO or FAT.
        keys = []
        for index in (1, 2):
            key = root / f'client{index}'
            run('ssh-keygen', '-q', '-t', 'ed25519', '-N', '', '-f', str(key))
            keys.append(key.with_suffix('.pub').read_text())
        edited = root / 'edited'
        edited.write_text(original.read_text() + ''.join(keys))
        run('mcopy', '-o', '-i', str(fat), str(edited), '::authorized_keys')
        retrieved = root / 'retrieved'
        run('mcopy', '-i', str(fat), '::authorized_keys', str(retrieved))
        assert retrieved.read_bytes() == edited.read_bytes(), 'FAT write/read failed'
        validator = Path(__file__).resolve().parents[1] / 'read-ssh-public-keys.sh'
        normalized = run('bash', str(validator), str(retrieved)).splitlines()
        assert normalized == [' '.join(key.split()[:2]) for key in keys]
    print('Verified: EFI + writable 16 MiB GMIB-SETUP FAT16, commented template, two-key write/read.')


if __name__ == '__main__':
    if len(sys.argv) != 2:
        raise SystemExit('Usage: verify-setup-partition.py BUILT.iso')
    verify(Path(sys.argv[1]))

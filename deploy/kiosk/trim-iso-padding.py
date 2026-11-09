#!/usr/bin/env python3
"""Remove only verified zero write padding after a new ISO's backup GPT."""
from pathlib import Path
import os
import struct
import sys
import zlib


def header(stream, lba):
    stream.seek(lba * 512)
    data = stream.read(512)
    if len(data) != 512 or data[:8] != b'EFI PART':
        raise ValueError('Missing GPT header')
    size, crc = struct.unpack_from('<II', data, 12)
    if not 92 <= size <= 512:
        raise ValueError('Invalid GPT header size')
    checked = data[:16] + bytes(4) + data[20:size]
    if zlib.crc32(checked) != crc or struct.unpack_from('<Q', data, 24)[0] != lba:
        raise ValueError('Invalid GPT header checksum or position')
    table, count, entry_size, table_crc = struct.unpack_from('<QIII', data, 72)
    if entry_size != 128 or not 1 <= count <= 256:
        raise ValueError('Unexpected GPT entry layout')
    stream.seek(table * 512)
    entries = stream.read(count * entry_size)
    if len(entries) != count * entry_size or zlib.crc32(entries) != table_crc:
        raise ValueError('Invalid GPT partition array checksum')
    return data, entries


def trim(filename):
    # Only the newly generated output file is passed here, never a USB device.
    path = Path(filename)
    if not path.is_file() or path.is_symlink():
        raise ValueError('Expected a regular ISO output file')
    with path.open('r+b') as stream:
        primary, entries = header(stream, 1)
        backup_lba = struct.unpack_from('<Q', primary, 32)[0]
        backup, backup_entries = header(stream, backup_lba)
        if (struct.unpack_from('<Q', backup, 32)[0] != 1 or entries != backup_entries
                or primary[40:72] != backup[40:72]):
            raise ValueError('GPT copies disagree')
        first, last = struct.unpack_from('<QQ', primary, 40)
        table = struct.unpack_from('<Q', primary, 72)[0]
        backup_table = struct.unpack_from('<Q', backup, 72)[0]
        if not (2 <= table and table * 512 + len(entries) <= first * 512
                and first <= last < backup_table
                and backup_table * 512 + len(entries) <= backup_lba * 512):
            raise ValueError('GPT metadata and usable ranges overlap')
        occupied = []
        for offset in range(0, len(entries), 128):
            if entries[offset:offset + 16] != bytes(16):
                start, finish = struct.unpack_from('<QQ', entries, offset + 32)
                if not first <= start <= finish <= last:
                    raise ValueError('GPT partition is outside the usable range')
                occupied.append((start, finish))
        occupied.sort()
        if any(left[1] >= right[0] for left, right in zip(occupied, occupied[1:])):
            raise ValueError('GPT partitions overlap')
        end = (backup_lba + 1) * 512
        stream.seek(32768)
        pvd = stream.read(2048)
        if (pvd[:7] != b'\x01CD001\x01'
                or struct.unpack_from('<I', pvd, 80)[0] * 2048 != end
                or struct.unpack_from('>I', pvd, 84)[0] * 2048 != end):
            raise ValueError('ISO volume and backup GPT ends disagree')
        size = os.fstat(stream.fileno()).st_size
        if not 0 <= size - end <= 1024 * 1024:
            raise ValueError('Unexpected bytes after the GPT')
        stream.seek(end)
        if any(stream.read()):
            raise ValueError('Refusing to truncate nonzero data after the GPT')
        stream.truncate(end)
        stream.flush()
        os.fsync(stream.fileno())
    print(f'ISO/GPT end verified; removed {size - end} bytes of zero write padding.')


if __name__ == '__main__':
    if len(sys.argv) != 2:
        raise SystemExit('Usage: trim-iso-padding.py NEW_OUTPUT.iso')
    try:
        trim(sys.argv[1])
    except (OSError, ValueError, struct.error) as error:
        raise SystemExit(f'ISO finalization failed: {error}') from error

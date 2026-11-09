#!/usr/bin/env python3
"""Reject inconsistent metadata and nonzero tails before trimming ISO output."""
import importlib.machinery
import importlib.util
from pathlib import Path
import tempfile
import struct
import unittest
import sys
import zlib
sys.dont_write_bytecode = True
from iso_layout_fixture import make_iso

loader = importlib.machinery.SourceFileLoader('iso_padding', str(Path(__file__).resolve().parents[1] / 'trim-iso-padding.py'))
spec = importlib.util.spec_from_loader(loader.name, loader)
padding = importlib.util.module_from_spec(spec)
loader.exec_module(padding)


class PaddingTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.iso = Path(self.temp.name) / 'new.iso'

    def test_only_zero_tail_removed_and_result_is_idempotent(self):
        end = make_iso(self.iso)
        prefix = self.iso.read_bytes()[:end]
        padding.trim(self.iso)
        self.assertEqual(self.iso.read_bytes(), prefix)
        padding.trim(self.iso)
        self.assertEqual(self.iso.read_bytes(), prefix)

    def test_corrupt_metadata_never_changes_the_file(self):
        for offset in (512, 512 + 16, 1024, 127 * 512 + 16, 32768, 32768 + 84):
            with self.subTest(offset=offset):
                make_iso(self.iso)
                data = bytearray(self.iso.read_bytes())
                data[offset] ^= 1
                self.iso.write_bytes(data)
                with self.assertRaises(ValueError):
                    padding.trim(self.iso)
                self.assertEqual(self.iso.read_bytes(), data)

    def test_nonzero_or_oversized_tail_is_refused(self):
        for tail in (b'not padding', bytes(1024 * 1024 + 1)):
            make_iso(self.iso, tail)
            data = self.iso.read_bytes()
            with self.assertRaises(ValueError):
                padding.trim(self.iso)
            self.assertEqual(self.iso.read_bytes(), data)

    def test_valid_crcs_cannot_allow_arrays_or_partitions_outside_usable_ranges(self):
        for corruption in ('array-in-tail', 'partition-outside-range'):
            with self.subTest(corruption=corruption):
                make_iso(self.iso)
                data = bytearray(self.iso.read_bytes())
                if corruption == 'array-in-tail':
                    struct.pack_into('<Q', data, 512 + 72, 128)
                else:
                    for table in (2, 95):
                        data[table * 512:table * 512 + 16] = b'X' * 16
                        struct.pack_into('<QQ', data, table * 512 + 32, 94, 96)
                    for lba, table in ((1, 2), (127, 95)):
                        crc = zlib.crc32(data[table * 512:table * 512 + 128 * 128])
                        struct.pack_into('<I', data, lba * 512 + 88, crc)
                for lba in (1, 127):
                    struct.pack_into('<I', data, lba * 512 + 16, 0)
                    struct.pack_into('<I', data, lba * 512 + 16, zlib.crc32(data[lba * 512:lba * 512 + 92]))
                self.iso.write_bytes(data)
                with self.assertRaises(ValueError):
                    padding.trim(self.iso)
                self.assertEqual(self.iso.read_bytes(), data)

    def test_symlink_refused(self):
        make_iso(self.iso)
        link = self.iso.with_suffix('.link')
        link.symlink_to(self.iso)
        with self.assertRaises(ValueError):
            padding.trim(link)


if __name__ == '__main__':
    unittest.main()

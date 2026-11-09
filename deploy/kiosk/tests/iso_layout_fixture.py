"""Small checksummed GPT/ISO metadata fixture; never a bootable disk image."""
import struct
import zlib


def make_iso(path, tail=bytes(112 * 512)):
    end_lba = 127
    image = bytearray((end_lba + 1) * 512)
    entries = bytes(128 * 128)
    for current, alternate, table in ((1, end_lba, 2), (end_lba, 1, 95)):
        header = bytearray(512)
        header[:8] = b'EFI PART'
        struct.pack_into('<IIIIQQQQ', header, 8, 0x10000, 92, 0, 0,
                         current, alternate, 34, 94)
        header[56:72] = bytes(range(16))
        struct.pack_into('<QIII', header, 72, table, 128, 128, zlib.crc32(entries))
        struct.pack_into('<I', header, 16, zlib.crc32(header[:92]))
        image[current * 512:(current + 1) * 512] = header
    image[32768:32775] = b'\x01CD001\x01'
    struct.pack_into('<I', image, 32768 + 80, len(image) // 2048)
    struct.pack_into('>I', image, 32768 + 84, len(image) // 2048)
    path.write_bytes(image + tail)
    return len(image)

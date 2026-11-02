// Bound both allocation and parsing work; never instantiate an image/bitmap decoder here.
export const IMAGE_HEADER_BYTES = 1024 * 1024;
type Dimensions = { width: number; height: number };

export const readImageDimensions = (input: Uint8Array): Dimensions | undefined => {
  const bytes = input.subarray(0, IMAGE_HEADER_BYTES);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const matches = (offset: number, signature: number[]) =>
    signature.every((value, index) => bytes[offset + index] === value);
  const ascii = (offset: number, value: string) =>
    matches(
      offset,
      Array.from(value, char => char.charCodeAt(0)),
    );
  const uint24 = (offset: number) =>
    bytes[offset] + bytes[offset + 1] * 256 + bytes[offset + 2] * 65536;
  if (bytes.length >= 24 && matches(0, [137, 80, 78, 71, 13, 10, 26, 10]) && ascii(12, 'IHDR')) {
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }
  if (bytes.length >= 10 && (ascii(0, 'GIF87a') || ascii(0, 'GIF89a'))) {
    return { width: view.getUint16(6, true), height: view.getUint16(8, true) };
  }
  if (bytes.length >= 26 && ascii(0, 'BM')) {
    const size = view.getUint32(14, true);
    if (size === 12) return { width: view.getUint16(18, true), height: view.getUint16(20, true) };
    if (size >= 40)
      return { width: view.getInt32(18, true), height: Math.abs(view.getInt32(22, true)) };
  }
  if (bytes.length >= 20 && ascii(0, 'RIFF') && ascii(8, 'WEBP')) {
    if (bytes.length >= 30 && ascii(12, 'VP8X'))
      return { width: uint24(24) + 1, height: uint24(27) + 1 };
    if (bytes.length >= 30 && ascii(12, 'VP8 ') && matches(23, [157, 1, 42])) {
      return {
        width: view.getUint16(26, true) & 0x3fff,
        height: view.getUint16(28, true) & 0x3fff,
      };
    }
    if (bytes.length >= 25 && ascii(12, 'VP8L') && bytes[20] === 47) {
      const bits = view.getUint32(21, true);
      return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
    }
  }
  if (matches(0, [255, 216])) {
    let offset = 2;
    while (offset + 4 <= bytes.length) {
      if (bytes[offset++] !== 255) return undefined;
      while (bytes[offset] === 255) offset++;
      const marker = bytes[offset++];
      if (marker === 217 || marker === 218) return undefined;
      if (marker === 1 || (marker >= 208 && marker <= 215)) continue;
      if (offset + 2 > bytes.length) return undefined;
      const length = view.getUint16(offset);
      if (length < 2 || offset + length > bytes.length) return undefined;
      if (length >= 7 && marker >= 192 && marker <= 207 && ![196, 200, 204].includes(marker)) {
        return { width: view.getUint16(offset + 5), height: view.getUint16(offset + 3) };
      }
      offset += length;
    }
  }
  // Unknown formats or headers beyond the bound are checked by the server.
  return undefined;
};

export function chunkArray(array: string|any[], len: number) {
  const ret: any[] = [];
  const size = Math.ceil(array.length / len);
  ret.length = size;
  let offset;

  for (let i = 0; i < size; i += 1) {
    offset = i * len;
    ret[i] = array.slice(offset, offset + len);
  }

  return ret;
}

export function printBuffer(buffer: Buffer) {
  return chunkArray(chunkArray(buffer.toString('hex'), 2), 16)
    .map(chunk => chunk.join('-'))
    .join('=');
}

// function make_chunks(array: any[], size: number): any[][] {
//   if (size <= 0) throw new Error('Invalid chunk size');
//   const result = [];
//   for (let i = 0; i < array.length; i += size) {
//     result.push(array.slice(i, i + size));
//   }
//   return result;
// }



type Arrayable = any[] | Buffer | string;

export function chunkArray<T extends Arrayable>(array: T, len: number) {
  const ret: T[] = [];
  const size = Math.ceil(array.length / len);
  ret.length = size;
  let offset;

  for (let i = 0; i < size; i += 1) {
    offset = i * len;
    ret[i] = array.slice(offset, offset + len) as T;
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

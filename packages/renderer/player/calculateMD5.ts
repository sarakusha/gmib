const calculateMD5 = async (blob: File): Promise<string> => {
  const reader = (blob.stream() as unknown as ReadableStream).getReader();
  for (const hash = window.nodeCrypto.createHash('md5'); ; ) {
    // eslint-disable-next-line no-await-in-loop
    const { done, value } = await reader.read();
    if (done) return hash.digest('hex');
    hash.update(value);
  }
};

export default calculateMD5;

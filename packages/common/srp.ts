export const srpSessionKeyToBuffer = (sessionKey: bigint): Buffer =>
  Buffer.from(sessionKey.toString(16), 'hex');

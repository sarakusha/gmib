import { generateKeyPairSync } from 'node:crypto';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { nanoid } from 'nanoid';

const currentDir = dirname(fileURLToPath(import.meta.url));
const keys = join(currentDir, 'keys');
mkdirSync(keys, { recursive: true });
const name = nanoid(8);
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
writeFileSync(
  join(keys, `rsa-${name}.pem`),
  privateKey.export({ type: 'pkcs1', format: 'pem' }).toString(),
);
writeFileSync(
  join(keys, `rsa-${name}.pub`),
  publicKey.export({ type: 'pkcs1', format: 'pem' }).toString(),
);

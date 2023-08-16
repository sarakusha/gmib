#!/usr/bin/env node
import crypto from 'node:crypto';
import { writeFile } from 'node:fs/promises';

const filename = '/Users/sarakusha/Library/Application Support/gmib/gmib-local.json';
const key = '5de69464795e572c48e8001cf4e8d688e5922f23e390f791f690cbbcbfb5f288';
const className = 'body.gmib-ee13c10';
const css = `${className} .rlXINR-cZo5bnISD5TaUT.YqATOnK8rERXOjt0JEXW0 { display: inherit; margin: inherit; overflow: inherit; position: inherit; color: inherit; background: inherit; }`;
const content = JSON.stringify({
  message: css,
  // useProxy: true,
});

const iv = crypto.randomBytes(16);
const alg = 'aes-256-cbc';
const cipher = crypto.createCipheriv(alg, Buffer.from(key, 'hex'), Buffer.from(iv, 'hex'));

const { default: store } = await import(filename, { assert: { type: 'json' } });
store.announce = [cipher.update(content, 'utf-8', 'base64'), cipher.final('base64')].join('');
store.iv = iv.toString('base64');

const decipher = crypto.createDecipheriv(alg, Buffer.from(key, 'hex'), Buffer.from(iv, 'hex'));

console.log([decipher.update(store.announce, 'base64', 'utf-8'), decipher.final('utf-8')].join(''));

await writeFile(filename, JSON.stringify(store));

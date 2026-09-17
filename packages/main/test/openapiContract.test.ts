import { readFileSync } from 'node:fs';

import Ajv2020 from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';

const specUrl = new URL('../../../docs/api/openapi.json', import.meta.url);
const apiSourceUrl = new URL('../src/api.ts', import.meta.url);
const routerSourceUrl = new URL('../src/srpAuthRouter.ts', import.meta.url);

const specification = JSON.parse(readFileSync(specUrl, 'utf8')) as Record<string, unknown>;
const apiSource = readFileSync(apiSourceUrl, 'utf8');
const routerSource = readFileSync(routerSourceUrl, 'utf8');

const operations = Object.entries(specification.paths as Record<string, Record<string, unknown>>)
  .flatMap(([path, entry]) =>
    Object.keys(entry)
      .filter(method => ['get', 'post', 'put', 'patch', 'delete'].includes(method))
      .map(method => ({ method, path })),
  )
  .filter(
    ({ path }) =>
      path !== '/api/handshake/{id}' &&
      path !== '/api/login/{id}' &&
      path !== '/api/manage/v1/auth/password',
  );

const pathToRuntimeLiteral = (method: string, path: string): string => {
  if (method === 'delete' && path === '/api/media/{id}') return '/media/:md5';
  return path
    .replace(/^\/api/, '')
    .replaceAll('{id}', ':id')
    .replaceAll('{md5}', ':md5');
};

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const validateSchema = (name: string, value: unknown, expected = true): void => {
  const specWithId = { ...specification, $id: 'https://gmib.invalid/openapi.json' };
  const ajv = new Ajv2020({ strict: false, allErrors: true });
  ajv.addSchema(specWithId);
  const validate = ajv.getSchema(`${specWithId.$id}#/components/schemas/${name}`);
  expect(validate, `missing schema ${name}`).toBeDefined();
  expect(validate?.(value), ajv.errorsText(validate?.errors)).toBe(expected);
};

describe('OpenAPI management contract', () => {
  it('has the expected OpenAPI 3.1 structure and resolvable local references', () => {
    const validate = new Ajv2020({ strict: false, allErrors: true }).compile({
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
      required: ['openapi', 'info', 'paths', 'components'],
      properties: {
        openapi: { const: '3.1.1' },
        info: { type: 'object', required: ['title', 'version'] },
        paths: { type: 'object', minProperties: 1 },
        components: { type: 'object', required: ['schemas', 'responses', 'securitySchemes'] },
      },
    });
    expect(validate(specification)).toBe(true);

    const visit = (value: unknown): void => {
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === 'object') {
        for (const [key, child] of Object.entries(value)) {
          if (key === '$ref' && typeof child === 'string' && child.startsWith('#/')) {
            const target = child
              .slice(2)
              .split('/')
              .reduce<unknown>((node, segment) => {
                if (!node || typeof node !== 'object') return undefined;
                return (node as Record<string, unknown>)[
                  segment.replaceAll('~1', '/').replaceAll('~0', '~')
                ];
              }, specification);
            expect(target, `unresolved ${child}`).toBeDefined();
          } else visit(child);
        }
      }
    };
    visit(specification);
  });

  it('maps every documented stable base operation to the current router source', () => {
    for (const { method, path } of operations) {
      const literal = pathToRuntimeLiteral(method, path);
      expect(apiSource).toMatch(
        new RegExp(`api\\.${method}\\(\\s*['\"]${escapeRegExp(literal)}['\"]`),
      );
    }
    expect(routerSource).toMatch(/router\.get\(\s*['"]\/handshake\/:id['"]/);
    expect(routerSource).toMatch(/router\.post\(\s*['"]\/login\/:id['"]/);
    expect(routerSource).toMatch(/router\.put\(\s*['"]\/manage\/v1\/auth\/password['"]/);
  });

  it('keeps SRP login, identifier, and password-rotation security semantics explicit', () => {
    const paths = specification.paths as Record<string, Record<string, Record<string, unknown>>>;
    expect(paths['/api/identifier'].get.security).toEqual([]);
    expect(paths['/api/handshake/{id}'].get.security).toEqual([]);
    expect(paths['/api/login/{id}'].post.security).toEqual([]);
    expect(paths['/api/manage/v1/auth/password'].put.security).toBeUndefined();
    expect(JSON.stringify(specification)).toContain('METHOD + PATH_AND_QUERY + TIMESTAMP + BODY');
  });

  it('accepts representative documented request and response values against component schemas', () => {
    validateSchema('SrpLoginRequest', { A: '0xabc', M1: '0x123' });
    validateSchema('PasswordRotationRequest', { salt: '0x12', verifier: '0xabcd' });
    validateSchema('Playlist', {
      id: 1,
      name: 'Morning',
      flags: 0,
      items: [{ id: 'item-1', md5: 'abc' }],
    });
    validateSchema('PlayerSchedulerJobInput', {
      kind: 'once',
      name: 'Start player',
      runAt: '2026-09-17T12:00:00+03:00',
      enabled: true,
      priority: 0,
      playerId: 1,
      action: 'play',
    });
  });

  it('requires runnable scheduler fields for kind and action variants', () => {
    const cron = {
      seconds: { mode: 'select', every: 1, selected: [0] },
      minutes: { mode: 'every', every: 10, selected: [] },
      hours: { mode: 'all', every: 1, selected: [] },
      days: { mode: 'all', selected: [] },
      months: { mode: 'all', selected: [] },
      weekdays: { mode: 'all', selected: [] },
    };

    validateSchema('PlayerSchedulerJobInput', {
      kind: 'cron',
      name: 'Load playlist',
      cron,
      enabled: true,
      priority: 1.5,
      playerId: 1,
      action: 'load-playlist',
      playlistId: 2,
    });
    validateSchema('GmibSchedulerJobInput', {
      kind: 'once',
      name: 'Show page',
      runAt: '2026-09-17T12:00:00+03:00',
      enabled: true,
      priority: 0,
      action: 'show-test',
      screenId: 1,
      testId: 'page-1',
    });
    validateSchema(
      'PlayerSchedulerJobInput',
      {
        kind: 'once',
        name: 'Missing runAt',
        enabled: true,
        priority: 0,
        playerId: 1,
        action: 'play',
      },
      false,
    );
    validateSchema(
      'PlayerSchedulerJobInput',
      {
        kind: 'cron',
        name: 'Missing playlist',
        cron,
        enabled: true,
        priority: 0,
        playerId: 1,
        action: 'load-playlist',
      },
      false,
    );
    validateSchema(
      'GmibSchedulerJobInput',
      {
        kind: 'once',
        name: 'Missing test',
        runAt: '2026-09-17T12:00:00+03:00',
        enabled: true,
        priority: 0,
        action: 'show-test',
        screenId: 1,
      },
      false,
    );
  });
});

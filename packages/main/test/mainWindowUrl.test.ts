import { expect, it } from 'vitest';
import { getGmibWindowUrl } from '../src/mainWindowUrl';

it('loads local renderer while connecting to a remote custom port', () => {
  expect(getGmibWindowUrl(9002, 1234, '192.168.1.10')).toBe(
    'http://localhost:9002/index.html?port=1234&host=192.168.1.10',
  );
});
it('uses the configured local server and preserves development server', () => {
  expect(getGmibWindowUrl(8002, 9001, 'host')).toBe(
    'http://localhost:8002/index.html?port=9001&host=host',
  );
  expect(getGmibWindowUrl(8002, 1234, 'host', 'http://localhost:5173')).toBe(
    'http://localhost:5173?port=1234&host=host',
  );
});

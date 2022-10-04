/* eslint-disable no-param-reassign */
import compact from 'lodash/compact';
import flatten from 'lodash/flatten';
import groupBy from 'lodash/groupBy';
import range from 'lodash/range';
import shuffle from 'lodash/shuffle';

export function formatTime(seconds = 0, guide = seconds) {
  const s = Math.floor(seconds % 60);
  const m = Math.floor((seconds / 60) % 60);
  const h = Math.floor(seconds / 3600);
  const gm = Math.floor((guide / 60) % 60);
  const gh = Math.floor(guide / 3600);

  if (Number.isNaN(seconds) || seconds === Infinity) {
    return gh > 0 ? '-:-:-' : '-:-';
  }

  const H = h > 0 || gh > 0 ? `${h}:` : '';
  const M = `${(h || gm >= 10) && m < 10 ? `0${m}` : m}:`;
  const S = s < 10 ? `0${s}` : s;

  return H + M + S;
}

const search = new URLSearchParams(window.location.search);
export const sourceId = +(search.get('source_id') ?? 1);

export const formatFilename = (filename: string) =>
  filename.replace(/\.[^/.]+$/, '').replaceAll('_', ' ');

export const ItemTypes = {
  Media: 'media',
};

const maxLength = <T extends Record<string, unknown>>(chunks: T[][]): number =>
  chunks.reduce((result, item) => Math.max(result, item.length), 0);

export const shuffleItems = <T extends { md5: string }>(items: T[]): T[] => {
  const groups = groupBy(items, 'md5');
  const max = maxLength(Object.values(groups));

  function slice(chunks: T[][]) {
    return shuffle(range(max)).map(i => shuffle(compact(chunks.map(chunk => chunk[i]))));
  }

  function removeRepeats(chunks: T[][]) {
    let result = false;
    chunks.reduce((prev, next /* , index */) => {
      const last = prev.length - 1;
      if (last > 0 && prev[last].md5 === next[0].md5) {
        // console.log('swap', index, prev[0].mediaid, prev[last].mediaid);
        const temp = prev[0];
        prev[0] = prev[last];
        prev[last] = temp;
        result = true;
      }
      return next;
    });
    return result;
  }

  const chunks = slice(
    Object.values(groups).map(chunk => {
      const clone = [...chunk];
      clone.length = max;
      return clone;
    }),
  );
  // eslint-disable-next-line no-empty
  while (removeRepeats(chunks)) {}
  return flatten(chunks);
};

export const getMediaUri = (name?: string) => name && `/public/${name}`;

export const toHexId = (id: number): string => id.toString(16).toUpperCase().padStart(8, '0');

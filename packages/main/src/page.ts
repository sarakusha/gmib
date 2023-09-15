/* eslint-disable no-bitwise */
import { nanoid } from 'nanoid';

import { flag, promisifyAll, promisifyGet, promisifyRun, removeNull, uniqueField } from './db';

import type { Page } from '/@common/config';
import type { NullableOptional } from '/@common/helpers';

const enum PageFlags {
  None = 0,
  Permanent = 1 << 0,
  Hidden = 1 << 2,
}

const toPage = (result: NullableOptional): Page => {
  const { flags = 0, ...props } = removeNull(result);
  return {
    permanent: Boolean(flags & PageFlags.Permanent),
    hidden: Boolean(flags & PageFlags.Hidden),
    ...props,
  };
};

const pageEncoder = ({
  id = nanoid(),
  url,
  title,
  permanent,
  preload,
  userAgent,
  hidden,
}: Page) => ({
  $id: id,
  $url: url,
  $title: title,
  $preload: preload,
  $userAgent: userAgent,
  $flags: flag(permanent, PageFlags.Permanent) | flag(hidden, PageFlags.Hidden),
});

export const getPageByRowID = promisifyGet(
  'SELECT * FROM page WHERE rowid = ?',
  (rowid: number) => rowid,
  toPage,
);
export const getPage = promisifyGet('SELECT * FROM page WHERE id = ?', (id: string) => id, toPage);

export const getPages = promisifyAll('SELECT * FROM page', () => {}, toPage);

export const insertPage = promisifyRun(
  `INSERT INTO page (id, url, title, preload, userAgent, flags)
  VALUES ($id, $url, $title, $preload, $userAgent, $flags)`,
  pageEncoder,
);

export const updatePage = promisifyRun(
  `UPDATE page
  SET url=$url, title=$title, preload=$preload, userAgent=$userAgent, flags=$flags
  WHERE id = $id`,
  pageEncoder,
);

/**
 * skip flags on conflict
 */
export const upsertPermanentPage = promisifyRun(
  `INSERT INTO page (id, url, title, preload, userAgent, flags)
  VALUES ($id, $url, $title, $preload, $userAgent, $flags)
  ON CONFLICT(id) DO UPDATE SET url=$url, title=$title, preload=$preload, userAgent=$userAgent`,
  pageEncoder,
);

export const deletePage = promisifyRun('DELETE FROM page WHERE id = ?', (id: string) => id);

const titleExists = promisifyGet(
  `SELECT 1
  FROM page
  WHERE title=$title AND id != $id LIMIT 1`,
  (title: string, id = '') => ({ $id: id, $title: title }),
  result => !!result,
);

export const uniquePageTitle = uniqueField('title', titleExists);

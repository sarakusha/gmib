import type { Request, Router } from 'express';

import type { PlaybackStatisticsQuery } from '/@common/playbackStatistics';

import { PlaybackStatisticsQueryError } from './playbackStatistics';
import { PlaybackStatisticsSqlReader } from './playbackStatisticsSql';
import type { PlaybackStatisticsStore } from './playbackStatisticsStore';

const textParameter = (req: Request, name: string, required = false): string | undefined => {
  const value = req.query[name];
  if (value === undefined && !required) return undefined;
  if (typeof value !== 'string' || !value.length) {
    throw new PlaybackStatisticsQueryError(`Invalid ${name}`);
  }
  return value;
};

const integerParameter = (req: Request, name: string, required = false): number | undefined => {
  const value = textParameter(req, name, required);
  if (value === undefined) return undefined;
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value))) {
    throw new PlaybackStatisticsQueryError(`Invalid ${name}`);
  }
  return Number(value);
};

const queryFromRequest = (req: Request): PlaybackStatisticsQuery => ({
  playerId: integerParameter(req, 'playerId', true)!,
  outputId: integerParameter(req, 'outputId'),
  from: textParameter(req, 'from'),
  to: textParameter(req, 'to'),
});

/** Mount after the existing host authentication middleware. No user-supplied filesystem paths. */
export const mountPlaybackStatisticsApi = (
  api: Router,
  store: () => PlaybackStatisticsStore,
): void => {
  let reader: PlaybackStatisticsSqlReader | undefined;
  const getReader = () => {
    reader ??= new PlaybackStatisticsSqlReader(store());
    return reader;
  };
  api.get('/playback/statistics', async (req, res, next) => {
    try {
      res.json(await getReader().statistics(queryFromRequest(req)));
    } catch (error) {
      if (error instanceof PlaybackStatisticsQueryError)
        res.status(400).json({ message: error.message });
      else next(error);
    }
  });
  api.get('/playback/statistics/history', async (req, res, next) => {
    try {
      res.json(
        await getReader().history({
          ...queryFromRequest(req),
          mediaId: textParameter(req, 'mediaId', true)!,
          offset: integerParameter(req, 'offset'),
          limit: integerParameter(req, 'limit'),
        }),
      );
    } catch (error) {
      if (error instanceof PlaybackStatisticsQueryError)
        res.status(400).json({ message: error.message });
      else next(error);
    }
  });
};

import type express from 'express';
import bodyParser from 'body-parser';

import {
  MAX_PLAYER_CONFIGURATION_BYTES,
  parsePlayerConfiguration,
} from '/@common/playerConfiguration';

import getAllDisplays from './getAllDisplays';
import updateMenu from './mainMenu';
import { exportPlayerConfiguration, importPlayerConfiguration } from './playerConfiguration';
import { broadcast } from './server';

export const playerConfigurationJson = bodyParser.json({ limit: MAX_PLAYER_CONFIGURATION_BYTES });

/** Mounted after the normal authentication and license mutation middleware. */
export const mountPlayerConfigurationApi = (api: express.Router): void => {
  api.get('/player-configuration', async (_req, res, next) => {
    try {
      res.json(await exportPlayerConfiguration(getAllDisplays()));
    } catch (error) {
      next(error);
    }
  });

  api.post('/player-configuration', async (req, res, next) => {
    let document;
    try {
      document = parsePlayerConfiguration(req.body);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
      return;
    }
    try {
      const result = await importPlayerConfiguration(document);
      broadcast({ event: 'player', remote: req.ip });
      broadcast({ event: 'mapping', remote: req.ip });
      updateMenu();
      res.json(result);
    } catch (error) {
      next(error);
    }
  });
};

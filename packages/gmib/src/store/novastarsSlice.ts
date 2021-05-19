/*
 * @license
 * Copyright (c) 2021. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

import { asyncSerialMap } from '@nibus/core';
import {
  DisplayMode,
  Calibration,
  Connection,
  DeviceType,
  Session,
  BrightnessRGBV,
} from '@novastar/codec';
import { createEntityAdapter, createSlice } from '@reduxjs/toolkit';
import { connect, Socket } from 'net';
import type { AppThunk, RootState } from './index';
import debugFactory from '../util/debug';

const debug = debugFactory('gmib:novastar');

type NovastarSession = Session<Socket>;

const novastarSessions: Record<string, NovastarSession> = {};

export type PortState = {
  model: string;
  redundantStatus: boolean;
  brightness: BrightnessRGBV;
  gamma: number;
  displayMode: DisplayMode;
  calibration: {
    isOn: boolean;
    type: Calibration;
  };
};

type Ports = 0 | 1 | 2 | 3;

export type Novastar = {
  path: string;
  hasDVISignalIn?: boolean;
  version?: string;
  model?: string;
  autobrightness?: boolean;
  ports?: (PortState | undefined | null)[];
};

const novastarsAdapter = createEntityAdapter<Novastar>({ selectId: ({ path }) => path });

export const {
  selectAll: selectAllNovastars,
  selectById: selectNovastarByPath,
  selectIds: selectNovastarIds,
} = novastarsAdapter.getSelectors<RootState>(state => state.novastars);

const novastarsSlice = createSlice({
  name: 'novastars',
  initialState: novastarsAdapter.getInitialState(),
  reducers: {
    addNovastar: novastarsAdapter.addOne,
    removeNovastar: novastarsAdapter.removeOne,
    updateNovastar: novastarsAdapter.updateOne,
  },
});

const { updateNovastar } = novastarsSlice.actions;
export const { addNovastar, removeNovastar } = novastarsSlice.actions;

export const reloadNovastar = (path: string): AppThunk => async dispatch => {
  const session = novastarSessions[path];
  if (!session) return;
  try {
    const status = await session.checkRedundantStatus();
    const scModel = await session.getModel(DeviceType.SendingCard);
    const version = await session.getSendingCardVersion();
    const autobrightness = await session.getAutobrightnessMode();
    const hasDVISignalIn = await session.hasDVISignalIn();
    dispatch(
      updateNovastar({
        id: path,
        changes: {
          model: scModel,
          autobrightness,
          version,
          hasDVISignalIn,
        },
      })
    );
    const ports = await asyncSerialMap(
      [0, 1, 2, 3],
      async (port: Ports, index): Promise<PortState | undefined> => {
        try {
          const model = await session.getModel(DeviceType.ReceivingCard, port);
          try {
            const brightness = await session.getBrightnessRGBV(port);
            const gamma = await session.getGammaValue(port);
            const displayMode = await session.getDisplayMode(port);
            const calibration = await session.getCalibrationMode(port);
            return {
              model,
              brightness,
              gamma,
              displayMode,
              calibration,
              redundantStatus: status[index],
            };
          } catch (e) {
            debug(`error while reading the receiving card '${path}' on port ${port}: ${e.message}`);
            return undefined;
          }
        } catch (err) {
          return undefined;
        }
      }
    );

    dispatch(updateNovastar({ id: path, changes: { ports } }));
  } catch (err) {
    debug(`error while read novastar: ${err.messaage}`);
  }
};

export const createNovastarConnection = (
  path: string,
  port: number,
  host?: string
): AppThunk<Promise<void>> => dispatch =>
  new Promise(resolve => {
    const socket = connect(port, host, () => {
      socket.write(path);
      window.setTimeout(() => {
        const connection = new Connection(socket);
        connection.open().then(() => {
          const novastarSession = new Session(connection);
          novastarSession[path]?.close();
          novastarSessions[path] = novastarSession;
          dispatch(addNovastar({ path }));
          dispatch(reloadNovastar(path));
          socket.once('close', () => {
            novastarSession.close();
          });
          connection.once('close', () => {
            dispatch(removeNovastar(path));
            delete novastarSessions[path];
            if (!socket.destroyed) socket.destroy();
          });
          resolve();
        });
      }, 100);
    });
  });

export const releaseNovastar = (): AppThunk => () => {
  Object.values(novastarSessions).forEach(novastarSession => novastarSession.close());
};

export const setNovastarBrightness = (percent: number): AppThunk => (dispatch, getState) => {
  const state = getState();
  const cards = selectAllNovastars(state);
  const value = Math.min(255, Math.max(0, Math.round((percent * 255) / 100)));
  cards.forEach(({ path, ports }) => {
    const session = novastarSessions[path];
    session
      ?.setBrightness(value, 0xff)
      .then(() => {
        if (ports) {
          const newPorts = ports.map(item =>
            item ? { ...item, brightness: { ...item.brightness, overall: value } } : item
          );
          dispatch(updateNovastar({ id: path, changes: { ports: newPorts } }));
        }
      })
      .catch(err => {
        debug(`error while change brightness on novastar:${path}: ${err.message}`);
      });
  });
  /*
  cards.forEach(({ path, ports }) => {
    const session = novastarSessions[path];
    session &&
      ports &&
      asyncSerialMap(ports, async (port, index) => {
        try {
          if (port) {
            await session.setBrightness(value, index);
            const prev = selectNovastarByPath(getState(), path);
            if (prev && prev.ports) {
              const newValue = [...prev.ports];
              const prevState = newValue[index];
              if (prevState) {
                const newState = {
                  ...prevState,
                  brightness: { ...prevState.brightness, overall: value },
                };
                newValue[index] = newState;
                dispatch(
                  updateNovastar({
                    id: path,
                    changes: { ports: newValue },
                  })
                );
              }
            }
            await session.save(index);
          }
        } catch (err) {
          debug(
            `error while changing brightness on the receiving card '${path}' on port ${index}: ${err.message}`
          );
        }
      });
  });
*/
};

export default novastarsSlice.reducer;

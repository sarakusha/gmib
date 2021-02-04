/*
 * @license
 * Copyright (c) 2021. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { ipcRenderer } from 'electron';

import { notEmpty } from '../util/helpers';
import { AsyncInitializer } from './asyncInitialMiddleware';
import type { AppThunk, RootState } from './index';

export type TestQuery = {
  width: number;
  height: number;
  moduleHres: number;
  moduleVres: number;
  x: number;
  y: number;
};

type TestId = string;
type Test = [id: TestId, path: string];

export interface TestState {
  tests: Test[];
  query: TestQuery;
}

const initialState: TestState = {
  tests: [],
  query: {
    width: 640,
    height: 320,
    moduleHres: 40,
    moduleVres: 40,
    x: 0,
    y: 0,
  },
};

type TestTuple = [name: string, path: string];
const readAsync = promisify(fs.readFile);
const readdirAsync = promisify(fs.readdir);

const reTitle = /<\s*title[^>]*>(.+)<\s*\/\s*title>/i;

const testSlice = createSlice({
  name: 'test',
  initialState,
  reducers: {
    setTest(state, { payload: tests }: PayloadAction<Test[]>) {
      state.tests = tests;
    },
    setQuery(state, { payload: query }: PayloadAction<TestQuery>) {
      state.query = query;
      ipcRenderer.send('test:query', query);
    },
    setParam(
      state,
      { payload: [name, value] }: PayloadAction<[name: keyof TestQuery, value: number]>
    ) {
      state.query[name] = value;
    },
  },
});

export const loadTests: AsyncInitializer = async dispatch => {
  const testDir = path.resolve(__dirname, '../extraResources/tests');
  const filenames = (await readdirAsync(testDir))
    .map(filename => path.join(testDir, filename))
    .filter(filename => !fs.lstatSync(filename).isDirectory());
  const tuples = await Promise.all<TestTuple | undefined>(
    filenames.map(async filename => {
      const buffer = await readAsync(filename);
      const matches = buffer.toString().match(reTitle);
      if (!matches) {
        console.warn('Отсутствует заголовок', filename);
        return undefined;
      }
      return [matches[1], filename];
    })
  );
  dispatch(
    testSlice.actions.setTest(
      tuples.filter(notEmpty).sort(([, pathA], [, pathB]) => pathA.localeCompare(pathB))
    )
  );
};

export const { setQuery } = testSlice.actions;

export const selectTest = (state: RootState): TestState => state.test;

export const selectTestQuery = (state: RootState): TestQuery => selectTest(state).query;

export const selectTests = (state: RootState): TestState['tests'] => selectTest(state).tests;

export const updateParam = (name: keyof TestQuery, value: number): AppThunk => (
  dispatch,
  getState
) => {
  dispatch(testSlice.actions.setParam([name, value]));
  const query = selectTestQuery(getState());
  ipcRenderer.send('test:query', query);
};

export default testSlice.reducer;

/*
 * @license
 * Copyright (c) 2019. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nata" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

import React, {
  createContext, Dispatch,
  SetStateAction,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import storage from 'electron-json-storage';
import debounce from 'lodash/debounce';
import { ipcRenderer } from 'electron';
import path from 'path';
import fs from 'fs';

export type TestQuery = {
  width: number,
  height: number,
  moduleHres: number,
  moduleVres: number,
  x: number,
  y: number,
};

type TestId = string;

type ContextType = {
  current: TestId | null,
  visible: TestId | null,
  setCurrent: (id: TestId | null) => void,
  showTest: (id: TestId) => void,
  query: TestQuery,
  setQuery: Dispatch<SetStateAction<TestQuery>>,
  hideAll: () => void,
  tests: TestId[],
};

const TestContext = createContext<ContextType>(null as any);
const key = 'testParams';

export const useTests = () => useContext(TestContext);

type testTuple = [string, string];
let tests: Record<string, string> = {};
const sortByPath = ([, pathA]: testTuple, [, pathB]: testTuple) => pathA < pathB
  ? -1
  : pathA > pathB ? 1 : 0;

const reTitle = /<\s*title[^>]*>(.+)<\s*\/\s*title>/i;
const reloadTests = () => {
  tests = {};
  const testDir = path.resolve(__dirname, '../extraResources/tests');
  fs.readdir(testDir, (err, filenames) => {
    if (err) {
      console.error('error while readdir', err.stack);
      return;
    }
    filenames.forEach((filename) => {
      const pathname = path.join(testDir, filename);
      if (fs.lstatSync(pathname).isDirectory()) return;
      fs.readFile(pathname, (err, buffer) => {
        if (err) {
          console.error('error while readFile', pathname, err.stack);
          return;
        }
        const matches = buffer.toString().match(reTitle);
        if (!matches) {
          console.warn('Отсутствует заголовок', filename);
          return;
        }
        tests = {
          ...tests,
          [matches[1]]: pathname,
        };
      });
    });
  });
};

reloadTests();

const updateQuery = debounce(
  (query: TestQuery) => {
    storage.set(key, query, err => err && console.error(err.stack));
    ipcRenderer.send('test:query', query);
  },
  1000,
);
const TestsProvider: React.FC<{}> = ({ children }) => {
  const [current, setCurrent] = useState<TestId | null>(null);
  const [visible, setVisible] = useState<TestId | null>(null);
  const [query, setQuery] = useState<TestQuery>({
    width: 640,
    height: 320,
    moduleHres: 40,
    moduleVres: 40,
    x: 0,
    y: 0,
  });
  const showTest = useCallback(
    (id: TestId) => {
      setVisible(id);
      ipcRenderer.send('test:show', tests[id]);
    },
    [setVisible],
  );
  const hideAll = useCallback(
    () => {
      ipcRenderer.send('test:hide');
      setVisible(null);
    },
    [setVisible],
  );
  const value: ContextType = useMemo(
    () => ({
      current,
      visible,
      query,
      setQuery,
      setCurrent,
      showTest,
      hideAll,
      tests: Object.entries(tests).sort(sortByPath).map(([id]) => id),
    }),
    [current, visible, query, setQuery, tests],
  );
  useEffect(
    () => {
      storage.get(key, (err, data) => {
        if (Object.entries(data).length !== 0 && !err) {
          setQuery(data as TestQuery);
        }
      });
      // return () => {
      //   getState(setQuery)(query =>
      //     storage.set(key, query, err => err && console.error(err.stack)));
      // };
    },
    [setQuery],
  );
  useEffect(() => updateQuery(query), [query]);
  useEffect(
    () => {
      if (!visible) hideAll();
    },
    [visible],
  );
  return (
    <TestContext.Provider value={value}>
      {children}
    </TestContext.Provider>
  );
};

export default TestsProvider;

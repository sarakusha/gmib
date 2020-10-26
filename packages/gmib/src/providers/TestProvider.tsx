/*
 * @license
 * Copyright (c) 2020. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

import React, {
  createContext,
  Dispatch,
  SetStateAction,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import debounce from 'lodash/debounce';
import { ipcRenderer } from 'electron';
import path from 'path';
import fs from 'fs';
import { promisify } from 'util';
import { notEmpty } from '../util/helpers';

// import storage from '../components/storage';

export type TestQuery = {
  width: number;
  height: number;
  moduleHres: number;
  moduleVres: number;
  x: number;
  y: number;
};

type TestId = string;

type ContextType = {
  current: TestId | null;
  visible: TestId | null;
  setCurrent: (id: TestId | null) => void;
  showTest: (id: TestId) => void;
  query: TestQuery;
  setQuery: Dispatch<SetStateAction<TestQuery>>;
  hideAll: () => void;
  tests: TestId[];
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TestContext = createContext<ContextType>(null as any);
// const key = 'testParams';

export const useTests = (): ContextType => useContext(TestContext);

type TestTuple = [name: string, path: string];
const sortByPath = ([, pathA]: TestTuple, [, pathB]: TestTuple): number =>
  pathA < pathB ? -1 : pathA > pathB ? 1 : 0;

const readAsync = promisify(fs.readFile);
const readdirAsync = promisify(fs.readdir);

const reTitle = /<\s*title[^>]*>(.+)<\s*\/\s*title>/i;
const reloadTests = async (): Promise<Record<string, string>> => {
  const testDir = path.resolve(__dirname, '../extraResources/tests');
  // console.log('TESTDIR', testDir);
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
  return Object.fromEntries(tuples.filter(notEmpty));
};

const testsPromise = reloadTests();

const updateQuery = debounce((query: TestQuery) => {
  // storage.set(key, query, err => err && console.error(err.stack));
  ipcRenderer.send('test:query', query);
}, 1000);

const TestsProvider: React.FC = ({ children }) => {
  const [current, setCurrent] = useState<TestId | null>(null);
  const [visible, setVisible] = useState<TestId | null>(null);
  const [tests, setTests] = useState<Record<string, string>>({});
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
    [tests]
  );
  const hideAll = useCallback(() => {
    ipcRenderer.send('test:hide');
    setVisible(null);
  }, []);
  const value: ContextType = useMemo(
    () => ({
      current,
      visible,
      query,
      setQuery,
      setCurrent,
      showTest,
      hideAll,
      tests: Object.entries(tests)
        .sort(sortByPath)
        .map(([id]) => id),
    }),
    [current, visible, query, showTest, hideAll, tests]
  );
  useEffect(() => updateQuery(query), [query]);
  useEffect(() => {
    visible || hideAll();
  }, [hideAll, visible]);
  useEffect(() => {
    testsPromise.then(setTests);
  }, []);
  return <TestContext.Provider value={value}>{children}</TestContext.Provider>;
};

export default TestsProvider;

import type { PayloadAction } from '@reduxjs/toolkit';
import { createEntityAdapter, createSlice } from '@reduxjs/toolkit';
import ColorHash from 'color-hash';
import debugFactory from 'debug';

type Span = {
  text: string;
  css?: string;
};

let logIndex = 0;
export type LogItem = {
  id: number;
  prefix: string;
  tag?: Span;
  info?: Span[];
  delta?: string;
};

const colorHash = new ColorHash();

export const logAdapter = createEntityAdapter<LogItem>({
  selectId: ({ id }) => id,
  sortComparer: (a, b) => b.id - a.id,
});

const { colors } = debugFactory as { colors?: string[] };

const selectColor = (value: string): string => {
  const index = parseInt(value, 10);
  return colors?.[index % colors.length] ?? `#${index.toString(16)}`;
};

const parseAnsi = (info: string): Span[] => {
  // eslint-disable-next-line no-control-regex
  const [first, ...other] = info.split(/\x1b\[3[0-8](?:;5;\d+)?;1m[^\x1b]+\x1b\[0m/g);
  // eslint-disable-next-line no-control-regex
  const matches = [...info.matchAll(/\x1b\[3([0-8])(?:;5;(\d+))?;1m([^\x1b]+)\x1b\[0m/g)];
  return other.reduce(
    (acc, text, index) => [
      ...acc,
      {
        text: matches[index][3],
        css: `color: ${selectColor(matches[index][2] ?? matches[index][1])};`,
      },
      { text },
    ],
    [{ text: first }] as Span[],
  );
};

// eslint-disable-next-line no-control-regex
const removeAnsi = (value: string): string => value.replaceAll(/\x1b\[[^m]+m/g, '');

const logSlice = createSlice({
  name: 'log',
  initialState: logAdapter.getInitialState(),
  reducers: {
    addLog(state, { payload: line }: PayloadAction<string>) {
      // TODO: не работает
      const matches = removeAnsi(line).match(
        /\[([^\]]+)] \[([^\]]+)]\s+([\d-]{10}T[\d:.]{12}Z )?(\S+)(.*)/,
      );
      // eslint-disable-next-line no-plusplus
      const id = ++logIndex;
      let added = false;
      if (matches) {
        const [, time, , time2, tag, tail] = matches;
        const [, info = tail, delta] = time2 ? [] : tail.match(/(.*)(\+\S+)$/) ?? [];
        // console.log({ line, matches, time, time2, tag, info, delta });
        if (time2 || delta) {
          const css = `color: ${colorHash.hex(tag)};`;

          logAdapter.addOne(state, {
            id,
            prefix: time,
            tag: { text: tag, css },
            info: parseAnsi(info),
            delta,
          });
          added = true;
        } else {
          logAdapter.addOne(state, {
            id,
            prefix: `${time} ${tag} ${tail}`,
          });
        }
      }
      if (!added) {
        logAdapter.addOne(state, { id, prefix: line });
      }
      if (state.ids.length > 200) {
        const rest = state.ids.slice().splice(200, 200);
        logAdapter.removeMany(state, rest);
      }
    },
  },
});

export const { addLog } = logSlice.actions;

export default logSlice.reducer;

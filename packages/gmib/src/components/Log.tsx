/*
 * @license
 * Copyright (c) 2022. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Paper } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { parse } from 'ansicolor';
import sanitizeHtml from 'sanitize-html';
import ColorHash from 'color-hash';
import { noop } from '../util/helpers';
import { getCurrentNibusSession } from '../util/nibus';
import LogToolbar from './LogToolbar';
import { useToolbar } from '../providers/ToolbarProvider';
import { useSelector } from '../store';
import { selectCurrentTab } from '../store/currentSlice';

const colorHash = new ColorHash();

const useStyles = makeStyles(theme => ({
  root: {
    paddingLeft: theme.spacing(2),
    paddingRight: theme.spacing(2),
    paddingTop: theme.spacing(1),
    paddingBottom: theme.spacing(1),
    width: '100%',
    height: '100%',
  },
  '@keyframes slideIn': {
    '0%': {
      marginLeft: '100%',
      backgroundColor: theme.palette.action.disabledBackground,
    },
    '5%': {
      marginLeft: '0%',
    },
    '100%': {
      backgroundColor: theme.palette.background.paper,
    },
  },
  log: {
    height: '100%',
    overflow: 'auto',
    '& > div': {
      paddingLeft: theme.spacing(1),
      whiteSpace: 'nowrap',
      animationDuration: '5s',
      animationName: '$slideIn',
    },
  },
}));

const Log: React.FC = () => {
  const refLog = useRef<HTMLDivElement>(null);
  const classes = useStyles();
  const [, setState] = useState(0);
  useEffect(() => {
    const logListener = (line: string): void => {
      const { current } = refLog;
      if (current) {
        const { spans } = parse(line);
        let html: string | undefined;
        if (spans.length > 1) {
          html = spans
            .map(
              ({ text, css }) =>
                `<span style="${css}${
                  css?.includes('font-weight: bold;') ? `color: ${colorHash.hex(text)};` : ''
                }">${text}</span>`
            )
            .join('');
        } else {
          const matches = line.match(
            /(\[[^\]]+] \[[^\]]+]\s+)([0-9-]{10}T[0-9:.]{12}Z )?(\S+)(.*)/
          );
          if (matches) {
            const [, time, time2, tag, tail] = matches;
            const [, info = tail, delta] = time2 ? [] : tail.match(/(.*)(\+\S+)$/) ?? [];
            if (time2 || delta) {
              const style = `color: ${colorHash.hex(tag)};`;
              html = `${time}<span style="${style}"><b>${tag}</b></span>${info}<span style="${style}">${
                delta ?? ''
              }</span>`;
            }
          }
        }
        current.insertAdjacentHTML(
          'afterbegin',
          `<div>${sanitizeHtml(html ?? line, {
            allowedAttributes: { span: ['style'] },
            allowedTags: ['span', 'b', 'em', 'strong', 'i'],
          })}</div>`
        );
        while (current.childElementCount > 200) {
          current.lastChild!.remove();
        }
        // console.log('HTML');
        setState(state => {
          const next = (state + 1) % 65535;
          window.localStorage.setItem('log', `${new Date().toLocaleTimeString()}:${next}`);
          return next;
        });
      }
    };
    const session = getCurrentNibusSession();
    session.on('log', logListener);
    // const logger: any = logListener;
    // logger.level = 'info';
    // log.transports.logger = logger;
    // debugFactory.log = logger;
    return () => {
      // log.transports.logger = null;
      session.off('log', logListener);
    };
  }, []);
  const [, setToolbar] = useToolbar();
  const tab = useSelector(selectCurrentTab);
  useEffect(() => {
    if (tab === 'log') {
      setToolbar(<LogToolbar />);
      return () => setToolbar(null);
    }
    return noop;
  }, [setToolbar, tab]);
  return (
    <div className={classes.root}>
      <Paper ref={refLog} className={classes.log} />
    </div>
  );
};

export default React.memo(Log);

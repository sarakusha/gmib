/*
 * @license
 * Copyright (c) 2021. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */
import Paper from '@material-ui/core/Paper';
import makeStyles from '@material-ui/core/styles/makeStyles';
import React, { useEffect, useRef, useState } from 'react';
import { parse } from 'ansicolor';
import sanitizeHtml from 'sanitize-html';
import { getSession } from '../util/helpers';
import LogToolbar from './LogToolbar';
import { useToolbar } from '../providers/ToolbarProvider';
import { useSelector } from '../store';
import { selectCurrentSession, selectCurrentTab } from '../store/currentSlice';

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

const logToolbar = <LogToolbar />;

const Log: React.FC = () => {
  const refLog = useRef<HTMLDivElement>(null);
  const classes = useStyles();
  const sessionId = useSelector(selectCurrentSession);
  const [, setState] = useState(0);
  useEffect(() => {
    const logListener = (line: string): void => {
      const { current } = refLog;
      if (current) {
        const { spans } = parse(line);
        const html = spans.map(({ text, css }) => `<span style="${css}">${text}</span>`).join('');
        current.insertAdjacentHTML(
          'afterbegin',
          `<div>${sanitizeHtml(html, {
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
    const session = getSession(sessionId);
    session.on('log', logListener);
    return () => {
      session.off('log', logListener);
    };
  }, [sessionId]);
  const [, setToolbar] = useToolbar();
  const tab = useSelector(selectCurrentTab);
  useEffect(() => {
    setToolbar(toolbar => {
      if (tab === 'log') return logToolbar;
      return toolbar === logToolbar ? null : toolbar;
    });
  }, [setToolbar, tab]);
  return (
    <div className={classes.root}>
      <Paper ref={refLog} className={classes.log} />
    </div>
  );
};

export default React.memo(Log);

/*
 * @license
 * Copyright (c) 2021. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */
import { makeStyles } from '@material-ui/core/styles';
import React, { useEffect, useRef } from 'react';
import { ipcRenderer, IpcRendererEvent } from 'electron';
import { parse } from 'ansicolor';
import sanitizeHtml from 'sanitize-html';
import LogToolbar from './LogToolbar';
import { useToolbar } from '../providers/ToolbarProvider';
import { useSelector } from '../store';
import { selectCurrentTab } from '../store/currentSlice';

const useStyles = makeStyles(theme => ({
  root: {
    padding: theme.spacing(1),
  },
  '@keyframes slideIn': {
    '0%': {
      marginLeft: '100%',
      width: '300%',
      backgroundColor: theme.palette.action.disabledBackground,
    },
    '5%': {
      marginLeft: '0%',
      width: '100%',
    },
    '100%': {
      backgroundColor: theme.palette.background.paper,
    },
  },
  log: {
    backgroundColor: theme.palette.action.disabledBackground,
    '& > div': {
      whiteSpace: 'nowrap',
      animationDuration: '5s',
      animationName: '$slideIn',
      backgroundColor: theme.palette.background.paper,
    },
  },
}));

const logToolbar = <LogToolbar />;

const Log: React.FC = () => {
  const refLog = useRef<HTMLDivElement>(null);
  const classes = useStyles();
  useEffect(() => {
    const logListener = (e: IpcRendererEvent, line: string): void => {
      const { current } = refLog;
      if (current) {
        const { spans } = parse(line);
        const [first] = spans;
        const noStyle = spans.length === 1 && !first.css;
        const html = noStyle
          ? first.text.replace(/(nibus:\S+)/, '<b>$1</b>').replace(/(\+\d+m?s)$/, '<b>$1</b>')
          : spans.map(({ text, css }) => `<span style="${css}">${text}</span>`).join('');
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
      }
    };
    ipcRenderer.on('log', logListener);
    return () => {
      ipcRenderer.off('log', logListener);
    };
  }, []);
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
      <div ref={refLog} className={classes.log} />
    </div>
  );
};

export default React.memo(Log);

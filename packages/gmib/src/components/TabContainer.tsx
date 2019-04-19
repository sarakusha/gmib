/*
 * @license
 * Copyright (c) 2019. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nata" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

import { IDevice } from '@nata/nibus.js-client/lib/mib';
import React, { useEffect, useRef } from 'react';
import { withStyles, createStyles, Theme, WithStyles } from '@material-ui/core/styles';
import classNames from 'classnames';
import { hot } from 'react-hot-loader/root';
import compose from 'recompose/compose';

const styles = (theme: Theme) => createStyles({
  root: {
    // flexShrink: 1,
    // flexGrow: 1,
    // maxWidth: 'none',
    width: '100%',
    display: 'flex',
    // height: '100%',
    // overflow: 'hidden',
  },
  hidden: {
    display: 'none',
  },
});

export type Props = {
  children?: React.ReactNode,
  value: number | string,
  selected?: boolean,
};
type InnerProps = Props & WithStyles<typeof styles>;
const TabContainer: React.FC<InnerProps> = ({ children, classes, selected = true }) => {
  /*
  const ref = useRef(null);
  useEffect(
    () => {
      console.log('REF', ref.current && ref.current.scrollTo(0, 0));
      // const element = document.getElementById(value);
      // element && (element.scrollTop = 300);
      // console.log('ON', value, element && element.scrollTop);
      // window.scrollTo(0,0);
      // return () => {
      //   console.log('OFF', value, element && element.scrollTop, pageYOffset);
      // };
    },
    [selected],
  );
   */
  return (
    <div className={classNames(classes.root, { [classes.hidden]: !selected })}>
      {children}
    </div>
  );
};

export default compose<InnerProps, Props>(
  hot,
  React.memo,
  withStyles(styles),
)(TabContainer);

/*
 * @license
 * Copyright (c) 2019. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nata" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

import Tabs from '@material-ui/core/Tabs';
import { createStyles, Theme, withStyles } from '@material-ui/core/styles';
import React from 'react';

const styles = (theme: Theme) => createStyles({
  flexContainer: {
    flexDirection: 'column',
  },
  indicator: {
    display: 'none',
  },
});

export default withStyles(styles)(Tabs);

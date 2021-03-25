/*
 * @license
 * Copyright (c) 2020. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "mcd" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

import React from 'react';
import Checkbox from '@material-ui/core/Checkbox';
import Divider from '@material-ui/core/Divider';
import Paper from '@material-ui/core/Paper';
import MuiTable from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import Typography from '@material-ui/core/Typography';
import Box from '@material-ui/core/Box';
import { withStyles } from '@material-ui/core/styles';

const Blockquote = withStyles(theme => ({
  root: {
    borderLeftWidth: 4,
    borderLeftStyle: 'solid',
    borderLeftColor: theme.palette.text.secondary, // '4px solid grey',
    padding: theme.spacing(1),
    boxShadow: 'none',
    backgroundColor: theme.palette.divider,
    marginBottom: 16,
    display: 'inline-block',
    '& p:last-child': {
      marginBottom: 0,
    },
  },
}))(Paper);

const mdx: Record<string, React.ReactNode> = {
  p: props => <Typography paragraph {...props} />,
  h1: props => <Typography {...props} component="h1" variant="h1" gutterBottom />,
  h2: props => <Typography {...props} component="h2" variant="h2" gutterBottom />,
  h3: props => <Typography {...props} component="h3" variant="h3" gutterBottom />,
  h4: props => <Typography {...props} component="h4" variant="h4" gutterBottom />,
  h5: props => <Typography {...props} component="h5" variant="h5" gutterBottom />,
  h6: props => <Typography {...props} component="h6" variant="h6" gutterBottom />,
  blockquote: props => <Blockquote {...props} />,
  ul: props => <Typography {...props} component="ul" />,
  ol: props => <Typography {...props} component="ol" />,
  li: props => <Typography {...props} component="li" />,
  table: props => <MuiTable {...props} />,
  tr: props => <TableRow {...props} />,
  td: ({ align, ...props }) => <TableCell align={align || undefined} {...props} />,
  tbody: props => <TableBody {...props} />,
  th: ({ align, ...props }) => <TableCell align={align || undefined} {...props} />,
  thead: props => <TableHead {...props} />,
  code: props => (
    // <Typography component="div" paragraph>
    <Box
      fontFamily="Monospace"
      bgcolor="text.primary"
      color="background.paper"
      p={1}
      borderRadius="borderRadius"
      {...props}
    />
    // </Typography>
  ),
  hr: Divider,
  input: props => {
    const { type } = props;
    if (type === 'checkbox') {
      return <Checkbox {...props} disabled={false} readOnly />;
    }
    return <input {...props} readOnly />;
  },
  wrapper: props => <div {...props} className="markdown-body" />,
};

export default mdx;

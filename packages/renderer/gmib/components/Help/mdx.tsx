import type { CheckboxProps } from '@mui/material';
import {
  Box,
  Checkbox,
  Divider,
  Table as MuiTable,
  Paper,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import type { PaperProps } from '@mui/material/Paper/Paper';
import type { TableCellProps } from '@mui/material/TableCell/TableCell';
import { styled } from '@mui/material/styles';
import type { MDXComponents } from 'mdx/types';
import React from 'react';

const Blockquote = styled(Paper)(({ theme }) => ({
  '&.MuiPaper-root': {
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
}));

const mdx: MDXComponents = {
  p: ({ ref, ...props }) => <Typography paragraph {...props} />,
  h1: ({ ref, ...props }) => <Typography {...props} component="h1" variant="h4" gutterBottom />,
  h2: ({ ref, ...props }) => <Typography {...props} component="h2" variant="h4" gutterBottom />,
  h3: ({ ref, ...props }) => <Typography {...props} component="h3" variant="h5" gutterBottom />,
  h4: ({ ref, ...props }) => <Typography {...props} component="h4" variant="h6" gutterBottom />,
  h5: ({ ref, ...props }) => <Typography {...props} component="h5" variant="h6" gutterBottom />,
  h6: ({ ref, ...props }) => <Typography {...props} component="h6" variant="h6" gutterBottom />,
  blockquote: ({ ref, ...props }) => <Blockquote {...(props as PaperProps<'div'>)} />,
  ul: ({ ref, ...props }) => <Typography {...props} component="ul" />,
  ol: ({ ref, ...props }) => <Typography {...props} component="ol" />,
  li: ({ ref, ...props }) => <Typography {...props} component="li" />,
  table: ({ ref, ...props }) => <MuiTable {...props} />,
  tr: ({ ref, ...props }) => <TableRow {...props} />,
  td: ({ ref, ...props }) => <TableCell {...(props as TableCellProps)} />,
  tbody: ({ ref, ...props }) => <TableBody {...props} />,
  th: ({ ref, ...props }) => <TableCell {...(props as TableCellProps)} />,
  thead: ({ ref, ...props }) => <TableHead {...props} />,
  code: ({ ref, ...props }) => (
    // <Typography component="div" paragraph>
    <Box
      component="span"
      fontFamily="Monospace"
      bgcolor="text.primary"
      color="background.paper"
      p={1}
      borderRadius={1}
      {...props}
    />
    // </Typography>
  ),
  hr: ({ ref, ...props }) => <Divider {...props} />,
  input: ({ ref, ...props }) => {
    const { type } = props;
    if (type === 'checkbox') {
      return <Checkbox {...(props as CheckboxProps)} disabled={false} readOnly />;
    }
    return <input {...props} readOnly />;
  },
  wrapper: ({ ref, ...props }) => <div {...props} className="markdown-body" />,
};

export default mdx;

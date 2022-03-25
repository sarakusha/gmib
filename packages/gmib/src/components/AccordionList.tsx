/*
 * @license
 * Copyright (c) 2022. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */
import { makeStyles } from '@material-ui/core/styles';
import {
  AccordionDetailsProps,
  AccordionSummaryProps,
  Box,
  List,
  Typography,
} from '@material-ui/core';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import classNames from 'classnames';
import React from 'react';

import Accordion from './Accordion';
import AccordionDetails from './AccordionDetails';
import AccordionSummary from './AccordionSummary';

export type AccordionListProps = {
  name: string;
  title?: React.ReactNode;
  component?: React.ElementType;
  className?: string;
  summaryClasses?: AccordionSummaryProps['classes'];
  detailsClasses?: AccordionDetailsProps['classes'];
  expanded?: boolean;
  onChange?: (name?: string) => void;
};

const useStyles = makeStyles({
  hidden: {
    display: 'none',
  },
});

const AccordionList: React.FC<AccordionListProps> = ({
  name,
  title,
  component = List,
  className,
  children,
  summaryClasses,
  detailsClasses,
  expanded = false,
  onChange = () => {},
}) => {
  const classes = useStyles();
  return (
    <Accordion
      expanded={expanded}
      onChange={() => onChange(expanded ? undefined : name)}
      className={className}
    >
      <AccordionSummary
        expandIcon={React.Children.count(children) > 0 ? <ExpandMoreIcon /> : undefined}
        aria-controls={name}
        classes={summaryClasses}
        className={classNames({ [classes.hidden]: !title })}
      >
        {typeof title === 'string' ? <Typography>{title}</Typography> : title}
      </AccordionSummary>
      <AccordionDetails classes={detailsClasses}>
        <Box component={component} width={1}>
          {children}
        </Box>
      </AccordionDetails>
    </Accordion>
  );
};

export default AccordionList;

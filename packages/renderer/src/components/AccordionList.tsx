import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { AccordionDetails, Box, List, Typography } from '@mui/material';
import React from 'react';

import Accordion from './Accordion';
import AccordionSummary from './AccordionSummary';

export type AccordionListProps = {
  name: string;
  title?: React.ReactNode;
  component?: React.ElementType;
  className?: string;
  // summaryClasses?: AccordionSummaryProps['classes'];
  // detailsClasses?: AccordionDetailsProps['classes'];
  expanded?: boolean;
  onChange?: (name?: string) => void;
  selected?: boolean;
};

const AccordionList: React.FC<React.PropsWithChildren<AccordionListProps>> = ({
  name,
  title,
  component = List,
  children,
  // summaryClasses,
  // detailsClasses,
  expanded = false,
  onChange = () => {},
  selected,
  className,
}) => (
  <Accordion
    expanded={expanded}
    onChange={() => onChange(expanded ? undefined : name)}
    className={className}
  >
    <AccordionSummary
      expandIcon={React.Children.count(children) > 0 ? <ExpandMoreIcon /> : undefined}
      aria-controls={name}
      // classes={summaryClasses}
      selected={selected}
      className={className}
    >
      {typeof title === 'string' ? <Typography>{title}</Typography> : title}
    </AccordionSummary>
    <AccordionDetails sx={{ p: 0 }}>
      <Box component={component} width={1}>
        {children}
      </Box>
    </AccordionDetails>
  </Accordion>
);

export default AccordionList;

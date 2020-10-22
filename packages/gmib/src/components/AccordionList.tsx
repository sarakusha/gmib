/*
 * @license
 * Copyright (c) 2020. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */
import { AccordionDetailsProps, AccordionSummaryProps } from '@material-ui/core';
import Box from '@material-ui/core/Box';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import React, {
  Dispatch,
  ReactNode,
  SetStateAction,
  useCallback,
  useContext,
  useState,
} from 'react';
import List from '@material-ui/core/List';
import Typography from '@material-ui/core/Typography';

import Accordion from './Accordion';
import AccordionDetails from './AccordionDetails';
import AccordionSummary from './AccordionSummary';

export type AccordionListProps = {
  name: string;
  title?: ReactNode;
  component?: React.ElementType;
  className?: string;
  summaryClasses?: AccordionSummaryProps['classes'];
  detailsClasses?: AccordionDetailsProps['classes'];
};

export type AccordionContext = [
  current: string | false,
  setCurrent: Dispatch<SetStateAction<string | false>>
];

const Context = React.createContext<AccordionContext>([false, () => {} /* , () => {}*/]);
export const useAccordion = (): AccordionContext => useContext(Context);

export const AccordionProvider: React.FC = ({ children }) => {
  const value = useState<string | false>(false);
  return <Context.Provider value={value}>{children}</Context.Provider>;
};

const AccordionList: React.FC<AccordionListProps> = ({
  name,
  title,
  component = List,
  className,
  children,
  summaryClasses,
  detailsClasses,
}) => {
  const [current, setCurrent] = useAccordion();
  const changeHandler = useCallback(() => {
    setCurrent(prev => prev !== name && name);
  }, [name, setCurrent]);
  const summary = title ?? name;
  // useEffect(() => setTopPos(name, ref.current?.offsetTop), [name]);
  return (
    <Accordion expanded={current === name} onChange={changeHandler} className={className}>
      <AccordionSummary
        expandIcon={<ExpandMoreIcon />}
        aria-controls={name}
        classes={summaryClasses}
      >
        {typeof summary === 'string' ? <Typography>{summary}</Typography> : title}
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

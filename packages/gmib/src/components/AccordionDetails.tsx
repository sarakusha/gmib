/*
 * @license
 * Copyright (c) 2020. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

import { withStyles } from '@material-ui/core/styles';
import { AccordionDetails as MuiAccordionDetails } from '@material-ui/core';

const AccordionDetails = withStyles({
  root: {
    padding: 0, // theme.spacing(2),
  },
})(MuiAccordionDetails);

export default AccordionDetails;

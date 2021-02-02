/*
 * @license
 * Copyright (c) 2021. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */
import ListItem from '@material-ui/core/ListItem';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import ListItemText from '@material-ui/core/ListItemText';
import SettingsBrightnessIcon from '@material-ui/icons/SettingsBrightness';
import React from 'react';
import AccordionList from './AccordionList';

const OtherItems: React.FC = () => (
    <AccordionList name="other" title="Еще...">
      <ListItem button>
        <ListItemIcon>
          <SettingsBrightnessIcon />
        </ListItemIcon>
        <ListItemText>Автояркость</ListItemText>
      </ListItem>
    </AccordionList>
  );

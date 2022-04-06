/*
 * @license
 * Copyright (c) 2022. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

import { FunctionInterpolation, useTheme } from '@emotion/react';
import {
  Box,
  IconButton,
  ListItem,
  ListItemIcon,
  ListItemSecondaryAction,
  ListItemText,
  Tooltip,
  Typography,
} from '@mui/material';
import { Theme, styled } from '@mui/material/styles';
import LanIcon from '@mui/icons-material/SettingsInputHdmi';
import CloseIcon from '@mui/icons-material/Close';
import LinkIcon from '@mui/icons-material/Link';
import UsbIcon from '@mui/icons-material/Usb';
import { Address, findDeviceById } from '@nibus/core';
import React, { useCallback, useMemo } from 'react';
import ReloadIcon from '@mui/icons-material/Refresh';
import { useDispatch, useSelector } from '../store';
import { selectScreenAddresses } from '../store/configSlice';
import {
  DeviceStateWithParent,
  filterDevicesByAddress,
  selectAllDevicesWithParent,
} from '../store/devicesSlice';
import {
  TabValues,
  selectCurrentDeviceId,
  selectCurrentTab,
  setCurrentDevice,
  setCurrentTab,
} from '../store/currentSlice';
import { findNetNovastarDevices, selectAllNovastars } from '../store/novastarsSlice';
import AccordionList from './AccordionList';
import DeviceIcon from './DeviceIcon';
import { reloadSession } from '../store/sessionSlice';

const tabName = 'devices';

type DeviceItem = { name: React.ReactNode; device: DeviceStateWithParent };

const getItems = (addresses: string[], devices: DeviceStateWithParent[]): DeviceItem[] => {
  let rest = [...devices];
  const result: DeviceItem[] = [];
  addresses.forEach(address => {
    const subs = filterDevicesByAddress(devices, new Address(address));
    if (subs.length > 0) {
      const ids = subs.map(({ id }) => id);
      rest = rest.filter(({ id }) => !ids.includes(id));
      result.push(
        ...subs.map(device => {
          const serno = new Address(device.props.serno.value as string).toString();
          return {
            name: (
              <span title={serno}>
                {address}
                {device.connected && <small>&nbsp;{serno}</small>}
              </span>
            ),
            device,
          };
        })
      );
    }
  });
  return [
    ...result,
    ...rest.map(device => ({
      name: device.address,
      device,
    })),
  ];
};

const noWrap = { noWrap: true };

const Wrapper = styled('div')`
  position: relative;
`;

const kindStyle: FunctionInterpolation<Theme> = theme => ({
  color: theme.palette.primary.light,
  position: 'absolute',
  bottom: 0,
  right: -16,
  fontSize: '1em',
});

const Devices: React.FC = () => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const devices = useSelector(selectAllDevicesWithParent);
  const current = useSelector(selectCurrentDeviceId);
  const addresses = useSelector(selectScreenAddresses);
  const tab = useSelector(selectCurrentTab);
  const novastars = useSelector(selectAllNovastars);
  // const [, setAccordion] = useAccordion();
  const reloadHandler = useCallback<React.MouseEventHandler<HTMLButtonElement>>(
    e => {
      dispatch(reloadSession());
      dispatch(findNetNovastarDevices());
      e.stopPropagation();
    },
    [dispatch]
  );
  const clickHandler = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const { id } = e.currentTarget.dataset; // as DeviceId;
      id && dispatch(setCurrentDevice(id));
    },
    [dispatch]
  );
  const title = useMemo(
    () => (
      <Box display="flex" alignItems="center" justifyContent="space-between" width={1}>
        <Typography>Устройства</Typography>
        <IconButton size="small" title="Повторить поиск" onClick={reloadHandler}>
          <ReloadIcon />
        </IconButton>
      </Box>
    ),
    [reloadHandler]
  );
  const items = getItems(addresses, devices);
  const hasDevices = devices.length + novastars.length > 0;
  return (
    <AccordionList
      name={tabName}
      title={title}
      expanded={tab === 'devices' && hasDevices}
      selected={tab === 'devices' && !hasDevices}
      onChange={currentTab => dispatch(setCurrentTab(currentTab as TabValues))}
    >
      {items.map(({ name, device }) => {
        const { id, connected, path, mib, isEmptyAddress, parent, address, category } = device;
        const removable = Boolean(parent || address!.indexOf('.') !== -1);
        // Reflect.getMetadata('parent', device);
        // const mib = Reflect.getMetadata('mib', device);
        // const desc = device.connection?.description ?? {};
        // let Icon = DeviceIcon;
        // if (!parent && desc.link) {
        //   Icon = DeviceHubIcon;
        // } else if (mib && mib.startsWith('minihost')) {
        //   Icon = TvIcon;
        // }
        return (
          <ListItem
            button
            key={id}
            onClick={clickHandler}
            data-id={id}
            selected={id === current}
            disabled={!connected}
            id={`tab-${id}`}
            aria-controls={`tabpanel-${id}`}
          >
            <ListItemIcon>
              <Wrapper>
                <DeviceIcon color="inherit" device={device} />
                {parent ? (
                  <Tooltip title={parent.address}>
                    <LinkIcon css={kindStyle(theme)} />
                  </Tooltip>
                ) : (
                  path && (
                    <Tooltip title={path}>
                      <UsbIcon css={kindStyle(theme)} />
                    </Tooltip>
                  )
                )}
              </Wrapper>
            </ListItemIcon>
            <ListItemText
              primaryTypographyProps={noWrap}
              primary={isEmptyAddress ? category : name}
              secondary={isEmptyAddress ? id : mib}
            />
            {removable && id && (
              <ListItemSecondaryAction>
                <IconButton
                  edge="end"
                  aria-label="delete"
                  size="small"
                  onClick={event => {
                    event.stopPropagation();
                    findDeviceById(id)?.release();
                  }}
                >
                  <CloseIcon fontSize="inherit" />
                </IconButton>
              </ListItemSecondaryAction>
            )}
          </ListItem>
        );
      })}
      {novastars.map(card => (
        <ListItem
          key={card.path}
          button
          selected={card.path === current}
          data-id={card.path}
          onClick={clickHandler}
        >
          <ListItemIcon>
            <Wrapper>
              <DeviceIcon color="inherit" />
              <Tooltip title={card.path}>
                {card.path[0] >= '0' && card.path[0] <= '9' ? (
                  <LanIcon css={kindStyle(theme)} />
                ) : (
                  <UsbIcon css={kindStyle(theme)} />
                )}
              </Tooltip>
            </Wrapper>
          </ListItemIcon>
          <ListItemText
            primaryTypographyProps={noWrap}
            primary={card.info?.name}
            secondary="novastar"
            secondaryTypographyProps={noWrap}
          />
        </ListItem>
      ))}
    </AccordionList>
  );
};

export default Devices;

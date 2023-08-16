import CloseIcon from '@mui/icons-material/Close';
import LinkIcon from '@mui/icons-material/Link';
import ReloadIcon from '@mui/icons-material/Refresh';
import LanIcon from '@mui/icons-material/SettingsInputHdmi';
import UsbIcon from '@mui/icons-material/Usb';
import type { Interpolation } from '@mui/material';
import {
  Box,
  Collapse,
  IconButton,
  ListItemButton,
  ListItemIcon,
  ListItemSecondaryAction,
  ListItemText,
  Tooltip,
  Typography,
} from '@mui/material';
import type { Theme } from '@mui/material/styles';
import { css, styled } from '@mui/material/styles';
import React, { useCallback, useMemo } from 'react';
import { TransitionGroup } from 'react-transition-group';

import { useNovastars } from '../api/novastar';
import { useGetAddressesQuery } from '../api/screens';
import { useDispatch, useSelector } from '../store';
import type { TabValues } from '../store/currentSlice';
import { setCurrentDevice, setCurrentTab } from '../store/currentSlice';
import type { DeviceStateWithParent } from '../store/devicesSlice';
// import { updateNovastarDevices } from '../store/novastarThunks';
import {
  filterDevicesByAddress,
  selectAllDevicesWithParent,
  selectCurrentDeviceId,
  selectCurrentTab,
} from '../store/selectors';
// import { reloadSession } from '../store/sessionSlice';

import AccordionList from './AccordionList';
import DeviceIcon from './DeviceIcon';

import Address from '@nibus/core/Address';

import { reAddress } from '/@common/config';

const tabName = 'devices';

type DeviceItem = { name: React.ReactNode; device: DeviceStateWithParent };

const getItems = (addresses: string[], devices: DeviceStateWithParent[]): DeviceItem[] => {
  let rest = [...devices];
  const result: DeviceItem[] = [];
  addresses
    .filter(address => reAddress.test(address))
    .forEach(address => {
      const subs = filterDevicesByAddress(devices, new Address(address));
      if (subs.length > 0) {
        const ids = subs.map(({ id }) => id);
        rest = rest.filter(({ id }) => !ids.includes(id));
        result.push(
          ...subs.map(device => {
            const { value } = device.props.serno;
            const serno = typeof value === 'string' ? new Address(value).toString() : '';
            return {
              name: (
                <span title={serno}>
                  {address}
                  {device.connected && <small>&nbsp;{serno}</small>}
                </span>
              ),
              device,
            };
          }),
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

const kindStyle: Interpolation<{ theme: Theme }> = ({ theme }) =>
  css({
    color: theme.palette.primary.light,
    position: 'absolute',
    bottom: 0,
    right: -16,
    fontSize: '1em',
  });

const StyledLinkIcon = styled(LinkIcon)(kindStyle);

const StyledUsbIcon = styled(UsbIcon)`
  ${kindStyle}
`;

const StyledLanIcon = styled(LanIcon)`
  ${kindStyle}
`;

const Devices: React.FC = () => {
  const dispatch = useDispatch();
  const devices = useSelector(selectAllDevicesWithParent);
  const current = useSelector(selectCurrentDeviceId);
  const { data: addresses = [] } = useGetAddressesQuery();
  const tab = useSelector(selectCurrentTab);
  const { novastars = [] } = useNovastars(); // useSelector(selectAllNovastars);
  // const [, setAccordion] = useAccordion();
  const reloadHandler = useCallback<React.MouseEventHandler<HTMLButtonElement>>(e => {
    window.nibus.reloadDevices();
    // TODO: force update novastar device list
    // dispatch(updateNovastarDevices());
    e.stopPropagation();
  }, []);
  // if (!current && (devices.length > 0 || novastars.length > 0)) {
  //   dispatch(setCurrentDevice(devices[0]?.id ?? novastars[0]?.path));
  // }
  const clickHandler = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const { id } = e.currentTarget.dataset; // as DeviceId;
      id && dispatch(setCurrentDevice(id));
    },
    [dispatch],
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
    [reloadHandler],
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
      <TransitionGroup>
        {items.map(({ name, device }) => {
          const { id, connected, path, mib, isEmptyAddress, parent, address, category } = device;
          const removable = Boolean(parent || address.indexOf('.') !== -1);
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
            <Collapse key={id}>
              <ListItemButton
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
                        <StyledLinkIcon />
                      </Tooltip>
                    ) : (
                      path && (
                        <Tooltip title={path}>
                          <StyledUsbIcon />
                        </Tooltip>
                      )
                    )}
                  </Wrapper>
                </ListItemIcon>
                <ListItemText
                  primaryTypographyProps={noWrap}
                  secondaryTypographyProps={noWrap}
                  primary={isEmptyAddress ? category : name}
                  secondary={isEmptyAddress ? path : mib}
                />
                {removable && id && (
                  <ListItemSecondaryAction>
                    <IconButton
                      edge="end"
                      aria-label="delete"
                      size="small"
                      onClick={event => {
                        event.stopPropagation();
                        window.nibus.releaseDevice(id);
                      }}
                    >
                      <CloseIcon fontSize="inherit" />
                    </IconButton>
                  </ListItemSecondaryAction>
                )}
              </ListItemButton>
            </Collapse>
          );
        })}
        {novastars.map(card => (
          <Collapse key={card.path} className="yu6ODejliBoLEEgGBmOEe rlXINR-cZo5bnISD5TaUT">
            <ListItemButton
              selected={card.path === current}
              data-id={card.path}
              onClick={clickHandler}
              disabled={!card.connected}
            >
              <ListItemIcon>
                <Wrapper>
                  <DeviceIcon color="inherit" />
                  <Tooltip title={card.path}>
                    {card.path[0] >= '0' && card.path[0] <= '9' ? (
                      <StyledLanIcon />
                    ) : (
                      <StyledUsbIcon />
                    )}
                  </Tooltip>
                </Wrapper>
              </ListItemIcon>
              <ListItemText
                primaryTypographyProps={noWrap}
                primary={card.info?.name}
                secondary={card.path}
                secondaryTypographyProps={noWrap}
              />
            </ListItemButton>
          </Collapse>
        ))}
      </TransitionGroup>
    </AccordionList>
  );
};

export default Devices;

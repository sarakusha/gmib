import type { FunctionInterpolation } from '@emotion/react';
import type { SelectProps } from '@mui/material';
import { Box, Button, Paper, Table, TableBody, TableRow, TextField } from '@mui/material';
import type { Theme } from '@mui/material/styles';
import { css, styled } from '@mui/material/styles';
import { ChipTypeEnum } from '@novastar/native/ChipType';
import { DviSelectModeEnum } from '@novastar/native/DviSelectMode';
import type { BrightnessRGBV } from '@novastar/screen';
import { getScreenLocation } from '@novastar/screen/getScreenLocation';
import debounce from 'lodash/debounce';
import React, { useCallback, useEffect } from 'react';

import {
  updateNovastarScreens,
  useLoginTaurusMutation,
  useSetBrightnessMutation,
} from '../api/novastar';
import { useToolbar } from '../providers/ToolbarProvider';
import { useDispatch, useSelector } from '../store';

import { minmax, noop } from '/@common/helpers';

import { selectCurrentTab } from '../store/selectors';

import DisplayModeSelector from './DisplayModeSelector';
import EditCell from './EditCell';
import NovastarToolbar from './NovastarToolbar';

import type { Novastar } from '/@common/novastar';

import StyledAccordionList from './StyledAccordionList';
import TableCell from './TableCell';

const brightProps: Readonly<Record<keyof BrightnessRGBV, string>> = {
  overall: 'Яркость',
  red: 'Уровень красного',
  green: 'Уровень зеленого',
  blue: 'Уровень синего',
  vRed: 'Уровень вирт. красного',
};

const isBrightnessProps = (name: string): name is keyof BrightnessRGBV => name in brightProps;

const itemStyle: FunctionInterpolation<Theme> = theme => css`
  padding-left: ${theme.spacing(0.5)};
  padding-right: ${theme.spacing(2)};
`;

const ValueCell = styled(TableCell)(
  ({ theme }) => `
  padding-left: ${theme.spacing(0.5)};
  padding-right: ${theme.spacing(2)};
`,
);

const NameCell = styled(TableCell)(
  ({ theme }) => `
  padding-left: ${theme.spacing(4)};
`,
);

const screenName = (index = 0) => `${index}`;
const TAURUS_BRIGHTNESS_DEBOUNCE_MS = 750;

const getTaurusLoginError = (error: unknown): string => {
  if (
    typeof error === 'object' &&
    error !== null &&
    'data' in error &&
    typeof error.data === 'string'
  ) {
    return error.data;
  }
  return 'Не удалось войти в Taurus';
};

const NovastarDeviceTab: React.FC<{ device: Novastar | undefined; selected?: boolean }> = ({
  device,
  selected = false,
}) => {
  const [, setToolbar] = useToolbar();
  const tab = useSelector(selectCurrentTab);
  const active = selected && tab === 'devices' && device !== undefined;
  const path = device?.path;
  useEffect(() => {
    if (active) {
      setToolbar(<NovastarToolbar />);
      return () => setToolbar(null);
    }
    return noop;
  }, [active, setToolbar, path]);
  const dispatch = useDispatch();
  const rgbvChanged = useCallback(
    (name: string, value: unknown) => {
      const [index, color] = name.split(':', 2);
      const screen = Number(index) as 0;
      path &&
        isBrightnessProps(color) &&
        dispatch(
          updateNovastarScreens(path, screen, 'rgbv', rgbv => ({
            overall: rgbv?.overall ?? 255,
            red: rgbv?.red ?? 255,
            green: rgbv?.green ?? 255,
            blue: rgbv?.blue ?? 255,
            vRed: rgbv?.vRed ?? 255,
            [color]: minmax(255, Number(value)),
          })),
        );
    },
    [dispatch, path],
  );
  const gammaHandler = useCallback(
    (name: string, value: unknown) => {
      path && dispatch(updateNovastarScreens(path, Number(name), 'gamma', Number(value)));
    },
    [path, dispatch],
  );
  const modeHandler = useCallback<Required<SelectProps>['onChange']>(
    e => {
      const { name, value } = e.target;
      path && dispatch(updateNovastarScreens(path, Number(name), 'mode', Number(value)));
    },
    [path, dispatch],
  );
  const [currentScreen, setCurrentScreen] = React.useState<string | undefined>(screenName());
  const [password, setPassword] = React.useState('');
  const [loginTaurus, { isLoading: isLoggingIn }] = useLoginTaurusMutation();
  const [loginError, setLoginError] = React.useState<string>();
  const [taurusBrightness, setTaurusBrightness] = React.useState(100);
  const [taurusBrightnessDirty, setTaurusBrightnessDirty] = React.useState(false);
  const pendingTaurusBrightness = React.useRef<number | undefined>(undefined);
  const [setBrightness] = useSetBrightnessMutation();
  const setTaurusBrightnessDebounced = React.useMemo(
    () =>
      debounce((nextPath: string, value: number) => {
        void setBrightness({ path: nextPath, screen: -1, value })
          .unwrap()
          .then(() => {
            if (pendingTaurusBrightness.current === value) {
              setTaurusBrightnessDirty(false);
            }
          })
          .catch(() => undefined);
      }, TAURUS_BRIGHTNESS_DEBOUNCE_MS),
    [setBrightness],
  );
  useEffect(
    () => () => {
      setTaurusBrightnessDebounced.cancel();
    },
    [setTaurusBrightnessDebounced],
  );
  useEffect(() => {
    if (!taurusBrightnessDirty && device?.taurus?.brightness !== undefined) {
      setTaurusBrightness(device.taurus.brightness);
    }
  }, [device?.taurus?.brightness, taurusBrightnessDirty]);
  const taurusBrightnessChanged = useCallback(
    (_name: string, value: unknown) => {
      if (!path) return;
      const brightness = minmax(100, Number(value));
      pendingTaurusBrightness.current = brightness;
      setTaurusBrightness(brightness);
      setTaurusBrightnessDirty(true);
      setTaurusBrightnessDebounced(path, brightness);
    },
    [path, setTaurusBrightnessDebounced],
  );

  if (!device) return null;
  if (device.taurus) {
    const { taurus } = device;
    return (
      <Box sx={{ p: 1, width: 1, fontSize: 'body1.fontSize', display: active ? 'block' : 'none' }}>
        <Paper>
          <StyledAccordionList
            name="taurus"
            title={`${taurus.productName} — ${taurus.aliasName}`}
            component={Table}
            expanded
          >
            <TableBody>
              <TableRow>
                <NameCell>Серийный номер</NameCell>
                <ValueCell align="right">{taurus.serialNumber}</ValueCell>
              </TableRow>
              <TableRow>
                <NameCell>Идентификатор привязки</NameCell>
                <ValueCell align="right">{device.path}</ValueCell>
              </TableRow>
              <TableRow>
                <NameCell>Текущий адрес</NameCell>
                <ValueCell align="right">
                  {taurus.address}:{taurus.port}
                </ValueCell>
              </TableRow>
              <TableRow>
                <NameCell>Платформа</NameCell>
                <ValueCell align="right">{taurus.platform}</ValueCell>
              </TableRow>
              <TableRow>
                <NameCell>Холст</NameCell>
                <ValueCell align="right">
                  {taurus.width}x{taurus.height}
                </ValueCell>
              </TableRow>
              <TableRow>
                <NameCell>Яркость</NameCell>
                {taurus.authenticated ? (
                  <EditCell
                    name="taurusBrightness"
                    type="number"
                    value={taurusBrightness}
                    min={0}
                    max={100}
                    step={1}
                    unit="%"
                    align="right"
                    dirty={taurusBrightnessDirty}
                    onChangeProperty={taurusBrightnessChanged}
                  />
                ) : (
                  <ValueCell align="right">
                    {taurus.brightness === undefined ? '—' : `${taurus.brightness}%`}
                  </ValueCell>
                )}
              </TableRow>
              <TableRow>
                <NameCell>Освещённость</NameCell>
                <ValueCell align="right">
                  {taurus.illuminance === undefined ? '—' : `${taurus.illuminance} лк`}
                </ValueCell>
              </TableRow>
              <TableRow>
                <NameCell>Авторизация</NameCell>
                <ValueCell align="right">{taurus.authenticated ? 'Да' : 'Нет'}</ValueCell>
              </TableRow>
            </TableBody>
          </StyledAccordionList>
          {taurus.passwordRequired && (
            <Box
              component="form"
              sx={{ p: 2, display: 'flex', gap: 1, alignItems: 'flex-start' }}
              onSubmit={event => {
                event.preventDefault();
                setLoginError(undefined);
                void loginTaurus({ path: device.path, password })
                  .unwrap()
                  .then(() => setPassword(''))
                  .catch(error => setLoginError(getTaurusLoginError(error)));
              }}
            >
              <TextField
                label="Пароль Taurus"
                type="password"
                size="small"
                value={password}
                error={Boolean(loginError)}
                helperText={loginError ?? device.error ?? ' '}
                onChange={event => setPassword(event.target.value)}
                autoComplete="current-password"
              />
              <Button type="submit" variant="contained" disabled={!password || isLoggingIn}>
                Войти
              </Button>
            </Box>
          )}
        </Paper>
      </Box>
    );
  }
  if (!device.info) return null;
  const { screens = [], info } = device;
  const locations = screens
    .map(({ info: screenInfo }) => screenInfo && getScreenLocation(screenInfo))
    .map(location => ({
      width: location ? location.rightBottom.x - location.leftTop.x : '-',
      height: location ? location.rightBottom.y - location.leftTop.y : '-',
      x: location?.leftTop.x ?? '-',
      y: location?.leftTop.y ?? '-',
    }));
  return (
    <Box
      sx={{
        p: 1,
        width: 1,
        fontSize: 'body1.fontSize',
        display: active ? 'block' : 'none',
      }}
    >
      <Paper>
        {info && (
          <StyledAccordionList name="common" title={info.name} component={Table} expanded>
            <TableBody>
              <TableRow>
                <NameCell>Серийный номер</NameCell>
                <ValueCell align="right">{info.mac}</ValueCell>
              </TableRow>
              <TableRow>
                <NameCell>Вход</NameCell>
                <ValueCell align="right">
                  {info.dviSelect ? DviSelectModeEnum[info.dviSelect] || 'DVI' : '-'}
                </ValueCell>
              </TableRow>
              <TableRow>
                <NameCell>Сигнал</NameCell>
                <ValueCell align="right">{device.hasDVISignalIn ? 'Да' : 'Нет'}</ValueCell>
              </TableRow>
              <TableRow>
                <NameCell>Выходы</NameCell>
                <ValueCell align="right">{info.portCount}</ValueCell>
              </TableRow>
            </TableBody>
          </StyledAccordionList>
        )}
        {screens.map((screen, index) => {
          const name = screenName(index);
          const loc = locations[index];
          return (
            <StyledAccordionList
              key={name}
              name={name}
              title={`Экран #${index + 1}`}
              component={Table}
              expanded={currentScreen === name}
              onChange={setCurrentScreen}
            >
              <TableBody>
                <TableRow>
                  <NameCell>Чип</NameCell>
                  <ValueCell align="right">
                    {typeof screen.chipType === 'number'
                      ? ChipTypeEnum[screen.chipType].replace('Chip_', '')
                      : 'N/A'}
                  </ValueCell>
                </TableRow>
                <TableRow>
                  <NameCell>Размер</NameCell>
                  {loc && (
                    <ValueCell align="right">
                      {loc.width}x{loc.height}
                    </ValueCell>
                  )}
                </TableRow>
                <TableRow>
                  <NameCell>Отступ</NameCell>
                  {loc && (
                    <ValueCell align="right">
                      {loc.x},{loc.y}
                    </ValueCell>
                  )}
                </TableRow>
                {Object.entries(brightProps).map(([prop, desc]) => (
                  <TableRow key={prop}>
                    <NameCell>
                      {prop === 'overall' && screen.rgbv != null
                        ? `${desc} (${Math.round((screen.rgbv.overall * 100) / 2.55) / 100}%)`
                        : desc}
                    </NameCell>
                    <EditCell
                      name={`${name}:${prop}`}
                      css={itemStyle}
                      type="number"
                      min={0}
                      max={255}
                      align="right"
                      value={screen.rgbv?.[prop as keyof BrightnessRGBV] ?? ''}
                      onChangeProperty={rgbvChanged}
                      disabled={screen.rgbv == null || !device.connected}
                    />
                  </TableRow>
                ))}
                <TableRow>
                  <NameCell>Гамма</NameCell>
                  <EditCell
                    name={name}
                    css={itemStyle}
                    type="number"
                    min={1}
                    max={4}
                    step={0.1}
                    align="right"
                    value={screen.gamma ?? ''}
                    onChangeProperty={gammaHandler}
                    disabled={screen.gamma == null || !device.connected}
                  />
                </TableRow>
                <TableRow>
                  <NameCell>Режим</NameCell>
                  <ValueCell>
                    <DisplayModeSelector
                      variant="standard"
                      fullWidth
                      value={screen.mode ?? ''}
                      name={name}
                      onChange={modeHandler}
                      disabled={screen.mode == null || !device.connected}
                    />
                  </ValueCell>
                </TableRow>
              </TableBody>
            </StyledAccordionList>
          );
        })}
      </Paper>
    </Box>
  );
};

export default NovastarDeviceTab;

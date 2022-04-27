/* eslint-disable react/no-array-index-key */
/*
 * @license
 * Copyright (c) 2022. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */
import {
  Box,
  InputProps,
  Paper,
  SelectProps,
  TextField,
  TextFieldProps,
  Typography,
} from '@mui/material';
import { FunctionInterpolation, useTheme } from '@emotion/react';
import { ChipTypeEnum } from '@novastar/native/build/main/generated/ChipType';
import { DviSelectModeEnum } from '@novastar/native/build/main/generated/DviSelectMode';
import { BrightnessRGBV, getScreenLocation } from '@novastar/screen';
import React, { useCallback, useEffect, useState } from 'react';
import { Theme, css, styled } from '@mui/material/styles';
import { useToolbar } from '../providers/ToolbarProvider';
import { useDispatch, useSelector } from '../store';
import { selectCurrentTab } from '../store/currentSlice';
import {
  Novastar,
  setDisplayMode,
  setGamma,
  setScreenColorBrightness,
} from '../store/novastarsSlice';
import { noop } from '../util/helpers';
import DisplayModeSelector from './DisplayModeSelector';
import NovastarToolbar from './NovastarToolbar';

// const useStyles = makeStyles(theme => ({
//   root: {
//     // padding: theme.spacing(1),
//     // marginLeft: 'auto',
//     // marginRight: 'auto',
//     // margin: theme.spacing(1),
//     // display: 'flex',
//     // flexDirection: 'column',
//     // alignItems: 'center',
//     // width: '100%',
//   },
//   paper: {
//     padding: theme.spacing(1),
//     minWidth: '100%',
//     overflowY: 'auto',
//   },
//   grid: {
//     display: 'grid',
//     gridTemplateColumns: '30px auto 1fr',
//     gap: 2,
//   },
//   itemValue: {
//     gridColumnStart: 3,
//     padding: 4,
//   },
//   propertyName: {
//     gridColumnStart: 'span 2',
//     fontWeight: 500,
//     backgroundColor: theme.palette.action.selected,
//     padding: 4,
//   },
//   brightness: {
//     gridRowStart: 'span 5',
//     writingMode: 'vertical-lr',
//     transform: 'rotate(180deg)',
//     textAlign: 'center',
//   },
//   center: {
//     textAlign: 'center',
//   },
//   bold: {
//     fontWeight: 500,
//     backgroundColor: theme.palette.action.selected,
//     padding: 4,
//   },
//   RGBV: {
//     gridColumnStart: 2,
//   },
//   screens: {
//     display: 'flex',
//     alignItems: 'center',
//     gap: 2,
//   },
//   item: {
//     // flexGrow: 1,
//     width: 130,
//     paddingLeft: 4,
//     paddingRight: 4,
//   },
// }));

type RGBVItemProps = { kind: keyof BrightnessRGBV } & Omit<
  TextFieldProps,
  'inputProps' | 'type' | 'onBlur'
>;

const brightnessInputProps: Readonly<InputProps['inputProps']> = {
  min: 0,
  max: 255,
};

const gammaInputProps: Readonly<InputProps['inputProps']> = {
  min: 1,
  max: 4,
  step: 0.1,
};

const brightProps = ['overall', 'red', 'green', 'blue', 'vRed'] as const;

const isBrightnessProps = (name: string): name is keyof BrightnessRGBV =>
  (brightProps as ReadonlyArray<string>).includes(name);

const RGBVItem: React.FC<RGBVItemProps> = ({ kind, className, value, onChange, ...props }) => {
  const [state, setState] = useState(value);
  useEffect(() => setState(value), [value]);
  const changeHandler = useCallback<React.ChangeEventHandler<HTMLInputElement>>(
    e => {
      const { value: val } = e.target;
      if (val !== '' && onChange) onChange(e);
      else setState(val);
    },
    [onChange]
  );
  return kind === 'overall' ? (
    <Typography className={className}>
      {typeof value === 'number' ? `${value} (${Math.round((value * 100) / 2.55) / 100}%)` : '-'}
    </Typography>
  ) : (
    <TextField
      {...props}
      className={className}
      value={state}
      inputProps={brightnessInputProps}
      onChange={changeHandler}
      onBlur={() => setState(value)}
      type="number"
      variant="standard"
    />
  );
};

const Name = styled(Typography)(({ theme }) => ({
  gridColumnStart: 'span 2',
  fontWeight: 500,
  backgroundColor: theme.palette.action.selected,
  padding: 4,
}));

const Value = styled(Typography)({
  gridColumnStart: 3,
  padding: 4,
});

const Screens = styled('div')({
  display: 'flex',
  alignItems: 'center',
  gap: 2,
});

const itemStyle = css`
  width: 130px;
  padding-left: 4px;
  padding-right: 4px;
`;

const boldStyle: FunctionInterpolation<Theme> = theme => css`
  font-weight: 500;
  background-color: ${theme.palette.action.selected};
  padding: ${theme.spacing(0.5)};
`;

const Item = styled(Typography)(itemStyle);

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
      // path && dispatch(reloadNovastar(path));
      setToolbar(<NovastarToolbar />);
      return () => setToolbar(null);
    }
    return noop;
  }, [active, setToolbar, path]);
  const dispatch = useDispatch();
  const rgbvChanged = useCallback<React.ChangeEventHandler<HTMLInputElement>>(
    e => {
      const { name, value } = e.target;
      const [index, color] = name.split(':', 2);
      const screen = Number(index);
      path &&
        isBrightnessProps(color) &&
        dispatch(
          setScreenColorBrightness({
            path,
            screen: Number(screen),
            color,
            value: Number(value),
          })
        );
    },
    [dispatch, path]
  );
  const gammaHandler = useCallback<React.ChangeEventHandler<HTMLInputElement>>(
    e => {
      const { name, value } = e.target;
      path &&
        dispatch(
          setGamma({
            path,
            screen: Number(name),
            value: Number(value),
          })
        );
    },
    [path, dispatch]
  );
  const modeHandler = useCallback<Required<SelectProps>['onChange']>(
    e => {
      const { name, value } = e.target;
      path &&
        dispatch(
          setDisplayMode({
            path,
            screen: Number(name),
            value: Number(value),
          })
        );
    },
    [path, dispatch]
  );

  if (!device || !device.info) return null;
  const { screens = [], info } = device;
  // const screens = [
  //   original[0],
  //   original[0],
  //   original[0],
  //   original[0],
  //   original[0],
  //   original[0],
  //   original[0],
  //   original[0],
  // ];
  const locations = screens
    .map(({ info: screenInfo }) => screenInfo && getScreenLocation(screenInfo))
    .map(location => ({
      width: location ? location.rightBottom.x - location.leftTop.x : '-',
      height: location ? location.rightBottom.y - location.leftTop.y : '-',
      x: location?.leftTop.x ?? '-',
      y: location?.leftTop.y ?? '-',
    }));
  const theme = useTheme();
  // const screens = original?.[0] && [original[0], original[0], original[0], original[0]];
  return (
    <Box width={1} display={active ? 'flex' : 'none'}>
      <Paper
        sx={{
          p: 1,
          minWidth: '100%',
          overflowY: 'auto',
        }}
      >
        {info && (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: '30px auto 1fr',
              gap: '2px',
            }}
          >
            <Name>Модель</Name>
            <Value>{info.name}</Value>
            <Name>mac</Name>
            <Value>{info.mac}</Value>
            <Name>Вход</Name>
            <Value>{info.dviSelect ? DviSelectModeEnum[info.dviSelect] || 'DVI' : '-'}</Value>
            <Name>Сигнал</Name>
            <Value>{device.hasDVISignalIn ? 'Да' : 'Нет'}</Value>
            <Name>Выходы</Name>
            <Value>{info.portCount}</Value>
            <Name>Экраны</Name>
            <Screens>
              {screens.map((_, index) => (
                // eslint-disable-next-line react/no-array-index-key
                <Item key={index} css={boldStyle(theme)}>
                  #{index + 1}
                </Item>
              ))}
            </Screens>
            <Name>Чип</Name>
            <Screens>
              {screens.map(({ chipType }, index) => (
                <Item key={index}>
                  {typeof chipType === 'number'
                    ? ChipTypeEnum[chipType].replace('Chip_', '')
                    : 'N/A'}
                </Item>
              ))}
            </Screens>
            <Name>Размер</Name>
            <Screens>
              {locations?.map(({ width, height }, index) => (
                <Item key={index}>
                  {width}x{height}
                </Item>
              ))}
            </Screens>
            <Name>Отступ</Name>
            <Screens>
              {locations?.map(({ x, y }, index) => (
                <Item key={index}>
                  {x},{y}
                </Item>
              ))}
            </Screens>
            <Typography
              css={boldStyle(theme)}
              sx={{
                gridRowStart: 'span 5',
                writingMode: 'vertical-lr',
                transform: 'rotate(180deg)',
                textAlign: 'center',
              }}
            >
              Яркость
            </Typography>
            {brightProps.map(name => (
              <React.Fragment key={name}>
                <Typography css={boldStyle(theme)} sx={{ gridColumnStart: 2 }}>
                  {name}
                </Typography>
                <Screens>
                  {screens.map(({ rgbv }, index) => (
                    <RGBVItem
                      key={index}
                      kind={name}
                      value={rgbv?.[name] ?? ''}
                      css={itemStyle}
                      name={`${index}:${name}`}
                      onChange={rgbvChanged}
                      disabled={rgbv == null}
                    />
                  ))}
                </Screens>
              </React.Fragment>
            ))}
            <Name>Гамма</Name>
            <Screens>
              {screens.map(({ gamma }, index) => (
                <TextField
                  key={index}
                  name={`${index}`}
                  css={itemStyle}
                  type="number"
                  inputProps={gammaInputProps}
                  value={gamma}
                  onChange={gammaHandler}
                  disabled={gamma == null}
                  variant="standard"
                />
              ))}
            </Screens>
            <Name>Режим</Name>
            <Screens>
              {screens.map(({ mode }, screen) => (
                <Box css={itemStyle} key={screen}>
                  <DisplayModeSelector
                    variant="standard"
                    fullWidth
                    value={mode}
                    name={`${screen}`}
                    onChange={modeHandler}
                    disabled={mode == null}
                  />
                </Box>
              ))}
            </Screens>
          </Box>
        )}
      </Paper>
    </Box>
  );
};

export default NovastarDeviceTab;

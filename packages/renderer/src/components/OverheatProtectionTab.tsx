import { Box, InputAdornment, MenuItem, Paper, TextField, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import React, { useCallback } from 'react';

import { useDispatch, useSelector } from '../store';
import { setProtectionProp } from '../store/configSlice';

import type { OverheatProtection } from '/@common/config';
import { DEFAULT_OVERHEAD_PROTECTION } from '/@common/config';
import { findById, toNumber } from '/@common/helpers';

import {selectCurrentHealth, selectOverheatProtection, selectScreens} from '../store/selectors';

import FormFieldSet from './FormFieldSet';

// const useStyles = makeStyles(theme => ({
//   root: {
//     padding: theme.spacing(1),
//     marginLeft: 'auto',
//     marginRight: 'auto',
//     '& > div ~ div': {
//       marginTop: theme.spacing(1),
//     },
//   },
//   content: {
//     padding: theme.spacing(1),
//   },
//   params: {
//     display: 'flex',
//     flexWrap: 'wrap',
//     // flexDirection: 'column',
//     gap: theme.spacing(1),
//     '& > *': {
//       width: '18ch',
//     },
//   },
//   screens: {
//     // position: 'relative',
//     // padding: theme.spacing(1),
//     // paddingTop: '5ch',
//     display: 'flex',
//     flexWrap: 'wrap',
//     gap: theme.spacing(1),
//   },
//   screen: {
//     padding: theme.spacing(1),
//     borderRadius: theme.shape.borderRadius,
//     borderColor: 'rgba(0, 0, 0, 0.23)',
//     borderWidth: 1,
//     borderStyle: 'solid',
//   },
//   wrapper: {
//     display: 'grid',
//     gridTemplateColumns: '14ch 5ch',
//     gridTemplateRows: 'auto',
//     gap: theme.spacing(1),
//   },
//   value: {
//     marginLeft: 'auto',
//   },
//   empty: {
//     marginLeft: 'auto',
//     marginRight: 'auto',
//   },
//   timestamp: {
//     // position: 'absolute',
//     // left: theme.spacing(1),
//     // top: theme.spacing(1),
//   },
// }));

const intervalInputProps = {
  startAdornment: <InputAdornment position="start">минуты</InputAdornment>,
  inputProps: {
    min: 0,
    max: 30,
  },
};

const stepInputProps = {
  startAdornment: <InputAdornment position="start">%</InputAdornment>,
  inputProps: {
    min: 3,
    max: 20,
  },
};

const Params = styled('div')(({ theme }) => ({
  display: 'flex',
  flexWrap: 'wrap',
  gap: theme.spacing(1),
}));

const Screen = styled(FormFieldSet)(({ theme }) => ({
  padding: theme.spacing(1),
  borderRadius: theme.shape.borderRadius,
  borderColor: 'rgba(0, 0, 0, 0.23)',
  borderWidth: 1,
  borderStyle: 'solid',
}));

const Value = styled('div')`
  margin-left: auto;
`;

const OverheatProtectionTab: React.FC = () => {
  const { interval, step, upperBound, bottomBound, aggregation } =
    useSelector(selectOverheatProtection) ?? DEFAULT_OVERHEAD_PROTECTION;
  const dispatch = useDispatch();
  const handleChange = useCallback<React.ChangeEventHandler<HTMLInputElement>>(
    e => {
      const { value, id } = e.currentTarget;
      const res = toNumber(value) ?? 0;
      if (res !== undefined && !Number.isNaN(res)) {
        dispatch(setProtectionProp([id as keyof OverheatProtection, res]));
      }
    },
    [dispatch],
  );
  // const health: Health = {
  //   screens: {
  //     test: {
  //       aggregations: [120, 70, 60],
  //     },
  //     test2: {
  //       aggregations: [120, 70, 60],
  //     },
  //   },
  //   timestamp: Date.now(),
  // }; //
  const health = useSelector(selectCurrentHealth);
  const screens = useSelector(selectScreens);
  return (
    <Box
      sx={{
        p: 1,
        mx: 'auto',
        '& > div ~ div': { mt: 1 },
      }}
    >
      <Paper sx={{ p: 1 }}>
        <Params sx={{ '& > *': { width: '18ch' } }}>
          <TextField
            variant="standard"
            id="interval"
            label="Интервал"
            value={interval}
            type="number"
            InputProps={intervalInputProps}
            onChange={handleChange}
          />
          <TextField
            variant="standard"
            id="step"
            label="Шаг понижения"
            value={step}
            type="number"
            InputProps={stepInputProps}
            onChange={handleChange}
          />
          <TextField
            variant="standard"
            id="aggregation"
            select
            label="Температура"
            value={aggregation}
            onChange={e => {
              dispatch(setProtectionProp(['aggregation', Number(e.target.value)]));
            }}
          >
            <MenuItem value={0}>Максимальная</MenuItem>
            <MenuItem value={1}>Средняя</MenuItem>
            <MenuItem value={2}>Медиана</MenuItem>
          </TextField>
          <TextField
            variant="standard"
            id="bottomBound"
            label="Нижняя граница"
            value={bottomBound}
            type="number"
            InputProps={{
              startAdornment: <InputAdornment position="start">&deg;C</InputAdornment>,
              inputProps: {
                min: 30,
                max: upperBound,
              },
            }}
            onChange={handleChange}
          />
          <TextField
            variant="standard"
            id="upperBound"
            label="Верхняя граница"
            value={upperBound}
            type="number"
            InputProps={{
              startAdornment: <InputAdornment position="start">&deg;C</InputAdornment>,
              inputProps: {
                min: bottomBound,
                max: 120,
              },
            }}
            onChange={handleChange}
          />
        </Params>
      </Paper>
      {health && Object.keys(health.screens).length > 0 && (
        <Paper sx={{ p: 1 }}>
          {health.timestamp && (
            <Typography paragraph>
              Состояние на {new Date(health.timestamp).toLocaleString()}
            </Typography>
          )}
          <Params>
            {Object.entries(health.screens).map(([id, screenHealth]) => {
              const [maximum, average, median] = screenHealth.aggregations;
              return (
                <Screen key={id} legend={findById(screens, id)?.name ?? id}>
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: '14ch 5ch',
                      gridTemplateRows: 'auto',
                      gap: 1,
                    }}
                  >
                    <div>Максимальная</div>
                    <Value>{maximum}&deg;C</Value>
                    <div>Средняя</div>
                    <Value>{average}&deg;C</Value>
                    <div>Медиана</div>
                    <Value>{median}&deg;C</Value>
                    <div>Ограничение</div>
                    <Value
                      sx={{
                        marginRight: screenHealth.maxBrightness != null ? undefined : 'auto',
                      }}
                    >
                      {screenHealth.maxBrightness ? `${screenHealth.maxBrightness}%` : '-'}
                    </Value>
                  </Box>
                </Screen>
              );
            })}
          </Params>
        </Paper>
      )}
    </Box>
  );
};

export default OverheatProtectionTab;

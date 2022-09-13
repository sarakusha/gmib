import ErrorIcon from '@mui/icons-material/Clear';
import { Box, Paper, Tooltip, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import React from 'react';

import type { VertexType } from '/@common/helpers';

// const bg = grey[100];

// const useStyles = makeStyles(theme => ({
//   root: {
//     margin: theme.spacing(0.5),
//     display: 'flex',
//     flexDirection: 'row',
//     flexShrink: 0,
//     height: '100%',
//   },
//   pos: {
//     backgroundColor: theme.palette.grey[100],
//     color: theme.palette.grey[500],
//     flex: 0,
//     display: 'flex',
//     flexDirection: 'column',
//     justifyContent: 'center',
//     borderBottomLeftRadius: 5,
//     borderTopLeftRadius: 5,
//     minWidth: '1.2rem',
//     '&>*': {
//       padding: 2,
//       textAlign: 'right',
//     },
//   },
//   xpos: {
//     borderBottom: '1px solid white',
//   },
//   ypos: {},
//   table: {
//     // backgroundColor: 'grey',
//     // minWidth: '5ch',
//     flex: 0,
//     borderCollapse: 'collapse',
//     margin: 2,
//   },
//   typo: {
//     fontSize: theme.typography.pxToRem(13),
//   },
//   name: {
//     padding: 0,
//     paddingRight: theme.spacing(1),
//     borderCollapse: 'collapse',
//   },
//   value: {
//     textAlign: 'right',
//     borderCollapse: 'collapse',
//     padding: 0,
//   },
//   unit: {
//     borderCollapse: 'collapse',
//     padding: 0,
//     opacity: 0.7,
//   },
//   error: {
//     width: '100%',
//     // fontSize: '300%',
//     display: 'flex',
//     opacity: 0.3,
//     alignItems: 'center',
//     justifyContent: 'center',
//     '& > *': {
//       margin: 0,
//       fontSize: '300%',
//     },
//   },
// }));

type Props = {
  info?: Record<string, unknown>;
  error?: Error | string;
} & PosProps;

type PosProps = {
  x: number;
  y: number;
};

// eslint-disable-next-line react/no-unused-prop-types
type ValueType<T = string | number> = { name?: string; value?: T; index?: number | string };

const Name = styled('td')(({ theme }) => ({
  padding: [0, theme.spacing(1), 0, 0],
  borderCollapse: 'collapse',
}));

const Value = styled('td')({
  textAlign: 'right',
  borderCollapse: 'collapse',
  padding: 0,
});

const Unit = styled('td')({
  borderCollapse: 'collapse',
  padding: 0,
  opacity: 0.7,
});

const Temperature: React.FC<ValueType> = ({ value }) => (
  <tr>
    <Name>
      <Typography variant="body2" sx={{ fontSize: theme => theme.typography.pxToRem(13) }}>
        T
      </Typography>
    </Name>
    <Value>
      <Typography variant="body2">
        <strong>{value}</strong>
      </Typography>
    </Value>
    <Unit>
      <Typography variant="body2">&deg;C</Typography>
    </Unit>
  </tr>
);

const VertexElement: React.FC<ValueType> = ({ name, value, index }) => (
  <tr>
    <Name>
      <Typography variant="body2">
        {name}
        <sub>{index}</sub>
      </Typography>
    </Name>
    <Value>
      <Typography variant="body2">
        <strong>{value}</strong>
      </Typography>
    </Value>
  </tr>
);

const Voltage: React.FC<ValueType> = ({ value, index }) => (
  <tr>
    <Name>
      <Typography variant="body2">
        V<sub>{index}</sub>
      </Typography>
    </Name>
    <Value>
      <Typography variant="body2">
        <strong>{value !== undefined && Number(value) / 1000}</strong>
      </Typography>
    </Value>
    <Unit>
      <Typography variant="body2">В</Typography>
    </Unit>
  </tr>
);

const Vertex: React.FC<ValueType<VertexType>> = ({ name, value }) => (
  <>
    <VertexElement value={value && value.x} index={name} name="X" />
    <VertexElement value={value && value.y} index={name} name="Y" />
  </>
);

const Row: React.FC<ValueType> = ({ value, name }) => {
  const [, title, sub] = name?.match(/([^(]*)(?:\(?(.*)\))?/) ?? [null, name, null];
  return (
    <tr>
      <Name>
        <Typography variant="body2">
          {title}
          <sub>{sub}</sub>
        </Typography>
      </Name>
      <Value>
        <Typography variant="body2">
          <strong>{value}</strong>
        </Typography>
      </Value>
      <Unit>&nbsp;</Unit>
    </tr>
  );
};

type PropRenderType = Record<string, (props: ValueType<unknown>) => React.ReactElement>;

const propMap: PropRenderType = {
  t: ({ value }) => <Temperature value={value as number} />,
  v: ({ value }) => <Voltage value={value as number} />,
  v1: ({ value }) => <Voltage value={value as number} index={1} />,
  v2: ({ value }) => <Voltage value={value as number} index={2} />,
  redVertex: ({ value }) => <Vertex value={value as VertexType} name="R" />,
  greenVertex: ({ value }) => <Vertex value={value as VertexType} name="G" />,
  blueVertex: ({ value }) => <Vertex value={value as VertexType} name="B" />,
  default: ({ value, ...props }) => <Row value={value as string | number | undefined} {...props} />,
};

const Position: React.FC<PosProps> = ({ x, y }) => (
  <Box
    sx={{
      bgcolor: 'grey.100',
      color: 'grey.500',
      flex: 0,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      borderLeftRadius: '5px',
      minWidth: '1.2rem',
      '& > *': {
        padding: '2px',
        textAlign: 'right',
      },
      lineHeight: 1,
    }}
  >
    <Box
      sx={{
        borderBottom: 1,
        borderColor: 'white',
      }}
    >
      <Typography variant="caption" color="inherit">
        <b>{x}</b>
      </Typography>
    </Box>
    <div>
      <Typography variant="caption" color="inherit">
        <b>{y}</b>
      </Typography>
    </div>
  </Box>
);

const ModuleInfo: React.FC<Props> = ({ info, error, x, y }) => (
  <Paper
    sx={{
      // m: 0.5,
      display: 'flex',
      flexDirection: 'row',
      flexShrink: 0,
      height: 1,
    }}
    elevation={1}
  >
    <Position x={x} y={y} />
    {error && (
      <Tooltip title={typeof error === 'string' ? error : error.message} enterDelay={300}>
        <Box
          sx={{
            width: 1,
            display: 'flex',
            opacity: 0.3,
            alignItems: 'center',
            justifyContent: 'center',
            '& > *': {
              m: 0,
              fontSize: '300%',
            },
          }}
        >
          <ErrorIcon />
        </Box>
      </Tooltip>
    )}
    {info && (
      <Box
        component="table"
        sx={{
          flex: 0,
          borderCollapse: 'collapse',
          m: '2px',
        }}
      >
        <tbody>
          {Object.entries(info).map(([name, value]) => {
            const ModuleRow = propMap[name] ?? propMap.default;
            return <ModuleRow key={name} name={name} value={value} />;
          })}
        </tbody>
      </Box>
    )}
  </Paper>
);

// export default compose<Props, Props>(hot, React.memo)(ModuleInfo);
export default ModuleInfo;

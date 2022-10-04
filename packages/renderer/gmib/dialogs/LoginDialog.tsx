import * as React from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from '@mui/material';
import { SRPClientSession, SRPParameters, SRPRoutines } from '@sarakusha/tssrp6a';
import fetchJson, { FetchError } from '/@common/fetchJson';
import { host, port } from '/@common/remote';
import { useDispatch, useSelector } from '../store';
import { selectIsLoggedIn } from '../store/selectors';
import { setLoggedIn } from '../store/currentSlice';

const login = async (password: string) => {
  const routines = new SRPRoutines(new SRPParameters());
  const client = new SRPClientSession(routines);
  const identifier = window.identify.getIdentifier();
  const [first, { salt, B }] = await Promise.all([
    client.step1('gmib', password),
    fetchJson<{ salt: string; B: string }>(
      `http://${host}:${port + 1}/api/handshake/${identifier}`,
      { cache: 'no-cache' },
    ),
  ]);
  const second = await first.step2(BigInt(salt), BigInt(B));
  const { A, M1 } = second;
  const { M2 } = await fetchJson<{ M2: string }>(
    `http://${host}:${port + 1}/api/login/${identifier}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        A: `0x${A.toString(16)}`,
        M1: `0x${M1.toString(16)}`,
      }),
    },
  );
  await second.step3(BigInt(M2));
  return second.S;
};

const LoginDialog: React.FC = () => {
  const isLoggedIn = useSelector(selectIsLoggedIn);
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState<string | undefined>();
  const dispatch = useDispatch();
  const loginHandler: React.FormEventHandler = async e => {
    e.preventDefault();
    try {
      const secret = await login(password);
      window.identify.setSecret(secret);
      dispatch(setLoggedIn(true));
    } catch (err) {
      if (err instanceof FetchError && err.response.status === 401) setError('Неверный пароль');
      else if (err instanceof Error) setError(err.message);
    }
  };
  return (
    <Dialog open={!isLoggedIn} maxWidth="xs" fullWidth>
      <DialogTitle>Подключение к {host}</DialogTitle>
      <DialogContent>
        <form id="pass" onSubmit={loginHandler}>
          <TextField
            label="Пароль"
            name="password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoFocus
            helperText={error}
            error={!!error}
            fullWidth
          />
        </form>
      </DialogContent>
      <DialogActions>
        <Button color="primary" type="submit" variant="contained" form="pass">
          Войти
        </Button>
        <Button onClick={window.close} color="primary">
          Закрыть
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default LoginDialog;

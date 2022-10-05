/* eslint-disable @typescript-eslint/no-empty-function */
import CloseIcon from '@mui/icons-material/Close';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  TextField,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import React, { useEffect, useRef, useState } from 'react';
import type { MouseEvent } from 'react';

import type { CustomHost } from '/@common/helpers';

import FormFieldSet from '../components/FormFieldSet';
import { useSelector } from '../store';
import { selectAllRemoteHosts } from '../store/selectors';
import timeid from '../util/timeid';

import { hasProps } from '@novastar/screen/common';
import IPut from 'iput';

export type RemoteHostsDialogProps = {
  open?: boolean;
  onClose?: () => void;
};

type CustomHostItem = {
  address?: string;
  port?: string;
  id: string;
};

const portProps = {
  inputProps: {
    min: 1,
    max: 65535,
  },
};

const FieldSet = styled(FormFieldSet)(({ theme }) => ({
  minHeight: 100,
  overflowY: 'auto',
  '& ~ &': {
    marginTop: theme.spacing(2),
  },
}));

const Remote = styled('div')(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: '18ch 8ch 20ch 8ch',
  gap: theme.spacing(1),
  padding: theme.spacing(1),
  fontSize: '1rem',
}));

const Header = styled('div')(({ theme }) => ({
  display: 'contents',
  '& > *': {
    color: theme.palette.primary.main,
    // textAlign: 'center',
    fontSize: '0.875rem',
  },
}));

const hasAddressPort = hasProps('address', 'port');

const RemoteHostsDialog: React.FC<RemoteHostsDialogProps> = ({
  open = false,
  onClose = () => {},
}) => {
  const remoteHosts = useSelector(selectAllRemoteHosts);
  const [customHosts, setCustomHosts] = useState<CustomHostItem[]>([]);
  const [changed, setChanged] = useState(false);
  const saveHandler = (): void => {
    const valid = customHosts.filter(hasAddressPort).map(({ address, port }) => ({
      address,
      port: +port,
    }));
    window.config.set('hosts', valid);
    onClose();
  };
  const cancelHandler = onClose;
  // const dispatch = useDispatch();
  useEffect(() => {
    const updateHosts = (hosts: CustomHost[] = []): void => {
      setCustomHosts(
        hosts.map<CustomHostItem>(({ address, port }) => ({
          address,
          port: port.toString(),
          id: timeid(),
        })),
      );
      setChanged(false);
    };
    window.config.get('hosts').then(updateHosts);
  }, [open]);
  const refLast = useRef<HTMLDivElement>(null);

  function makeHandler<T>(
    upd: (arg: T, index: number, customs: CustomHostItem[]) => void,
  ): (id: string) => (arg: T) => void {
    return (id: string) =>
      (arg: T): void => {
        const customs = [...customHosts];
        const index = customs.findIndex(item => item.id === id);
        if (index !== -1) {
          upd(arg, index, customs);
          setCustomHosts(customs);
          setChanged(true);
        }
      };
  }

  const makeAddressHandler = makeHandler((address: string, index, customs) => {
    const host = customs[index];
    host.address = address;
  });
  const makePortHandler = makeHandler((e: React.ChangeEvent<HTMLInputElement>, index, customs) => {
    const host = customs[index];
    host.port = e.target.value;
  });
  const makeCloseHandler = makeHandler((e: MouseEvent, index, customs) => {
    customs.splice(index, 1);
  });
  return (
    <Dialog open={open} aria-labelledby="remote-hosts-title" maxWidth="md">
      <DialogTitle id="remote-hosts-title">Список удаленных хостов</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column' }}>
        <FieldSet legend="Найденные в сети">
          <Remote>
            <Header>
              <div>Адрес</div>
              <div>Порт</div>
              <div>Хост</div>
              <div>Версия</div>
            </Header>
            <Box
              sx={{
                display: 'contents',
                color: 'text.disabled',
              }}
            >
              {remoteHosts.map(({ name, address, port, version }) => (
                <React.Fragment key={name}>
                  <div>{address}</div>
                  <div>{port}</div>
                  <div>{name}</div>
                  <div>{version}</div>
                </React.Fragment>
              ))}
            </Box>
          </Remote>
        </FieldSet>
        <FieldSet legend="Пользовательские">
          <Remote>
            <Header>
              <div>Адрес</div>
              <div>Порт</div>
              <div />
              <div />
            </Header>
            {customHosts &&
              customHosts.map(({ address, port, id }, index) => (
                <React.Fragment key={id}>
                  <IPut
                    defaultValue={address ?? '...'}
                    onChange={makeAddressHandler(id)}
                    css={theme => ({
                      padding: 0,
                      border: 'none',
                      borderRadius: 0,
                      '& input': {
                        borderBottom: '1px solid rgba(0, 0, 0, 0.42)',
                        fontFamily: theme.typography.fontFamily,
                        fontSize: 16,
                        padding: '6px 0',
                        width: '4ch',
                      },
                    })}
                  />
                  <TextField
                    variant="standard"
                    value={port ?? ''}
                    type="number"
                    onChange={makePortHandler(id)}
                    InputProps={portProps}
                  />
                  <Box
                    alignSelf="flex-start"
                    ref={index === customHosts.length - 1 ? refLast : undefined}
                  >
                    <IconButton size="small" title="Удалить" onClick={makeCloseHandler(id)}>
                      <CloseIcon fontSize="inherit" />
                    </IconButton>
                  </Box>
                  <div />
                </React.Fragment>
              ))}
          </Remote>
        </FieldSet>
      </DialogContent>
      <DialogActions sx={{ position: 'relative' }}>
        <Button
          size="small"
          color="primary"
          sx={{
            position: 'absolute',
            left: theme => theme.spacing(3),
            top: theme => theme.spacing(1),
          }}
          onClick={() => {
            setCustomHosts(hosts =>
              hosts.concat({
                id: timeid(),
                port: '9001',
              }),
            );
            refLast.current?.scrollIntoView({ behavior: 'smooth' });
          }}
        >
          Добавить
        </Button>
        <Button
          size="small"
          onClick={saveHandler}
          color="primary"
          type="submit"
          disabled={!changed}
          variant="contained"
        >
          Сохранить
        </Button>
        <Button onClick={cancelHandler} color="primary" size="small">
          Отмена
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default RemoteHostsDialog;

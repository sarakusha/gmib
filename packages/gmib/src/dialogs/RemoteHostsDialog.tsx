/*
 * @license
 * Copyright (c) 2021. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */
import React, { MouseEvent, useEffect, useRef, useState } from 'react';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogTitle from '@material-ui/core/DialogTitle';
import makeStyles from '@material-ui/core/styles/makeStyles';
import Button from '@material-ui/core/Button';
import TextField from '@material-ui/core/TextField';
import IconButton from '@material-ui/core/IconButton';
import CloseIcon from '@material-ui/icons/Close';
import IPut from 'iput';
import FormFieldSet from '../components/FormFieldSet';
import { useSelector } from '../store';
import { selectAllRemoteHosts } from '../store/remoteHostsSlice';
import localConfig, { CustomHost } from '../util/localConfig';
import timeid from '../util/timeid';

const useStyles = makeStyles(theme => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
  },
  remote: {
    display: 'grid',
    gridTemplateColumns: '18ch 8ch 20ch 8ch',
    gap: theme.spacing(1),
    padding: theme.spacing(1),
    fontSize: '1rem',
  },
  header: {
    display: 'contents',
    '& > *': {
      color: theme.palette.primary.main,
      // textAlign: 'center',
      fontSize: '0.875rem',
    },
  },
  fieldSet: {
    // borderRadius: theme.shape.borderRadius,
    // borderColor: 'rgba(0, 0, 0, 0.23)',
    // borderWidth: 1,
    // borderStyle: 'solid',
    minHeight: 100,
    overflowY: 'auto',
    '& ~ $fieldSet': {
      marginTop: theme.spacing(2),
    },
  },
  actions: {
    position: 'relative',
  },
  add: {
    position: 'absolute',
    left: 8 + theme.spacing(2),
    top: 8,
  },
  iput: {
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
  },
  close: {
    alignSelf: 'flex-start',
  },
  found: {
    display: 'contents',
    color: theme.palette.text.disabled,
  },
}));

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

const RemoteHostsDialog: React.FC<RemoteHostsDialogProps> = ({
  open = false,
  onClose = () => {},
}) => {
  const classes = useStyles();
  const remoteHosts = useSelector(selectAllRemoteHosts);
  const [customHosts, setCustomHosts] = useState<CustomHostItem[]>([]);
  const [changed, setChanged] = useState(false);
  const saveHandler = (): void => {
    const valid = customHosts
      .map(({ address, port }) => ({
        address,
        port: port && +port,
      }))
      .filter(({ address, port }) => !!address && !!port);
    localConfig.set('hosts', valid);
    onClose();
  };
  const cancelHandler = onClose;
  // const dispatch = useDispatch();
  useEffect(() => {
    const updateHosts = (hosts: CustomHost[]): void => {
      setCustomHosts(
        hosts.map<CustomHostItem>(({ address, port }) => ({
          address,
          port: port.toString(),
          id: timeid(),
        }))
      );
      setChanged(false);
    };
    updateHosts(localConfig.get('hosts') ?? []);
  }, [open]);
  const refLast = useRef<HTMLDivElement>(null);

  function makeHandler<T>(
    upd: (arg: T, index: number, customs: CustomHostItem[]) => void
  ): (id: string) => (arg: T) => void {
    return (id: string) => (arg: T): void => {
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
      <DialogContent className={classes.root}>
        <FormFieldSet legend="Найденные в сети" className={classes.fieldSet}>
          <div className={classes.remote}>
            <div className={classes.header}>
              <div>Адрес</div>
              <div>Порт</div>
              <div>Хост</div>
              <div>Версия</div>
            </div>
            <div className={classes.found}>
              {remoteHosts.map(({ name, address, port, version }) => (
                <React.Fragment key={name}>
                  <div>{address}</div>
                  <div>{port}</div>
                  <div>{name}</div>
                  <div>{version}</div>
                </React.Fragment>
              ))}
            </div>
          </div>
        </FormFieldSet>
        <FormFieldSet legend="Пользовательские" className={classes.fieldSet}>
          <div className={classes.remote}>
            <div className={classes.header}>
              <div>Адрес</div>
              <div>Порт</div>
              <div />
              <div />
            </div>
            {customHosts &&
              customHosts.map(({ address, port, id }, index) => (
                <React.Fragment key={id}>
                  <IPut
                    defaultValue={address ?? '...'}
                    onChange={makeAddressHandler(id)}
                    className={classes.iput}
                  />
                  <TextField
                    value={port ?? ''}
                    type="number"
                    onChange={makePortHandler(id)}
                    InputProps={portProps}
                  />
                  <div
                    className={classes.close}
                    ref={index === customHosts.length - 1 ? refLast : undefined}
                  >
                    <IconButton size="small" title="Удалить" onClick={makeCloseHandler(id)}>
                      <CloseIcon fontSize="inherit" />
                    </IconButton>
                  </div>
                  <div />
                </React.Fragment>
              ))}
          </div>
        </FormFieldSet>
      </DialogContent>
      <DialogActions className={classes.actions}>
        <Button
          size="small"
          color="primary"
          className={classes.add}
          onClick={() => {
            setCustomHosts(hosts =>
              hosts.concat({
                id: timeid(),
                port: '9001',
              })
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

/*
 * @license
 * Copyright (c) 2020. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */
import Button from '@material-ui/core/Button';
import Checkbox from '@material-ui/core/Checkbox';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogTitle from '@material-ui/core/DialogTitle';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import FormGroup from '@material-ui/core/FormGroup';
import { makeStyles } from '@material-ui/core/styles';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import FormFieldSet from '../components/FormFieldSet';
import { initialSelectors, Minihost3Selector } from '../util/Minihost3Loader';

type Props = {
  open?: boolean;
  initial?: Set<Minihost3Selector>;
  onClose?: (value: Set<Minihost3Selector>) => void;
};

const useStyles = makeStyles(theme => ({
  root: {
    display: 'flex',
  },
  formControl: {
    margin: theme.spacing(3),
  },
}));

const Minihost3SelectorDialog: React.FC<Props> = ({
  open = false,
  initial = new Set(initialSelectors),
  onClose,
}) => {
  const classes = useStyles();
  const [selector, setSelector] = useState<Set<Minihost3Selector>>(initial);
  const refInitial = useRef(initial);
  refInitial.current = initial;
  useEffect(() => {
    setSelector(refInitial.current);
  }, [open]);
  const handleChange = useCallback<React.ChangeEventHandler<HTMLInputElement>>(e => {
    const { checked, name } = e.target;
    if (checked) {
      setSelector(prev => {
        const result = new Set(prev);
        result.add(Minihost3Selector[name]);
        return result;
      });
    } else {
      setSelector(prev => {
        const result = new Set(prev);
        result.delete(Minihost3Selector[name]);
        return result;
      });
    }
  }, []);
  const closeHandler = useCallback(() => onClose && onClose(refInitial.current), [onClose]);
  const saveHandler = useCallback(
    () =>
      onClose &&
      setSelector(current => {
        onClose(current);
        return current;
      }),
    [onClose]
  );
  return (
    <Dialog open={open} aria-labelledby="selector-title">
      <DialogTitle id="selector-title">Выбор переменных для опроса</DialogTitle>
      <DialogContent>
        <div className={classes.root}>
          <FormFieldSet className={classes.formControl} legend="Доступные переменные">
            <FormGroup>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={selector.has(Minihost3Selector.Temperature)}
                    onChange={handleChange}
                    name="Temperature"
                  />
                }
                label="Температура"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={selector.has(Minihost3Selector.Voltage1)}
                    onChange={handleChange}
                    name="Voltage1"
                  />
                }
                label="Напряжение 1"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={selector.has(Minihost3Selector.Voltage2)}
                    onChange={handleChange}
                    name="Voltage2"
                  />
                }
                label="Напряжение 2"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={selector.has(Minihost3Selector.Version)}
                    onChange={handleChange}
                    name="Version"
                  />
                }
                label="Версия"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={selector.has(Minihost3Selector.RedVertex)}
                    onChange={handleChange}
                    name="RedVertex"
                  />
                }
                label="Красная вершина"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={selector.has(Minihost3Selector.GreenVertex)}
                    onChange={handleChange}
                    name="GreenVertex"
                  />
                }
                label="Зеленая вершина"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={selector.has(Minihost3Selector.BlueVertex)}
                    onChange={handleChange}
                    name="BlueVertex"
                  />
                }
                label="Голубая вершина"
              />
            </FormGroup>
          </FormFieldSet>
        </div>
      </DialogContent>
      <DialogActions>
        <Button color="primary" type="submit" onClick={saveHandler} disabled={!selector.size}>
          Сохранить
        </Button>
        <Button onClick={closeHandler} color="primary">
          Отмена
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default Minihost3SelectorDialog;

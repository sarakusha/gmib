/*
 * @license
 * Copyright (c) 2021. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

import {
  useState,
  useCallback,
  FormEventHandler,
  DependencyList,
  Dispatch,
  SetStateAction,
  ChangeEventHandler,
  MouseEvent,
  useRef,
  useEffect,
} from 'react';

export type ChangeInputHandler = ChangeEventHandler<HTMLInputElement>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RequiredInputs<T> = { [K in keyof T]?: true };
type Inputs<T> = {
  inputs: T;
  handleInputChange: ChangeInputHandler;
  handleSubmit: FormEventHandler;
  reset: (e?: MouseEvent) => void;
  setInputs: Dispatch<SetStateAction<T>>;
  required: RequiredInputs<T>;
  changed: boolean;
};

type InputsOptions<T> = {
  trueValue?: unknown;
  falseValue?: unknown;
  readonly required?: (keyof T)[];
  deps?: DependencyList;
  autoUpdate?: boolean;
};

function updateRequired<T>(inputs: T, required: (keyof T)[] = []): RequiredInputs<T> {
  return required.reduce<RequiredInputs<T>>(
    (res, key) =>
      `${inputs[key]}`.trim().length === 0
        ? {
            ...res,
            [key]: true,
          }
        : res,
    {}
  );
}

function defaults<T>(value: T): T {
  return Object.fromEntries(Object.entries(value).map(([key, val]) => [key, val ?? ''])) as T;
}

export default function useInputs<T>(
  initialState: T,
  submit: (inputs: T) => Promise<unknown> = (): Promise<void> => Promise.resolve(),
  { deps = [], trueValue = true, falseValue = false, required = [] }: InputsOptions<T> = {}
): Inputs<T> {
  const initial = defaults(initialState);
  const refInitial = useRef(initial);
  refInitial.current = initial;
  const [changed, setChanged] = useState(false);
  // Используется после submit и может быть размонтирована к этому моменту,
  // поэтому нельзя запускать setChanged
  const safeSetChanged = useRef(setChanged);
  useEffect(
    () => () => {
      safeSetChanged.current = () => {};
    },
    []
  );
  const [inputs, setInputs] = useState<T>(initial);
  const [requiredInputs, setRequiredInputs] = useState<RequiredInputs<T>>({});
  const handleInputChange = useCallback<ChangeInputHandler>(
    e => {
      const { name, value, checked, type, readOnly } = e.target;
      if (readOnly) return;
      setChanged(true);
      const [key, val] =
        type === 'checkbox' ? [value, checked ? trueValue : falseValue] : [name, value];
      setInputs(prev => ({
        ...prev,
        [key]: val,
      }));

      if (required.includes(key as keyof T)) {
        setRequiredInputs(prev => ({
          ...prev,
          [key]: value.trim().length === 0,
        }));
      }
    },
    [setInputs, trueValue, falseValue, required]
  );
  const handleSubmit = useCallback<FormEventHandler>(
    e => {
      e.preventDefault();
      setInputs(current => {
        const req = updateRequired(current, required);
        setRequiredInputs(req);
        if (Object.keys(req).length === 0) {
          submit({ ...current })
            .then(() => safeSetChanged.current(false))
            .catch(() => {});
        }
        return current;
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setInputs, submit, ...deps]
  );
  const reset = useCallback(
    (e?: MouseEvent) => {
      e && e.preventDefault && e.preventDefault();
      setInputs(refInitial.current);
      setChanged(false);
    },
    [setInputs]
  );
  return {
    inputs,
    handleInputChange,
    handleSubmit,
    setInputs,
    required: requiredInputs,
    changed,
    reset,
  };
}

/*
 * @license
 * Copyright (c) 2019. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nata" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */
import React, { createContext, useContext, useState } from 'react';
import { tuplify } from './helpers';

type ToolbarElement = React.ReactNode;

const ToolbarContext = createContext({
  toolbar: null as ToolbarElement,
  setToolbar: (() => {}) as (toolbar: ToolbarElement) => void,
});

export const useToolbar = () => {
  const { toolbar, setToolbar } = useContext(ToolbarContext);
  return tuplify(toolbar, setToolbar);
};

const ToolbarProvider: React.FC<{}> = ({ children }) => {
  const [toolbar, setToolbar] = useState<ToolbarElement>(null);
  return (
    <ToolbarContext.Provider
      value={{
        toolbar,
        setToolbar,
      }}
    >
      {children}
    </ToolbarContext.Provider>
  );
};

export default ToolbarProvider;

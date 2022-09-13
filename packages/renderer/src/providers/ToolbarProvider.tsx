import React, { createContext, useContext, useMemo, useState } from 'react';

import { tuplify } from '/@common/helpers';

type ToolbarElement = React.ReactNode;

const ToolbarContext = createContext({
  toolbar: null as ToolbarElement,
  setToolbar: (() => {}) as (toolbar: ToolbarElement) => void,
});

export const useToolbar = (): [ToolbarElement, (toolbar: ToolbarElement) => void] => {
  const { toolbar, setToolbar } = useContext(ToolbarContext);
  return tuplify(toolbar, setToolbar);
};

const ToolbarProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [toolbar, setToolbar] = useState<ToolbarElement>(null);
  const value = useMemo(() => ({ toolbar, setToolbar }), [toolbar]);
  return <ToolbarContext.Provider value={value}>{children}</ToolbarContext.Provider>;
};

export default ToolbarProvider;

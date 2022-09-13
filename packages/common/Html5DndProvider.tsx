import React from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';

/*
  workaround:
  react-dnd-html5-backend/nativetypes redefines global URL!
*/
const Html5DndProvider: React.FC<React.PropsWithChildren> = ({ children }) => (
  <DndProvider backend={HTML5Backend}>{children}</DndProvider>
);

export default Html5DndProvider;

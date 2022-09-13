import type React from 'react';
import { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';

const Portal: React.FC<React.PropsWithChildren> = ({ children }) => {
  const mount = document.getElementById('portal-root');
  const el = useMemo(() => document.createElement('div'), []);

  useEffect(() => {
    mount?.appendChild(el);
    return () => {
      mount?.removeChild(el);
    };
  }, [el, mount]);

  return createPortal(children, el);
};

export default Portal;

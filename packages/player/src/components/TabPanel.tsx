import { getPanelId, getTabId, useTabContext } from '@mui/lab/TabContext';
import * as React from 'react';

const TabPanel = React.forwardRef<
  HTMLDivElement,
  React.PropsWithChildren<{ className?: string; value: string; dense?: true }>
>(({ children, className, value, dense }, ref) => {
  const context = useTabContext();
  if (context === null) {
    throw new TypeError('No TabContext provided');
  }
  const id = getPanelId(context, value);
  const tabId = getTabId(context, value);
  const hidden = value !== context.value;
  return (
    <div
      ref={ref}
      aria-labelledby={tabId}
      id={id}
      role="tabpanel"
      className={className}
      css={theme => ({
        visibility: hidden ? 'collapse' : 'visible',
        height: '100%',
        ...(!dense && { padding: theme.spacing(2) }),
      })}
      hidden={hidden}
    >
      {children}
    </div>
  );
});

export default TabPanel;

import React from 'react';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DoneIcon from '@mui/icons-material/Done';
import IconButton, { type IconButtonProps } from '@mui/material/IconButton';
import { useFormikContext } from 'formik';

type Props = Omit<
  IconButtonProps & {
    className?: string;
    text?: string;
    name?: string;
  },
  'onClick'
>;

const CopyToClipboard = React.forwardRef<HTMLButtonElement, Props>(
  ({ text, name, className, ...props }, ref) => {
    const { values } = useFormikContext<Record<string, string>>();
    const copy = name && name in values ? values[name] : text;
    const [copied, setCopied] = React.useState(false);
    const handleCopyClick = () =>
      copy && navigator.clipboard.writeText(copy).then(() => setCopied(true));

    React.useEffect(() => {
      setCopied(false);
    }, [copy]);
    React.useEffect(() => {
      let timeout = 0;
      if (copied) {
        timeout = window.setTimeout(() => setCopied(false), 500);
      }
      return () => window.clearTimeout(timeout);
    }, [copied]);
    return (
      <IconButton
        className={className}
        {...props}
        ref={ref}
        onClick={handleCopyClick}
        disabled={copied}
        size="small"
        title="Скопировать в буфер обмена"
      >
        {copied ? (
          <DoneIcon fontSize="inherit" color="success" />
        ) : (
          <ContentCopyIcon fontSize="inherit" />
        )}
      </IconButton>
    );
  },
);

CopyToClipboard.displayName = 'CopyToClipboard';

export default CopyToClipboard;

import { Typography } from '@mui/material';
import Box from '@mui/material/Box';
import type { ErrorInfo } from 'react';
import React from 'react';

type State = {
  error?: Error;
  errorInfo?: ErrorInfo;
};

type Props = Record<string, unknown>;

export default class ErrorBoundary extends React.PureComponent<
  React.PropsWithChildren<Props>,
  State
> {
  constructor(props: Props) {
    super(props);
    this.state = {};
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // You can also log the error to an error reporting service
    this.setState({ error, errorInfo });
  }

  render() {
    const {
      props: { children },
      state: { error, errorInfo },
    } = this;
    if (errorInfo) {
      // Error path
      return (
        <div>
          <Typography variant="h5">Something went wrong.</Typography>
          <Box component="details" sx={{ whiteSpace: 'pre-wrap' }}>
            {error && error.toString()}
            <br />
            {errorInfo.componentStack}
          </Box>
        </div>
      );
    }
    // Normally, just render children
    return children;
  }
}

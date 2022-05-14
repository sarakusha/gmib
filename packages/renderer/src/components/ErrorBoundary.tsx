import type { ErrorInfo, ReactNode } from 'react';
import React from 'react';

type State = {
  error?: Error;
  errorInfo?: ErrorInfo;
};

type Props = Record<string, unknown>;

export default class ErrorBoundary extends React.PureComponent<Props, State> {
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

  render(): ReactNode {
    const {
      props: { children, value },
      state: { error, errorInfo },
    } = this;
    if (errorInfo) {
      // Error path
      return (
        <div>
          <h2>Something went wrong.</h2>
          <details style={{ whiteSpace: 'pre-wrap' }}>
            {error && error.toString()}
            <br />
            {value && `${value}`}
            <br />
            {errorInfo.componentStack}
          </details>
        </div>
      );
    }
    // Normally, just render children
    return children;
  }
}

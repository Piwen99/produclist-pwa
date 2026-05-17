import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ErrorFallback } from './ErrorFallback';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, info: ErrorInfo) => void;
  resetKeys?: unknown[];
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ErrorBoundary] Caught an error:', error);
    this.props.onError?.(error, info);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    if (this.state.error === null) return;
    if (this.props.resetKeys === undefined) return;

    // Reset when any resetKey changes
    if (prevProps.resetKeys !== undefined) {
      const changed = this.props.resetKeys.some(
        (key, i) => key !== prevProps.resetKeys![i],
      );
      if (changed) this.resetBoundary();
    }
  }

  resetBoundary = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    if (this.state.error !== null) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <ErrorFallback
          error={this.state.error}
          resetErrorBoundary={this.resetBoundary}
        />
      );
    }

    return this.props.children;
  }
}

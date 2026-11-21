import { Component, type ReactNode } from 'react';

type Props = {
  bundleId: string;
  onError: (bundleId: string) => void;
  children: ReactNode;
};

type State = {
  hasError: boolean;
};

/**
 * Error boundary living inside the R3F Canvas.
 * Renders `null` on failure because DOM elements cannot mount inside the Three.js tree.
 */
export class BundleErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(): void {
    this.props.onError(this.props.bundleId);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return null;
    }
    return this.props.children;
  }
}

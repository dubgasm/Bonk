import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  onClose: () => void;
}

interface State {
  errored: boolean;
}

export default class AuditionErrorBoundary extends Component<Props, State> {
  state: State = { errored: false };

  static getDerivedStateFromError(): State {
    return { errored: true };
  }

  componentDidCatch(err: unknown) {
    console.error('[AuditionErrorBoundary]', err);
  }

  render() {
    if (this.state.errored) {
      return (
        <div
          className="audition-error-fallback"
          onClick={(e) => e.stopPropagation()}
        >
          <span>Couldn&apos;t load player</span>
          <button type="button" className="audition-error-close" onClick={this.props.onClose}>
            ×
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

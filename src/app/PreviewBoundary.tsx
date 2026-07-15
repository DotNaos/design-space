import { Component, type ErrorInfo, type ReactNode } from "react";

type PreviewBoundaryProps = { children: ReactNode; resetKey: string };
type PreviewBoundaryState = { error?: Error };

export class PreviewBoundary extends Component<PreviewBoundaryProps, PreviewBoundaryState> {
  state: PreviewBoundaryState = {};

  static getDerivedStateFromError(error: Error): PreviewBoundaryState {
    return { error };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    // The local preview remains mounted so a subsequent valid edit can recover it.
  }

  componentDidUpdate(previous: PreviewBoundaryProps) {
    if (previous.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: undefined });
  }

  render() {
    if (this.state.error) {
      return (
        <div className="grid min-h-80 place-items-center rounded-2xl border border-rose-400/30 bg-rose-400/5 p-8 text-center">
          <div><p className="text-sm font-medium text-rose-300">Preview could not compile</p><p className="mt-2 text-xs text-zinc-500">Correct the class edit or Reset to recover.</p></div>
        </div>
      );
    }
    return this.props.children;
  }
}

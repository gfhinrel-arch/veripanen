import { Component } from "react";
import { Warning } from "@phosphor-icons/react";

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("[VeriPanen] render error:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-4 px-4 py-16 md:px-8 lg:px-12">
          <div className="flex items-center gap-2 text-rust-600">
            <Warning size={20} weight="fill" />
            <h1 className="text-[16px] font-semibold tracking-tight">Something broke on this page</h1>
          </div>
          <pre className="max-w-full overflow-auto rounded-xl border border-rust-600/25 bg-rust-100 px-4 py-3 font-mono text-[12px] leading-relaxed text-rust-600">
            {this.state.error?.message || String(this.state.error)}
          </pre>
          <button
            onClick={() => {
              this.setState({ error: null });
              window.location.reload();
            }}
            className="w-fit rounded-full bg-ink-950 px-5 py-2.5 text-[13px] font-medium text-white"
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

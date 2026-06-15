'use client';

import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

export class SimulatorBoundary extends React.Component<Props, State> {
  public state: State = { error: null };

  public static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ScreenSimulator render error caught:', error, errorInfo);
  }

  public render() {
    if (this.state.error) {
      return (
        <div className="flex-1 w-full h-full min-h-[300px] flex flex-col items-center justify-center bg-surface-0 border border-white/5 rounded-2xl p-6 select-none shadow-[0_4px_24px_rgba(0,0,0,0.5)]">
          <div className="text-rose-300/85 text-sm font-semibold mb-2">
            预览渲染失败
          </div>
          <div className="text-white/50 text-xs max-w-md text-center break-all leading-relaxed">
            {this.state.error.message || '出现未知渲染异常'}
          </div>
          <button 
            onClick={() => this.setState({ error: null })}
            className="mt-4 px-3.5 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white rounded-lg text-sm font-medium transition-all duration-200"
          >
            重新载入预览
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

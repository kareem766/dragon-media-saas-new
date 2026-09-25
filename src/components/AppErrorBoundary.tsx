import React from 'react'

interface Props { children: React.ReactNode }
interface State { hasError: boolean; message: string | null }

export default class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, message: null }

  static getDerivedStateFromError(error: unknown): State {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : null,
    }
  }

  componentDidCatch(error: unknown) {
    if (import.meta.env.DEV) console.error('[Dragon Media] UI error:', error)
  }

  handleRetry = () => {
    this.setState({ hasError: false, message: null })
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div dir="rtl" className="min-h-screen flex items-center justify-center bg-sand-50 p-6">
        <div className="w-full max-w-md rounded-3xl border border-blue-100 bg-white p-7 text-center shadow-[0_20px_60px_rgba(15,47,107,0.08)]">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-2xl">!</div>
          <h1 className="text-xl font-black text-ink-950">حدث خطأ غير متوقع</h1>
          <p className="mt-2 text-sm leading-7 text-ink-900/60">حدثت مشكلة في هذه الصفحة. يمكنك إعادة المحاولة بدون إعادة تحميل المنصة أو تسجيل الخروج.</p>
          <button type="button" onClick={this.handleRetry} className="mt-6 inline-flex items-center justify-center rounded-xl bg-ink-950 px-5 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-ink-800">إعادة المحاولة</button>
          {this.state.message && import.meta.env.DEV ? <p className="mt-4 break-words text-xs text-red-600">{this.state.message}</p> : null}
        </div>
      </div>
    )
  }
}

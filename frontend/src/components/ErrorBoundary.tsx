import { Component, ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 p-8">
          <div className="max-w-lg rounded-xl border border-red-200 bg-white p-6 shadow-sm">
            <h1 className="mb-2 text-lg font-semibold text-red-700">Something went wrong</h1>
            <pre className="overflow-auto rounded bg-red-50 p-3 text-xs text-red-800">
              {this.state.error.message}
            </pre>
            <button
              className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
              onClick={() => window.location.reload()}
            >
              Reload page
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

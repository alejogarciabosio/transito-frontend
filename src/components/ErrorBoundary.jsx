import { Component } from "react";

// Si algo se rompe al dibujar la app, en lugar de dejar la página en blanco se muestra este aviso.
export default class ErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, info) {
    console.error("Error de la aplicación:", error, info?.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 px-6 text-center">
        <h1 className="text-2xl font-bold text-slate-900">Algo salió mal</h1>
        <p className="max-w-md text-sm text-slate-600">
          La pantalla tuvo un problema inesperado. Recargá la página; si sigue pasando, comunicate con la Línea Municipal 147.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
        >
          Recargar
        </button>
      </div>
    );
  }
}

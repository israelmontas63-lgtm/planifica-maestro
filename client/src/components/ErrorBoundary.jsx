import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleLimpiarCache = async () => {
    try {
      if (typeof window !== 'undefined') {
        if ('serviceWorker' in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          for (const reg of registrations) {
            await reg.unregister();
          }
        }
        if ('caches' in window) {
          const cacheKeys = await caches.keys();
          for (const key of cacheKeys) {
            await caches.delete(key);
          }
        }
        sessionStorage.clear();
      }
    } catch (e) {
      console.warn('Error al limpiar cache:', e);
    }
    const destino = window.location.origin;
    window.location.replace(destino);
  };

  render() {
    if (this.state.hasError) {
      const mensajeError = this.state.error?.message || String(this.state.error || 'Error desconocido');
      const stackError = this.state.error?.stack || '';

      return (
        <div style={{
          minHeight: '100dvh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          background: '#f8fafc',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
          boxSizing: 'border-box'
        }}>
          <div style={{
            maxWidth: '380px',
            width: '100%',
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '16px',
            padding: '24px 20px',
            textAlign: 'center',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05)'
          }}>
            <div style={{
              width: '56px',
              height: '56px',
              margin: '0 auto 14px auto',
              borderRadius: '50%',
              background: '#fef3c7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '26px'
            }}>
              ⚠️
            </div>

            <h2 style={{ fontSize: '17px', fontWeight: '700', color: '#0f172a', margin: '0 0 6px 0' }}>
              Algo no cargó correctamente
            </h2>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 18px 0', lineHeight: '1.45' }}>
              Suele ocurrir si tu teléfono tiene guardada una versión anterior de la app en memoria caché.
            </p>

            <button
              type='button'
              onClick={this.handleLimpiarCache}
              style={{
                width: '100%',
                padding: '11px 16px',
                background: '#0d9488',
                color: '#ffffff',
                border: 'none',
                borderRadius: '10px',
                fontWeight: '600',
                fontSize: '13px',
                cursor: 'pointer',
                marginBottom: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                boxShadow: '0 2px 4px rgba(13, 148, 136, 0.2)'
              }}
            >
              <span>🧹</span>
              <span>Limpiar caché y actualizar PWA</span>
            </button>

            <button
              type='button'
              onClick={() => window.location.reload()}
              style={{
                width: '100%',
                padding: '10px 16px',
                background: '#f1f5f9',
                color: '#334155',
                border: '1px solid #cbd5e1',
                borderRadius: '10px',
                fontWeight: '500',
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              🔄 Recargar
            </button>

            <details style={{ marginTop: '16px', textAlign: 'left', borderTop: '1px solid #f1f5f9', paddingTop: '12px' }}>
              <summary style={{ fontSize: '11.5px', fontWeight: '600', color: '#0d9488', cursor: 'pointer', outline: 'none' }}>
                🔍 Ver detalles técnicos
              </summary>
              <div style={{
                marginTop: '8px',
                padding: '8px 10px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '11px',
                color: '#334155',
                fontFamily: 'monospace',
                wordBreak: 'break-all',
                maxHeight: '180px',
                overflowY: 'auto'
              }}>
                <div style={{ color: '#dc2626', fontWeight: 'bold' }}>Error: {mensajeError}</div>
                <div style={{ marginTop: '4px' }}><strong>Versión:</strong> {typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'v1.0.0'}</div>
                <div style={{ marginTop: '4px' }}><strong>Navegador:</strong> {typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A'}</div>
                {stackError && (
                  <div style={{ marginTop: '6px' }}>
                    <strong>Stack:</strong>
                    <pre style={{ margin: '2px 0 0 0', fontSize: '10px', color: '#64748b', whiteSpace: 'pre-wrap' }}>
                      {stackError.split('\n').slice(0, 4).join('\n')}
                    </pre>
                  </div>
                )}
                {this.state.errorInfo?.componentStack && (
                  <div style={{ marginTop: '6px' }}>
                    <strong>Component Stack:</strong>
                    <pre style={{ margin: '2px 0 0 0', fontSize: '10px', color: '#64748b', whiteSpace: 'pre-wrap' }}>
                      {this.state.errorInfo.componentStack.split('\n').slice(0, 3).join('\n')}
                    </pre>
                  </div>
                )}
              </div>
            </details>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;

import React from 'react';
import { AlertTriangle, Copy, RotateCcw } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Mantém o diagnóstico no console para desenvolvimento e suporte técnico.
    // A tela apresentada ao usuário não expõe stack traces.
    console.error('[Companheiro Emoto] Falha de renderização:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleCopyDiagnostics = async () => {
    const error = this.state.error;
    const diagnostics = [
      'Companheiro Emoto — diagnóstico de interface',
      `Data: ${new Date().toISOString()}`,
      `Erro: ${error?.message || 'Erro desconhecido'}`,
      `URL: ${window.location.href}`,
    ].join('\n');

    try {
      await navigator.clipboard.writeText(diagnostics);
      this.setState({ copied: true });
      window.setTimeout(() => this.setState({ copied: false }), 1800);
    } catch (copyError) {
      console.warn('[Companheiro Emoto] Não foi possível copiar o diagnóstico:', copyError);
    }
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="app-error-screen" role="alert">
        <div className="app-error-panel">
          <div className="app-error-icon"><AlertTriangle size={28} /></div>
          <div className="app-error-eyebrow">EMOTO · RECUPERAÇÃO DE SISTEMA</div>
          <h1 className="app-error-title">Esta tela encontrou um problema</h1>
          <p className="app-error-text">
            O aplicativo continua protegido, mas esta parte não pôde ser exibida.
            Tente recarregar a tela. Se o problema continuar, copie o diagnóstico e envie-o ao responsável pelo projeto.
          </p>
          <div className="app-error-actions">
            <button type="button" className="app-error-primary" onClick={this.handleReload}>
              <RotateCcw size={14} /> Recarregar aplicativo
            </button>
            <button type="button" className="app-error-secondary" onClick={this.handleCopyDiagnostics}>
              <Copy size={14} /> {this.state.copied ? 'Diagnóstico copiado' : 'Copiar diagnóstico'}
            </button>
          </div>
        </div>
      </div>
    );
  }
}

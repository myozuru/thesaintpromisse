import { Component, type ReactNode } from "react";

interface State {
  error: Error | null;
  info: string | null;
}

/**
 * Boundary global de último recurso. Sem ele, qualquer throw na hidratação
 * (zustand/persist, leitura de localStorage etc.) deixa a tela preta.
 *
 * Renderiza a mensagem do erro + stack na própria tela com tema dark, para
 * facilitar diagnóstico em produção (sem precisar abrir DevTools).
 */
export class AppErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null, info: null };

  static getDerivedStateFromError(error: Error): State {
    return { error, info: null };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error("[AppErrorBoundary] Erro fatal:", error, info);
    this.setState({ error, info: info.componentStack });
  }

  private handleReset = () => {
    try {
      Object.keys(window.localStorage).forEach((k) => {
        if (k.endsWith("-storage") || k.endsWith("-store")) {
          window.localStorage.removeItem(k);
        }
      });
    } catch {
      /* noop */
    }
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#0a0a0f",
          color: "#f5f5f7",
          padding: "32px",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          fontSize: 13,
          lineHeight: 1.5,
        }}
      >
        <h1 style={{ fontSize: 20, marginBottom: 12, color: "#ff6b6b" }}>
          Falha ao carregar a aplicação
        </h1>
        <p style={{ marginBottom: 16, color: "#c9c9d1" }}>
          Um erro ocorreu durante a inicialização. Tente recarregar a página.
          Se o problema persistir, use o botão abaixo para limpar o cache local
          (suas fichas salvas no servidor não serão afetadas — apenas o estado
          local da sessão).
        </p>
        <pre
          style={{
            background: "#16161e",
            border: "1px solid #2a2a36",
            borderRadius: 8,
            padding: 16,
            overflow: "auto",
            color: "#ffb4b4",
            whiteSpace: "pre-wrap",
            marginBottom: 16,
          }}
        >
          {this.state.error.name}: {this.state.error.message}
          {"\n\n"}
          {this.state.error.stack}
        </pre>
        {this.state.info && (
          <pre
            style={{
              background: "#16161e",
              border: "1px solid #2a2a36",
              borderRadius: 8,
              padding: 16,
              overflow: "auto",
              color: "#8b8b96",
              whiteSpace: "pre-wrap",
              marginBottom: 16,
            }}
          >
            {this.state.info}
          </pre>
        )}
        <div style={{ display: "flex", gap: 12 }}>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: "10px 18px",
              borderRadius: 8,
              border: "1px solid #3a3a48",
              background: "#1f1f2a",
              color: "#f5f5f7",
              cursor: "pointer",
            }}
          >
            Recarregar
          </button>
          <button
            onClick={this.handleReset}
            style={{
              padding: "10px 18px",
              borderRadius: 8,
              border: "1px solid #ff6b6b",
              background: "#3a1a1f",
              color: "#ffb4b4",
              cursor: "pointer",
            }}
          >
            Limpar cache local e recarregar
          </button>
        </div>
      </div>
    );
  }
}

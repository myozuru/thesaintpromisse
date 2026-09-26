import { defineConfig } from "vitest/config";
import path from "node:path";

// Configuração dedicada aos testes: ambiente de navegador simulado e
// setup que desliga a bandeja de dados 3D (rolagens resolvem na hora).
export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    setupFiles: ["./src/test/setup.node.ts"],
    // Ruído conhecido do ambiente jsdom (conexão interna do próprio Vitest), não do app.
    onUnhandledError(error) {
      if ((error as { code?: string }).code === "ERR_INVALID_ARG_TYPE" && String(error.message).includes('"event" argument')) return false;
    },
  },
});

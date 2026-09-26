import { defineConfig } from "vitest/config";
import path from "node:path";

// Configuração dedicada aos testes: ambiente de navegador simulado e
// setup que desliga a bandeja de dados 3D (rolagens resolvem na hora).
export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
  },
});

import "@testing-library/jest-dom";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

// Desabilita a bandeja 3D em testes: rolagens resolvem via RNG instantaneamente.
import { useDice3DStore } from "@/stores/useDice3DStore";
useDice3DStore.setState({ enabled: false });

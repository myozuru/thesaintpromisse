import { parseOmniScript, tokenizarOmniScript, type OmniScriptParseOpts } from './omniScript';

// Somente compilação pura: este módulo não importa stores, mapa ou clientes de nuvem.
self.onmessage = (evento: MessageEvent<{ id: number; texto: string; alvo?: OmniScriptParseOpts['defaultTarget'] }>) => {
  const { id, texto, alvo } = evento.data;
  try {
    self.postMessage({ id, texto, alvo, compilado: parseOmniScript(texto, { defaultTarget: alvo }), tokens: tokenizarOmniScript(texto) });
  } catch {
    self.postMessage({ id, erro: true });
  }
};

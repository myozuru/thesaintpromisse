import type { AcaoAtivaConfig } from './tipos';

const STORAGE_KEY = 'omni:presets-acoes-ativas:v1';

export interface PresetAcaoAtiva {
  id: string;
  nome: string;
  acao: AcaoAtivaConfig;
}

function novoId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function copiarAcaoAtiva(acao: AcaoAtivaConfig, nome = `${acao.nome} (cópia)`): AcaoAtivaConfig {
  return { ...structuredClone(acao), id: novoId(), nome };
}

export function lerPresetsAcoesAtivas(): PresetAcaoAtiva[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is PresetAcaoAtiva =>
      !!item && typeof item === 'object' &&
      typeof item.id === 'string' && typeof item.nome === 'string' &&
      !!item.acao && typeof item.acao === 'object' &&
      typeof item.acao.nome === 'string' && typeof item.acao.id === 'string',
    );
  } catch {
    return [];
  }
}

export function salvarPresetAcaoAtiva(presets: PresetAcaoAtiva[], acao: AcaoAtivaConfig, nome: string): PresetAcaoAtiva[] {
  const titulo = nome.trim();
  if (!titulo) return presets;
  const preset = { id: novoId(), nome: titulo, acao: structuredClone(acao) };
  const atualizados = [...presets, preset];
  if (typeof window !== 'undefined') {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(atualizados)); } catch { /* armazenamento indisponível */ }
  }
  return atualizados;
}

export function removerPresetAcaoAtiva(presets: PresetAcaoAtiva[], id: string): PresetAcaoAtiva[] {
  const atualizados = presets.filter(preset => preset.id !== id);
  if (typeof window !== 'undefined') {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(atualizados)); } catch { /* armazenamento indisponível */ }
  }
  return atualizados;
}

export function criarAcaoDePreset(preset: PresetAcaoAtiva): AcaoAtivaConfig {
  return copiarAcaoAtiva(preset.acao, preset.acao.nome);
}

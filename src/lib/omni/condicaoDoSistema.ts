import { ALL_CONDITIONS } from '@/types/conditions';
const normalizar = (s: string) => s.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
/** Nomes e IDs convergem; o alias legado Sangrando mantém a mecânica de Sangramento. */
export function resolverCondicaoOmni(nome: string) {
  const key = normalizar(nome);
  const canonico = key === 'sangrando' ? 'sangramento' : key;
  return ALL_CONDITIONS.find(c => normalizar(c.id) === canonico || normalizar(c.name) === canonico);
}

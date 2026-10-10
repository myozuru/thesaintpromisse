/** Sistema de Conquistas: tipos, raridades e catálogo padrão da campanha. */
export type RaridadeConquista = 'comum' | 'raro' | 'epico' | 'lendario' | 'impossivel';

/** Gatilhos automáticos conhecidos; 'manual' = só o Mestre concede. */
export type GatilhoConquista = 'manual' | 'primeiro_combate' | 'loja_comida' | 'portas_da_morte';

export type RecompensaConquista =
  | { tipo: 'dinheiro'; valor: number; currencyId: string }
  | { tipo: 'item'; entidadeId: string; quantidade: number }
  | { tipo: 'titulo'; texto: string }
  | { tipo: 'texto'; texto: string };

export interface ConquistaDef {
  id: string;
  titulo: string;
  descricao: string;
  /** Como conseguir (dica visível quando não é secreta). */
  requisito: string;
  icone: string;
  raridade: RaridadeConquista;
  secreta: boolean;
  gatilho: GatilhoConquista;
  recompensas: RecompensaConquista[];
  updatedAt: number;
  deletedAt?: number;
}

export interface Desbloqueio {
  charId: string;
  conquistaId: string;
  em: number;
  relato?: string;
  concedidaPor: 'auto' | 'mestre';
  recompensasEntregues: boolean;
  updatedAt: number;
  /** Revogada pelo Mestre (mantém o registro para a mescla). */
  deletedAt?: number;
}

export const RARIDADES: RaridadeConquista[] = ['comum', 'raro', 'epico', 'lendario', 'impossivel'];

export const RARIDADE_INFO: Record<RaridadeConquista, { nome: string; cabecalho: string; mensagem: string; pontos: number }> = {
  comum: {
    nome: 'Comum', pontos: 10, cabecalho: 'Conquista desbloqueada',
    mensagem: 'Um pequeno passo — mas todo grande feiticeiro começou exatamente assim.',
  },
  raro: {
    nome: 'Raro', pontos: 25, cabecalho: 'Conquista rara!',
    mensagem: 'Poucos chegam até aqui. Seu nome começa a circular entre quem presta atenção.',
  },
  epico: {
    nome: 'Épico', pontos: 50, cabecalho: 'Feito épico!',
    mensagem: 'Isso exigiu sangue, coragem e um pouco de loucura. A mesa inteira vai lembrar deste momento.',
  },
  lendario: {
    nome: 'Lendário', pontos: 100, cabecalho: 'LENDA VIVA',
    mensagem: 'Histórias como esta viram lenda. Gerações de feiticeiros vão sussurrar o que você fez hoje.',
  },
  impossivel: {
    nome: 'Impossível', pontos: 250, cabecalho: 'O IMPOSSÍVEL ACONTECEU',
    mensagem: 'Os dados, o destino e o próprio Mestre diziam que não dava. Você provou que todos estavam errados.',
  },
};

const d = (id: string, titulo: string, requisito: string, icone: string, raridade: RaridadeConquista, gatilho: GatilhoConquista = 'manual', secreta = false): ConquistaDef =>
  ({ id, titulo, descricao: requisito, requisito, icone, raridade, secreta, gatilho, recompensas: [], updatedAt: 0 });

/** Catálogo inicial; o Mestre pode editar, apagar ou criar novas. */
export const CONQUISTAS_PADRAO: ConquistaDef[] = [
  d('mesmo-mundo', 'O mesmo mundo; uma nova visão.', 'O começo da campanha.', '🌅', 'comum'),
  d('comidas-caras', 'Comidas são mais caras do que eu pensava!', 'Vá em uma loja de comidas e conheça o catálogo.', '🍙', 'comum', 'loja_comida'),
  d('primeira-vez', 'Pra tudo tem a primeira vez! Até pra... Maldições..?', 'Tenha seu primeiro combate.', '⚔️', 'comum', 'primeiro_combate'),
  d('limiar-do-fim', 'O Limiar do Fim', 'Caia nas Portas da Morte pela primeira vez.', '🚪', 'raro', 'portas_da_morte', true),
  d('expansao-dominio', 'Expansão de Domínio', 'Realize uma Expansão de Domínio Completa.', '🌀', 'lendario'),
  d('dano-colateral', 'Dano Colateral Urbano', 'Cause o colapso de edifícios massivos ou transforme o campo de batalha em Terreno Difícil com feitiços destrutivos.', '🏚️', 'epico'),
  d('mercado-obscuro', 'O Preço do Mercado Obscuro', 'Adquira ou confeccione sua primeira Ferramenta Amaldiçoada de Grau 2 ou superior.', '🗡️', 'raro'),
  d('alvo-iniciativa', 'Alvo da Iniciativa', 'Sobreviva a uma emboscada não planejada ou a um mandado de execução emitido pela Cúpula.', '🎯', 'epico', 'manual', true),
];

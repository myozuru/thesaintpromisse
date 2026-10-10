/** Sistema de Conquistas: tipos, raridades e catálogo padrão da campanha. */
export type RaridadeConquista = 'comum' | 'raro' | 'epico' | 'lendario' | 'impossivel';

/** Gatilhos automáticos conhecidos; 'manual' = só o Mestre concede. */
export type GatilhoConquista = 'manual' | 'primeiro_combate' | 'loja_comida' | 'portas_da_morte';

export type RecompensaConquista =
  | { tipo: 'dinheiro'; valor: number; currencyId: string }
  | { tipo: 'item'; entidadeId: string; quantidade: number }
  | { tipo: 'titulo'; texto: string }
  | { tipo: 'texto'; texto: string }
  /** Recompensas imediatas na ficha — usar só em conquistas simples. */
  | { tipo: 'recuperar_pe'; valor: number }
  | { tipo: 'recuperar_vida'; valor: number }
  | { tipo: 'pvt'; valor: number }
  | { tipo: 'reduzir_exaustao'; niveis: number };

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

const d = (id: string, titulo: string, requisito: string, icone: string, raridade: RaridadeConquista, gatilho: GatilhoConquista = 'manual', secreta = false, recompensas: RecompensaConquista[] = []): ConquistaDef =>
  ({ id, titulo, descricao: requisito, requisito, icone, raridade, secreta, gatilho, recompensas, updatedAt: 0 });

const pe = (valor: number): RecompensaConquista => ({ tipo: 'recuperar_pe', valor });
const vida = (valor: number): RecompensaConquista => ({ tipo: 'recuperar_vida', valor });
const pvt = (valor: number): RecompensaConquista => ({ tipo: 'pvt', valor });
const exaustao = (niveis: number): RecompensaConquista => ({ tipo: 'reduzir_exaustao', niveis });
const titulo = (texto: string): RecompensaConquista => ({ tipo: 'titulo', texto });

/** Catálogo inicial; o Mestre pode editar, apagar ou criar novas.
 *  Recompensas imediatas (PE/vida/PVT/exaustão) só nas conquistas simples. */
export const CONQUISTAS_PADRAO: ConquistaDef[] = [
  // Comum — simples, com pequenos bônus imediatos
  d('mesmo-mundo', 'O mesmo mundo; uma nova visão.', 'O começo da campanha.', '🌅', 'comum', 'manual', false, [pe(3)]),
  d('comidas-caras', 'Comidas são mais caras do que eu pensava!', 'Vá em uma loja de comidas e conheça o catálogo.', '🍙', 'comum', 'loja_comida', false, [vida(5)]),
  d('primeira-vez', 'Pra tudo tem a primeira vez! Até pra... Maldições..?', 'Tenha seu primeiro combate.', '⚔️', 'comum', 'primeiro_combate', false, [pvt(5)]),
  d('primeira-compra', 'Cliente Fiel', 'Compre seu primeiro item em uma loja.', '🛍️', 'comum', 'manual', false, [pe(2)]),
  d('primeira-quest', 'Trabalho Honesto', 'Conclua sua primeira quest do mural.', '📜', 'comum', 'manual', false, [vida(8)]),
  d('descanso-merecido', 'Descanso Merecido', 'Faça seu primeiro descanso longo em segurança.', '🛏️', 'comum', 'manual', false, [exaustao(1)]),
  d('primeiro-critico', 'Na Mosca!', 'Acerte seu primeiro crítico (20 natural).', '🎯', 'comum', 'manual', false, [pe(3)]),
  d('primeira-falha', 'Nem Todo Dia é Dia', 'Tire um 1 natural em um momento importante.', '🎲', 'comum', 'manual', false, [pvt(5)]),
  d('anatomia-degradacao', 'A Anatomia da Degradação', 'Acumule Nível 3 de Exaustão.', '🥀', 'comum', 'manual', false, [exaustao(1)]),
  // Raro — sem bônus imediatos
  d('limiar-do-fim', 'O Limiar do Fim', 'Caia nas Portas da Morte e sobreviva aos testes de estabilização.', '🚪', 'raro', 'portas_da_morte', true),
  d('mercado-obscuro', 'O Preço do Mercado Obscuro', 'Adquira ou confeccione sua primeira Ferramenta Amaldiçoada de Grau 2 ou superior.', '🗡️', 'raro'),
  d('guilda-fundada', 'Juntos Somos Mais', 'Funde ou entre em uma guilda.', '🏛️', 'raro'),
  d('pechincheiro', 'Lábia de Mercador', 'Vença uma pechincha difícil com um lojista.', '🪙', 'raro'),
  d('salvador', 'Mão Estendida', 'Estabilize um aliado nas Portas da Morte.', '🩹', 'raro'),
  // Épico
  d('raio-negro', 'Faíscas da Distorção Espacial', 'Acerte um Raio Negro em combate.', '⚡', 'epico', 'manual', false, [titulo('Faísca Negra')]),
  d('dano-colateral', 'Dano Colateral Urbano', 'Cause o colapso de edifícios massivos ou transforme o campo de batalha em Terreno Difícil com feitiços destrutivos.', '🏚️', 'epico'),
  d('alvo-iniciativa', 'Alvo da Iniciativa', 'Sobreviva a uma emboscada não planejada ou a um mandado de execução emitido pela Cúpula.', '🎯', 'epico', 'manual', true),
  d('matematica-equivalencia', 'A Matemática da Equivalência', 'Sele um Voto de Restrição de Peso Pesado com o Mestre.', '⚖️', 'epico'),
  d('derrubar-chefe', 'Gigantes Também Caem', 'Ajude a derrotar um chefe de patamar Desafio ou superior.', '👹', 'epico', 'manual', false, [titulo('Mata-Gigantes')]),
  // Lendário
  d('expansao-dominio', 'Arquitetura Mental Manifestada', 'Realize uma Expansão de Domínio Completa.', '🌀', 'lendario', 'manual', false, [titulo('Senhor do Domínio')]),
  d('supremacia-territorial', 'Supremacia Territorial', 'Vença um confronto de Expansões de Domínio.', '🏯', 'lendario', 'manual', false, [titulo('Soberano Territorial')]),
  d('sobrevivente-calamidade', 'Diante da Calamidade', 'Sobreviva a um combate contra um chefe Calamidade.', '🌋', 'lendario', 'manual', true),
  // Impossível
  d('voto-quebrado', 'O Preço da Palavra', 'Quebre um Voto de Restrição e sobreviva às consequências.', '💔', 'impossivel', 'manual', true),
  d('derrotar-santo', 'Abaixo dos Céus', 'Derrote sozinho um chefe de patamar Santo.', '👑', 'impossivel', 'manual', true, [titulo('O Impossível')]),
];

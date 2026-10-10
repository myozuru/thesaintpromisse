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
  // Expansão do catálogo (lista revisada) — Comum
  d('nivel-2', 'Subindo os Degraus da Loucura', 'Sobreviva o suficiente para chegar ao Nível 2.', '🪜', 'comum', 'manual', false, [pe(3)]),
  d('ferramenta-incomum', 'O Mercado das Sombras', 'Adquira ou forje sua primeira Ferramenta Amaldiçoada Incomum ou Rara.', '🕯️', 'comum', 'manual', false, [pe(2)]),
  d('pegadas-espectrais', 'Pegadas Espectrais', 'Seja rastreado por resquícios de energia amaldiçoada nas ruínas da cidade.', '👣', 'comum', 'manual', true),
  d('exaustao-1', 'Cansaço ou Maldição?', 'Atinja o Nível 1 de Exaustão e sofra suas primeiras penalidades.', '😮‍💨', 'comum', 'manual', false, [pvt(3)]),
  d('desastre-natural', 'Acidente de Percurso', 'Tire um 1 natural, sofra um Desastre e crie uma brecha na sua Guarda.', '💥', 'comum', 'manual', false, [vida(4)]),
  d('voto-leve', 'Pequenos Sacrifícios', 'Sele o seu primeiro Voto de Restrição de Peso Leve com o Mestre.', '🤝', 'comum', 'manual', false, [pe(2)]),
  d('sentido-perigo', 'O Cheiro da Decomposição', 'Perceba uma ameaça letal pelos indícios sensoriais antes da emboscada.', '👃', 'comum', 'manual', false, [pvt(3)]),
  d('portas-primeira-vez', 'À Beira do Abismo', 'Atinja 0 Pontos de Vida e transite para as Portas da Morte pela primeira vez.', '🕳️', 'comum', 'manual', true, [vida(5)]),
  d('exorcismo-g4', 'Limpando a Sujeira Urbana', 'Exorcize um Espírito Amaldiçoado de Grau 4.', '🧹', 'comum', 'manual', false, [pe(3)]),
  d('pagamento-cupula', 'Dinheiro Sujo de Sangue', 'Receba seu primeiro financiamento ou pagamento da Cúpula Jujutsu.', '💴', 'comum', 'manual', false, [pe(2)]),
  // Raro
  d('voto-medio', 'O Preço do Poder', 'Sele um Voto de Restrição de Peso Médio, trocando uma deficiência tática por vantagens.', '⚖️', 'raro'),
  d('dominio-simples', 'O Domínio dos Fracos', 'Use a Cesta Oca de Vime ou o Domínio Simples para anular um acerto garantido.', '🧺', 'raro'),
  d('atributo-maximo', 'Extrapolando os Limites Humanos', 'Alcance o limite máximo natural de um Atributo.', '💪', 'raro'),
  d('ameaca-g2', 'Ameaça Contida', 'Exorcize uma Maldição ou derrote um Feiticeiro de Grau 2.', '🎖️', 'raro'),
  d('reanimacao-aliado', 'Choque de Realidade', 'Salve um aliado nas Portas da Morte com a reanimação cardíaca amaldiçoada do Suporte.', '💓', 'raro'),
  d('lenda-urbana', 'Lenda Urbana Letal', 'Derrote um Espírito Amaldiçoado Vingativo Imaginário nascido do medo do folclore local.', '👻', 'raro', 'manual', true),
  // Épico
  d('dominio-incompleto', 'Uma Tela em Branco', 'Manifeste seu Domínio Interno ativando uma Expansão de Domínio Incompleta.', '⬜', 'epico'),
  d('elite-grau-1', 'Elite da Feitiçaria', 'Derrote sozinho um inimigo de Grau 1 ou equivalente.', '🥋', 'epico'),
  d('consciencia-absoluta', 'Amado pelas Faíscas Negras', 'Entre no Estado de Consciência Absoluta após acertar Raios Negros em combate.', '🖤', 'epico', 'manual', true),
  d('tecnica-maxima', 'A Quintessência do Jujutsu', 'Aprenda e utilize a Técnica Máxima da sua árvore de habilidades.', '🌟', 'epico'),
  d('energia-reversa', 'Positivo Atrai Positivo', 'Utilize a Energia Reversa para regenerar seu próprio corpo.', '➕', 'epico'),
  d('ferramenta-epica', 'O Peso do Grau 1', 'Adquira, saqueie ou forje uma Ferramenta Amaldiçoada de raridade Épica.', '🗝️', 'epico'),
  d('origem-derivada', 'Anomalia Genética', 'Desbloqueie o potencial extremo de uma Origem Derivada ou Restringida.', '🧬', 'epico', 'manual', true),
  d('exaustao-4', 'À Beira da Falência Mental', 'Atinja o Nível 4 de Exaustão e lute sob Condenado e Desorientado.', '🌀', 'epico', 'manual', true),
  // Lendário
  d('voto-extremo', 'O Peso da Minha Alma', 'Sele um Voto de Restrição de Peso Extremo, sofrendo mutilação irreversível por um pulso letal único.', '🩸', 'lendario', 'manual', true),
  d('milagreiro', 'Milagreiro nas Ruínas', 'Cure a alma ou regenere membros perdidos de aliados com Energia Reversa avançada.', '😇', 'lendario'),
  d('colapso-metropole', 'O Colapso da Metrópole', 'Zere os pontos de vida de um edifício massivo, aplicando os catastróficos 20d10 de Dano Externo na área.', '🌆', 'lendario'),
  d('reversao-tecnica', 'Inversão Conceitual', 'Compreenda o âmago do jujutsu e conjure uma Reversão de Técnica.', '🔄', 'lendario'),
  d('desafiando-ceifador', 'Desafiando o Ceifador', 'Sobreviva ao limite das Portas da Morte com PVs negativos quase igualando sua vida máxima.', '💀', 'lendario', 'manual', true),
  // Impossível
  d('dominio-sem-barreira', 'Uma Obra Divina', 'Manifeste uma Expansão de Domínio Sem Barreira, projetando destruição sobre o mundo real.', '🌐', 'impossivel', 'manual', true),
  d('voto-emergencial', 'Letalidade Cármica Absoluta', 'Quebre os termos de um Voto Emergencial e sobreviva à punição absoluta imposta pelo sistema.', '☠️', 'impossivel', 'manual', true),
  d('quatro-raios', 'A Zona Absoluta', 'Desafie a probabilidade e acerte quatro Raios Negros em um único combate letal.', '⚡', 'impossivel', 'manual', true, [titulo('A Zona')]),
];

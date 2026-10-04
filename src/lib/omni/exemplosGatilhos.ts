import type { GatilhoId } from "./constantesDoSistema";

/** Exemplo completo e contexto próprio de cada evento; aliases continuam no registro central. */
export const EXEMPLOS_GATILHOS: Record<
  GatilhoId,
  { efeito: string; explicacao: string }
> = {
  aoEquipar: {
    efeito: "somar 4 em @USUARIO.vida_max",
    explicacao:
      "Ao equipar, acrescenta 4 à Vida Máxima. Guardar não desfaz essa alteração: reequipar pode acrescentar de novo. Para um bônus que exista apenas enquanto equipado, use bônus de equipamento.",
  },
  noInicioDoTurno: {
    efeito: "somar 1 em @USUARIO.pe",
    explicacao:
      "No início do turno do portador, recupera 1 PE atual, respeitando o máximo. Não concede uma ação nem recupera PE dos aliados.",
  },
  noFimDoTurno: {
    efeito: 'subtrair 1d4 em @USUARIO.vida tipo "Venenoso"',
    explicacao:
      "Ao fim do turno do portador, causa nele 1d4 bruto de Veneno. Use numa condição ou passiva vinculada à vítima; o tipo permite ao motor aplicar as proteções correspondentes.",
  },
  aoAcertarAtaque: {
    efeito: 'subtrair 1d4 em @ALVO.vida tipo "Psíquico"',
    explicacao:
      "Depois de um ataque acertar, causa 1d4 adicional de Psíquico na vítima desse ataque. Não rola outro acerto nem repete o dano-base. Um ataque que erra não emite este evento de acerto.",
  },
  aoErrarAtaque: {
    efeito: "somar 1 em @USUARIO.contador falhas ate 3",
    explicacao:
      "Cada erro acumula uma falha, até 3. Com 2 passa a 3; com 3 permanece. O contador não concede uma repetição do ataque nem é consumido sozinho.",
  },
  aoSofrerDano: {
    efeito: "somar 1 em @USUARIO.contador rancor ate @USUARIO.treino",
    explicacao:
      "Ao receber dano efetivo, o portador acumula 1 Rancor, com teto global igual a Treino. Treino 3 e saldo 2 passam a 3. Sem filtro adicional, também aceita dano ambiental; filtre o agressor se a habilidade exigir inimigo.",
  },
  aoCausarDano: {
    efeito: "somar floor(@DANO.valor_final / 4) em @USUARIO.vida",
    explicacao:
      "Depois de causar dano, recupera um quarto do dano final, arredondado para baixo: 11 efetivos curam 2 PV. Usa o contexto do dano resolvido, não o dado bruto da arma.",
  },
  aoConjurarFeitico: {
    efeito: "somar 1 em @USUARIO.contador conjuracoes",
    explicacao:
      "Registra uma conjuração quando o produtor emite o evento de conjurar. Não cobra PE, escolhe feitiço ou lança outra magia; configure limite e consumo desse contador na habilidade correspondente.",
  },
  aoMover: {
    efeito: "somar 1 em @USUARIO.contador deslocamentos",
    explicacao:
      "Registra um deslocamento confirmado. Não soma pixels do arraste nem uma carga por metro; prévias de movimento não equivalem a confirmações.",
  },
  aoEntrarEmAura: {
    efeito: "somar 2 em @ALVO.vida temporaria",
    explicacao:
      "Quando uma ficha entra na aura, concede 2 PV temporários à ficha que entrou. Configure raio e filtro na aura: este efeito sem filtro pode beneficiar qualquer participante, incluindo o próprio portador.",
  },
  aoSairDaAura: {
    efeito: "subtrair 1 em @ALVO.pe",
    explicacao:
      "Quando uma ficha sai da aura, retira 1 PE dela. A ficha afetada é ALVO, não necessariamente o dono da aura. Não continua cobrando depois que saiu.",
  },
  aoAvancarRelogio: {
    efeito: "somar 1 em @USUARIO.contador avisos_tempo",
    explicacao:
      "Conta notificações do relógio global quando ele muda de minuto. Um salto de vários minutos pode produzir uma notificação, portanto este contador não mede exatamente minutos decorridos.",
  },
  aoCurar: {
    efeito: "somar 1 em @USUARIO.contador socorros",
    explicacao:
      "O curador registra um socorro ao produzir cura efetiva. Cura bloqueada ou zero não conta. O receptor é outra identidade; este evento não significa que o portador foi curado.",
  },
  aoReceberCura: {
    efeito: "se @USUARIO.cura recebida >= 12 entao somar 1 em @USUARIO.sorte",
    explicacao:
      "O paciente ganha 1 Sorte se a cura efetiva recebida foi pelo menos 12 PV. Uma tentativa de curar 20 que restaurou apenas 5 não passa. Sorte respeita seu limite.",
  },
  aoMorrer: {
    efeito: "definir 0 em @USUARIO.contador rancor",
    explicacao:
      "Ao morrer, zera o Rancor do portador. Não ressuscita, remove o personagem do mapa ou apaga outros contadores.",
  },
  aoAplicarCondicao: {
    efeito: "somar 1 em @USUARIO.contador controles",
    explicacao:
      "Quem aplica uma condição registra uma aplicação aceita. Uma condição recusada por imunidade não deve gerar a recompensa. A fórmula não reaplica a própria condição.",
  },
  aoReceberCondicao: {
    efeito: "somar 3 em @USUARIO.vida temporaria",
    explicacao:
      "O receptor de uma condição ganha 3 PV temporários. Isso protege contra danos posteriores, sem remover a condição recém-recebida.",
  },
  aoUsarTalento: {
    efeito: "somar 1 em @USUARIO.contador talentos_usados",
    explicacao:
      "Registra o uso emitido pelo fluxo de um talento. Consultar tem talento não equivale a usá-lo e não incrementa esse contador.",
  },
  aoAtivarAptidao: {
    efeito: "somar 1 em @USUARIO.pe",
    explicacao:
      "Ao ativar uma aptidão por um fluxo que emite o evento, recupera 1 PE. Possuir uma aptidão passiva ou consultar seu ID não produz a ativação por si só.",
  },
  aoAtivarHabilidadeSpec: {
    efeito: "somar 2 em @USUARIO.vida temporaria",
    explicacao:
      "Uma ativação emitida pelo fluxo da habilidade de especialização concede 2 PV temporários ao usuário. Não desbloqueia a habilidade nem paga seu custo.",
  },
  aoIniciarRodadaCombate: {
    efeito: "definir 0 em @USUARIO.contador impulso",
    explicacao:
      "No começo da rodada, reinicia o Impulso da regra personalizada. Não altera ataques, reações ou movimento nativos, que têm suas próprias renovações.",
  },
  aoFinalizarRodadaCombate: {
    efeito: "se @USUARIO.contador impulso >= 3 entao somar 1 em @USUARIO.pe",
    explicacao:
      "No encerramento da rodada, Impulso 3 ou mais recupera 1 PE; saldo 2 não recupera. Esta linha não consome Impulso: combine com a regra de renovação ou custo desejada.",
  },
  aoIniciarCombate: {
    efeito: "definir 3 em @USUARIO.contador folego",
    explicacao:
      "Começa cada combate com exatamente 3 pontos de Fôlego personalizado. Se havia 5, passa a 3; não soma mais três. O contador não é o PE nativo.",
  },
  aoFinalizarCombate: {
    efeito: "definir 0 em @USUARIO.contador folego",
    explicacao:
      "Ao terminar o combate, encerra o Fôlego personalizado zerando-o. Não limpa buffs, inventário ou condições de outras regras.",
  },
  aoDescansar: {
    efeito: "definir 0 em @USUARIO.contador fadiga_extra",
    explicacao:
      "Um descanso reconhecido pelo fluxo da mesa limpa a Fadiga Extra personalizada. Não reduz automaticamente a Exaustão nativa nem recarrega usos diários de itens.",
  },
  aoVendar: {
    efeito: "definir 1 em @USUARIO.contador treino_cegas",
    explicacao:
      "Ao ocupar o slot de Venda, marca Treino às Cegas com 1. Não concede Percepção ou visão mágica; outra fórmula pode usar esse marcador como requisito.",
  },
  aoDescobrir: {
    efeito: "definir 0 em @USUARIO.contador treino_cegas",
    explicacao:
      "Ao remover a Venda pelo fluxo do slot, limpa o marcador Treino às Cegas. Descobrir aqui significa desocupar esse slot, não revelar um inimigo oculto.",
  },
  aoAtualizarContador: {
    efeito:
      "se @USUARIO.contador rancor >= 3 entao somar 1 em @USUARIO.vida temporaria",
    explicacao:
      "A cada notificação de atualização de contador, verifica o saldo de Rancor e concede 1 PV temporário se ele for pelo menos 3. O evento é genérico: sem filtro da origem, alterações de outros contadores também podem executar a checagem.",
  },
  aoAliadoSofrerDano: {
    efeito:
      "se @CENA.distancia <= 4.5 entao somar 1 em @USUARIO.contador rancor ate @USUARIO.treino",
    explicacao:
      "O portador observa o aliado ferido; distância de 4,5 m ou menos acumula 1 Rancor no portador, com teto global Treino. A vítima aliada não recebe essa carga. Este exemplo aceita qualquer agressor; adicione filtro de inimigo quando a habilidade exigir.",
  },
  aoInimigoSofrerDano: {
    efeito:
      "se @CENA.distancia <= 6 entao somar 1 em @USUARIO.contador pressao ate 4",
    explicacao:
      "Um inimigo que recebe dano a até 6 m aumenta Pressão do observador, até 4. Não causa dano adicional ao inimigo nem exige que o observador tenha dado o golpe.",
  },
  aoAliadoCausarDano: {
    efeito: "se @CENA.distancia <= 3 entao somar 1 em @USUARIO.pe",
    explicacao:
      "Um aliado que causa dano a até 3 m inspira o observador a recuperar 1 PE. A distância é entre observador e participante observado, não o alcance da arma do aliado.",
  },
  aoInimigoCausarDano: {
    efeito:
      "se @CENA.distancia <= 4.5 entao somar 2 em @USUARIO.vida temporaria",
    explicacao:
      "Ao observar um inimigo causando dano a até 4,5 m, o portador ganha 2 PV temporários. É proteção posterior ao evento: não intercepta o dano já resolvido na vítima.",
  },
  aoAliadoMorrer: {
    efeito: "se @CENA.distancia <= 6 entao somar 2 em @USUARIO.pe",
    explicacao:
      "A morte de um aliado observado a até 6 m recupera 2 PE do portador. Não devolve PV ao aliado morto nem transfere seus recursos.",
  },
  aoInimigoMorrer: {
    efeito:
      "se @CENA.distancia <= 6 entao somar 1 em @USUARIO.contador triunfos",
    explicacao:
      "A morte de um inimigo observado a até 6 m registra um triunfo. O evento de observação não exige que o portador tenha feito o golpe final.",
  },
};

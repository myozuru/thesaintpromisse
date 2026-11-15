/**
 * Gera o pacote inicial editável das Ferramentas Amaldiçoadas.
 * Execute apenas para regenerar os presets antes de preencher preços/imagens
 * no jogo: importar este pacote mescla os templates e pode substituir esses
 * campos personalizados do catálogo.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const agregadoExistente = path.join(root, 'public', 'omni-presets', 'ferramentas-amaldicoadas.json');
if (fs.existsSync(agregadoExistente) && !process.argv.includes('--force')) {
  throw new Error('O pacote já existe. Por segurança, não sobrescrevi preço/imagens/categorias editados pelo Mestre. Use --force somente após salvar uma cópia das customizações.');
}
const presetDir = path.join(root, 'public', 'omni-presets');
const now = Date.UTC(2026, 10, 15);
const cursedTags = ['amaldicoado', 'ferramenta_amaldicoada'];
const comercio = () => ({ basePrice: 0, hiddenTags: [...cursedTags], isBought: false, categoriasAceitas: [] });

function readPreset(file) {
  return JSON.parse(fs.readFileSync(path.join(presetDir, file), 'utf8'));
}
function writePreset(file, value) {
  fs.writeFileSync(path.join(presetDir, file), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}
function baseEntity({ id, name, description, model, damage, damageType, crit = 19, spaces, grade, rarity, props, range = 'melee', group = 'Espada', rangeShort, rangeLong, icon = '⚔️', actions = [] }) {
  const entityId = `preset-${id}`;
  const tags = [
    'preset', 'arma', 'complexa', range, `grupo:${group.toLowerCase()}`,
    ...props.map((prop) => `prop:${prop}`), `modelo:${model}`, `espacos:${spaces}`,
    `mao:${props.includes('duas_maos') ? 2 : 1}`, 'ferramenta_amaldicoada',
    `grau:${grade}`, `raridade:${rarity}`,
  ];
  if (rangeShort != null && rangeLong != null) tags.push(`alcance:${rangeShort}/${rangeLong}`);
  const effect = { id: `${id}-dano-base`, formula: damage, type: 'SUBTRAIR', target: 'ALVO', damageType, resourcePath: 'vida_atual' };
  return {
    id: entityId, versao: 1, nome: name, categoria: 'arma', descricao: description, icone: icon,
    tags, duracao: { tipo: 'permanente' }, custos: [],
    gatilhos: [{ id: `${id}-equipar`, evento: 'aoEquipar', blocos: [] }],
    slotType: 'maos', criadoEm: now, atualizadoEm: now, comercio: comercio(),
    ...(actions.length ? { acoesAtivas: actions } : {}),
    combatData: { effects: [effect], effectsPassive: [], effectsActive: [effect], critRange: crit, critMultiplier: 2,
      actionCost: 'action_standard', rangeType: range === 'melee' ? 'touch' : 'ranged', aoeShape: 'single', isActive: true },
  };
}

const single = (id, nome, acao, custoPE, alcanceM, teste, extra = {}) => ({
  id, nome, acao, custoPE: String(custoPE), alcanceM, tipo_alvo: 'unico', filtro_alvo: 'inimigos',
  teste, tipo_efeito: 'dano', ...extra,
});
const multiAttack = (id, nome, custoPE, alcanceM, dano, tipoDano, extra = {}) => ({
  id, nome, acao: 'comum', custoPE: String(custoPE), alcanceM, tipo_alvo: 'multiplo',
  filtro_alvo: 'inimigos', max_alvos: '3', teste: 'ataque', tipo_efeito: 'dano', dano,
  tipoDano, ...extra,
});

const seraphielDescription = `**Cetro de Guerra Complexo • 2 espaços • 2º Grau • Precioso**
Dano base: 2d8 Impacto • Crítico: 19–20/×2 • Propriedades: Duas Mãos, Estendida, Especial.

**Arsenal dos Serafins (Passiva):** seis lanças luminosas orbitam o cetro. Uma vez por rodada, escolha um efeito. **Punição:** ao acertar com o cetro, uma lança ataca o mesmo inimigo com +1; se atingir, causa 2d8 Radiante. **Proteção:** quando o portador ou um aliado a até 6 m for alvo de um ataque, gaste sua Reação para receber +2 na Defesa contra esse ataque. As lanças se recompõem sem munição ou cargas.

**Perseguição Divina (Ação Comum, 6 PE):** escolha até três criaturas a até 18 m; cada uma recebe um ataque à distância independente com +1 e causa 2d8 Radiante se atingida. É permitido concentrar os três disparos no mesmo alvo.

**Prisão dos Seis Céus (Ação Comum, 8 PE):** cerque uma área de raio 3 m centrada em um ponto a até 18 m por 1 rodada. Inimigos fazem TR de Reflexos contra a CD do usuário. Falha: 3d8 Radiante e Imóvel até o fim da prisão. Sucesso: metade do dano, sem condição. Ao tentar atravessar a borda, cada inimigo pode sofrer uma interceptação por rodada: ataque individual +1; acerto causa 2d8 Radiante e interrompe o movimento, erro permite atravessar.

**O Sexto Julgamento (Ação Completa, 12 PE, 1 vez por cena):** escolha uma criatura a até 24 m e faça seis ataques independentes, ou distribua os seis ataques entre duas ou três criaturas no alcance. Cada lança recebe +1 e causa 1d12 Radiante ao acertar. Role ataque e dano separadamente; críticos afetam somente a respectiva lança.`;

const aetherisDescription = `**Báculo Complexo • 2 espaços • Grau Especial • Lendário**
Dano base: 2d8 Impacto • Crítico: 19–20/×2 • Propriedades: Duas Mãos, Estendida, Especial.

**Asas do Firmamento (Passiva):** +3 m de Deslocamento; ignora Terreno Difícil natural; pode planar e anula dano de quedas de até 18 m.

**Rajada Sônica (Passiva):** uma vez por rodada, ao acertar com o báculo, causa +3d8 Sônico e empurra o alvo até 3 m.

**Julgamento dos Ventos (Crítico especial):** em um crítico, causa +11d8 Sônico. O alvo faz TR de Fortitude contra a CD do usuário; em falha, não pode realizar Reações até o início do próximo turno do portador.

**Plumas da Tempestade (Ação Comum, 8 PE):** faça até três ataques à distância independentes contra criaturas a até 18 m; cada acerto causa 8d8 Cortante. Depois, mova-se até 4,5 m sem provocar Ataques de Oportunidade.

**Reversão dos Ventos (Reação, 7 PE):** quando um ataque à distância for feito contra o portador ou um aliado a até 9 m, conceda +5 na Defesa contra aquele ataque. Se ele errar, o portador pode fazer um ataque à distância contra o agressor; o acerto causa 5d8 Sônico.

**Trono das Nuvens (Ação Comum, 9 PE):** escolha uma área de raio 3 m a até 18 m. Criaturas escolhidas fazem TR de Fortitude. Falha: 5d8 Impacto e ficam Suspensas a 4,5 m até o início do próximo turno do portador. Sucesso: metade do dano, sem suspensão. Criaturas suspensas sem voo não podem usar deslocamento de caminhada; ao terminar, descem sem dano.

**Réquiem dos Céus (Ação Completa, 18 PE, 1 vez por cena):** escolha um ponto a até 24 m; criaturas escolhidas em raio de 9 m fazem TR de Fortitude. Falha: 18d12 Sônico, empurrão de 6 m e Caído. Sucesso: metade do dano, sem efeitos adicionais. Alvos suspensos sofrem –2 no TR. O portador pode transportar até três aliados na área por até 9 m sem dano.

**Ruptura do Firmamento (Reação, 2 PE):** imediatamente após um crítico com Aetheris, causa +8d12 Sônico, empurra o alvo até 6 m e exige TR de Fortitude; falha deixa Caído. O dano ocorre depois do ataque e não é multiplicado pelo crítico. Pode ser combinada com Julgamento dos Ventos se ainda houver Reação.`;

const sagittaDescription = `**Arco Longo Celestial Marcial • 2 espaços • Grau Especial • Santo**
Dano base: 5d12 Perfurante • Crítico: 19–20/×2 • Propriedades: Distância, Duas Mãos, Especial.

**Cartografia Celestial (Passiva):** Sagitta cria as próprias flechas douradas. Elas atravessam coberturas parciais, superiores e totais, paredes, rochas e outras estruturas sem destruí-las. Podem atingir criaturas ocultas se o portador conhecer sua localização. Ainda respeitam Defesa, armaduras e proteções de técnicas. Uma vez por rodada, ao acertar uma criatura, a Explosão Estelar causa +8d10 Energético.

**Constelação do Caçador (Ação Comum, 10 PE):** dispare até três flechas contra até três inimigos dentro do alcance do arco. Cada alvo recebe um ataque à distância; acerto causa o dano base da arma +6d8 Queimante. Contra um único inimigo, as estrelas convergem em um projétil: um acerto causa o dano base +10d8 Queimante.

**Equinócio Sagrado (Reação, 9 PE):** quando o portador ou aliado a até 9 m sofrer dano de um ataque, reduza-o em 5d10. Se o agressor estiver visível e dentro do alcance do arco, uma flecha retorna e causa dano Queimante igual à metade do dano efetivamente impedido.

**Decreto do Zênite (Ação Completa, 20 PE, 1 vez por cena):** escolha uma criatura a até 36 m cuja localização seja conhecida. Faça um ataque à distância com +6, ignorando cobertura total. O ataque é automaticamente crítico: dano crítico da arma +20d10 Queimante, ignora até 10 de Resistência a Queimante, inclui Sentença das Estrelas (+6d8 Queimante) e, se ainda disponível nesta rodada, Explosão Estelar (+8d10 Energético). TR de Fortitude falho deixa o alvo Atordoado por 1 rodada. A preparação e o disparo impedem deslocamento.

**Sentença das Estrelas (Crítico especial):** em crítico, causa +6d8 Queimante e revela a posição do alvo; ele não recebe benefícios de invisibilidade ou camuflagem até o início do próximo turno do portador.`;

const raijinDescription = `**Katana Complexa • 2 espaços • 1º Grau • Épico**
Dano base: 2d8 Cortante • Crítico: 19–20/×2 • Propriedades: Duas Mãos, Versátil, Especial.

**Sangue do Trovão (Passiva):** uma vez por rodada, ao acertar, causa +3d8 Energético. Se houver outro inimigo a até 3 m do alvo atingido, o relâmpago salta até ele e causa 2d8 Energético.

**Dança do Relâmpago Escarlate (Ação Comum, 12 PE):** mova-se até 18 m sem provocar Ataques de Oportunidade e faça ataques contra até três inimigos diferentes durante o percurso. Cada acerto causa o dano base da arma +3d8 Energético.

**Contratempo do Trovão (Reação, 5 PE):** quando um inimigo fizer um ataque corpo a corpo contra o portador, receba +4 na Defesa contra ele. Se errar, o atacante sofre 4d8 de dano Elétrico Amaldiçoado/Energético e não pode realizar Reações até o início do próximo turno do portador.

**Execução do Deus Trovejante (Ação Comum, 15 PE):** faça um ataque corpo a corpo. Acerto causa o dano base +8d12 Energético. O alvo faz TR de Fortitude; falha causa Atordoado por 1 rodada, aumentando 1 rodada a cada 5 pontos de diferença abaixo da CD. Este TR não tem falha crítica.

**Trovão sem Som (Crítico especial):** causa +5d8 Energético e ignora metade da Resistência a esse dano. Se o alvo usar Reforço de Energia, TR de Fortitude falho deixa-o Paralisado por 1 rodada.`;

const ruinaDescription = `**Katana Complexa • 3 espaços • 1º Grau • Épico**
Dano base: 2d8 Cortante • Crítico: 19–20/×2 • Propriedades: Duas Mãos, Especial.

**Podridão Esmeralda (Passiva):** ao acertar, o alvo faz TR de Fortitude contra a CD do usuário. Falha aplica Corrosão por 2 rodadas; no início de cada turno, sofre 2d8 Venenoso Amaldiçoado e –2 na Defesa. Reaplicações renovam a duração sem acumular efeitos.

**Miasma da Decadência (Ação Comum, 7 PE):** libere uma nuvem em raio de 4,5 m ao redor do portador. Criaturas escolhidas fazem TR de Fortitude. Falha: 6d8 Venenoso Amaldiçoado e Corrosão por 2 rodadas. Sucesso: metade do dano, sem Corrosão. A nuvem persiste até o início do próximo turno do portador e obscurece parcialmente a visão.

**Decomposição Irreversível (Ação Comum, 11 PE):** ataque corpo a corpo; acerto causa o dano base +8d8 Venenoso Amaldiçoado. Se o alvo estiver Corroído, também recebe Deterioração Profunda por 2 rodadas: recuperação de PV reduzida à metade e –2 em Fortitude.

**Necrose Viridiana (Crítico especial):** crítico causa +4d8 Venenoso Amaldiçoado, aplica Corrosão por 2 rodadas sem TR inicial e impõe mais –2 na Defesa até o início do próximo turno do portador.`;

const crepusculoDescription = `**Foice de Guerra Complexa • 3 espaços • 1º Grau • Épico**
Dano base: 2d8 Cortante • Crítico: 19–20/×2 • Propriedades: Estendida, Pesada, Duas Mãos, Especial.

**Lâmina de Retorno (Passiva):** uma vez por rodada, ao errar um ataque corpo a corpo, redirecione a foice contra outra criatura ao alcance, com –2 no acerto.

**Dança do Horizonte Partido (Ação Comum, 7 PE):** projete um arco de 6 m à frente. Criaturas escolhidas fazem TR de Reflexos. Falha: 6d8 Cortante Amaldiçoado e são puxadas até 3 m. Sucesso: metade do dano, sem deslocamento.

**Ceifa do Eclipse (Ação Comum, 12 PE):** ataque corpo a corpo; acerto causa o dano base +8d8 Cortante Amaldiçoado e exige TR de Fortitude. Falha deixa Caído. Se o alvo foi puxado pela Dança nesta rodada, a margem de crítico aumenta em 2.

**Reflexo da Lua Morta (Reação, 5 PE):** quando for alvo de ataque corpo a corpo, receba +3 na Defesa contra esse ataque. Se errar, o atacante faz TR de Fortitude; falha empurra-o 1,5 m.

**Cisão Carmesim (Crítico especial):** crítico causa +4d8 Cortante Amaldiçoado e impede Reações do alvo até o início do próximo turno do portador.`;

const lancaDescription = `**Lança de Haste Complexa • 3 espaços • 1º Grau • Épico**
Dano base: 1d10 Perfurante • Crítico: 19–20/×2 • Propriedades: Estendida, Duas Mãos, Especial.

**Núcleo Carmesim (Passiva):** ataques acertados aplicam 1 Marca Vetorial; críticos aplicam 2. Máximo de 3 marcas e apenas um inimigo marcado por vez. Com 1 marca: +2 nos ataques contra ele. Com 2: ataques ignoram 3 pontos de Defesa e causam +2d8 uma vez por rodada. Com 3: margem de crítico 18–20 contra ele e acesso à Sentença Rubra. Marcas acabam ao final do combate.

**Avanço Escarlate (Ação Comum, 4 PE):** avance em linha reta até 3 m e ataque. No acerto, aplique 2 Marcas Vetoriais em vez de 1.

**Sentença Rubra (Ação Comum, 10 PE; exige 3 marcas):** faça um ataque corpo a corpo. No acerto, causa dano base +10d8 Perfurante Amaldiçoado, impede Reações até o início do próximo turno do portador e consome as 3 marcas. O +2d8 de Fratura Energética não se aplica.`;

const aetherisPackage = readPreset('baculo-aetheris.json');
const aetheris = aetherisPackage.entidades[0];
aetheris.versao = 1;
aetheris.descricao = aetherisDescription;
aetheris.comercio = comercio();
if (!aetheris.tags.includes('ferramenta_amaldicoada')) aetheris.tags.push('ferramenta_amaldicoada');
for (const action of aetheris.acoesAtivas ?? []) {
  if (action.id === 'aa-aetheris-plumas') action.dano = '8d8';
  if (action.id === 'aa-aetheris-requiem') action.dano = '18d12';
  if (action.id === 'aa-aetheris-ruptura') action.dano = '8d12';
}

const lancaPackage = readPreset('lanca-vetorial-rubra.json');
const lanca = lancaPackage.entidades[0];
lanca.versao = 1;
lanca.descricao = lancaDescription;
lanca.comercio = comercio();
if (!lanca.tags.includes('ferramenta_amaldicoada')) lanca.tags.push('ferramenta_amaldicoada');

const seraphiel = baseEntity({
  id: 'seraphiel', name: 'Seraphiel — As Seis Sentenças', description: seraphielDescription, model: 'seraphiel',
  damage: '2d8', damageType: 'Impacto', spaces: 2, grade: '2', rarity: 'precioso', group: 'Haste',
  props: ['duas_maos', 'estendida', 'especial'], icon: '✨',
  actions: [
    single('seraphiel-punicao', 'Punição — usar após acerto (1/rodada)', 'livre', 0, 0, 'ataque', { mod_acerto: 1, dano: '2d8', tipoDano: 'Radiante' }),
    { id: 'seraphiel-protecao', nome: 'Proteção (Arsenal dos Serafins)', acao: 'reacao', custoPE: '0', alcanceM: 6,
      tipo_alvo: 'unico', filtro_alvo: 'aliados', teste: 'nenhum', tipo_efeito: 'buff',
      reacao: { gatilho: 'quando_alvo_declarar_ataque', alcance_m: 6, protegido: 'aliados', alvo: 'protegido', defesa_bonus: 2 } },
    multiAttack('seraphiel-perseguicao', 'Perseguição Divina (até 3 alvos)', 6, 18, '2d8', 'Radiante', { mod_acerto: 1 }),
    { id: 'seraphiel-prisao', nome: 'Prisão dos Seis Céus', acao: 'comum', custoPE: '8', alcanceM: 18,
      tipo_alvo: 'area', filtro_alvo: 'inimigos', area: { forma: 'raio_no_ponto', tamanho_m: 3 },
      teste: 'tr', tr: 'reflexos', metadeNoSucesso: true, dano: '3d8', tipoDano: 'Radiante',
      desfechosTR: { falha: { dano: 'total', efeitos: [{ tipo: 'condicao', condicao: 'imovel', rodadas: 1, ate_inicio_turno_usuario: true }] }, sucesso: { dano: 'metade' } } },
  ],
});

const sagitta = baseEntity({
  id: 'sagitta', name: 'Sagitta — O Juízo do Firmamento', description: sagittaDescription, model: 'sagitta',
  damage: '5d12', damageType: 'Perfurante', spaces: 2, grade: 'especial', rarity: 'santo', range: 'ranged', group: 'Arco',
  rangeShort: 36, rangeLong: 72, props: ['duas_maos', 'especial', 'marcial'], icon: '🏹',
  actions: [
    multiAttack('sagitta-constelacao', 'Constelação do Caçador (dispersa)', 10, 0, '6d8', 'Queimante', { incluirArma: true }),
    single('sagitta-constelacao-convergida', 'Constelação do Caçador (convergida)', 'comum', 10, 0, 'ataque', { dano: '10d8', tipoDano: 'Queimante', incluirArma: true }),
    single('sagitta-explosao-estelar', 'Explosão Estelar (após acerto, 1/rodada)', 'livre', 0, 0, 'nenhum', { dano: '8d10', tipoDano: 'Energético' }),
    single('sagitta-sentenca-estrelas', 'Sentença das Estrelas (após crítico)', 'livre', 0, 0, 'nenhum', { dano: '6d8', tipoDano: 'Queimante' }),
  ],
});

const raijin = baseEntity({
  id: 'raijin', name: 'Raijin — O Trovão Carmesim', description: raijinDescription, model: 'raijin',
  damage: '2d8', damageType: 'Cortante', spaces: 2, grade: '1', rarity: 'epico', group: 'Espada',
  props: ['duas_maos', 'versatil', 'especial'], icon: '⚡',
  actions: [
    single('raijin-sangue-trovao', 'Sangue do Trovão (após acerto, 1/rodada)', 'livre', 0, 0, 'nenhum', { dano: '3d8', tipoDano: 'Energético' }),
    multiAttack('raijin-danca-relampago', 'Dança do Relâmpago Escarlate (até 3 alvos)', 12, 18, '3d8', 'Energético', { incluirArma: true }),
    { id: 'raijin-contratempo', nome: 'Contratempo do Trovão', acao: 'reacao', custoPE: '5', alcanceM: 1.5,
      tipo_alvo: 'unico', filtro_alvo: 'inimigos', teste: 'nenhum', tipo_efeito: 'buff',
      reacao: { gatilho: 'quando_alvo_declarar_ataque', alcance_m: 1.5, tipo_ataque: 'melee', protegido: 'usuario', alvo: 'protegido', defesa_bonus: 4 } },
    single('raijin-contratempo-descarga', 'Descarga do Contratempo (se o ataque errar)', 'livre', 0, 1.5, 'nenhum', { dano: '4d8', tipoDano: 'Energético' }),
    single('raijin-execucao', 'Execução do Deus Trovejante', 'comum', 15, 0, 'ataque', {
      dano: '8d12', tipoDano: 'Energético', incluirArma: true, tr_apos_acerto: true, tr: 'fortitude',
      desfechosTR: { falha: { efeitos: [{ tipo: 'condicao', condicao: 'atordoado', rodadas: 1 }] }, falha_critica: { efeitos: [{ tipo: 'condicao', condicao: 'atordoado', rodadas: 1 }] } },
    }),
    single('raijin-trovao-sem-som', 'Trovão sem Som (após crítico)', 'livre', 0, 0, 'nenhum', { dano: '5d8', tipoDano: 'Energético' }),
  ],
});

const ruina = baseEntity({
  id: 'ruina-esmeralda', name: 'Ruína Esmeralda', description: ruinaDescription, model: 'ruina-esmeralda',
  damage: '2d8', damageType: 'Cortante', spaces: 3, grade: '1', rarity: 'epico', group: 'Espada',
  props: ['duas_maos', 'especial'], icon: '☣️',
  actions: [
    { id: 'ruina-miasma', nome: 'Miasma da Decadência', acao: 'comum', custoPE: '7', alcanceM: 0,
      tipo_alvo: 'area', filtro_alvo: 'inimigos', area: { forma: 'raio_em_si', tamanho_m: 4.5 },
      teste: 'tr', tr: 'fortitude', metadeNoSucesso: true, dano: '6d8', tipoDano: 'Venenoso',
      desfechosTR: { falha: { dano: 'total' }, sucesso: { dano: 'metade' } } },
    single('ruina-decomposicao', 'Decomposição Irreversível', 'comum', 11, 0, 'ataque', { dano: '8d8', tipoDano: 'Venenoso', incluirArma: true }),
    single('ruina-necrose', 'Necrose Viridiana (após crítico)', 'livre', 0, 0, 'nenhum', { dano: '4d8', tipoDano: 'Venenoso' }),
  ],
});

const crepusculo = baseEntity({
  id: 'crepusculo-ultima-lua', name: 'Crepúsculo da Última Lua', description: crepusculoDescription, model: 'crepusculo-ultima-lua',
  damage: '2d8', damageType: 'Cortante', spaces: 3, grade: '1', rarity: 'epico', group: 'Haste',
  props: ['estendida', 'pesada', 'duas_maos', 'especial'], icon: '🌙',
  actions: [
    single('crepusculo-lamina-retorno', 'Lâmina de Retorno (após errar, 1/rodada)', 'livre', 0, 0, 'ataque', { mod_acerto: -2, incluirArma: true }),
    { id: 'crepusculo-danca-horizonte', nome: 'Dança do Horizonte Partido', acao: 'comum', custoPE: '7', alcanceM: 0,
      tipo_alvo: 'area', filtro_alvo: 'inimigos', area: { forma: 'cone', tamanho_m: 6 }, teste: 'tr', tr: 'reflexos',
      metadeNoSucesso: true, dano: '6d8', tipoDano: 'Cortante',
      desfechosTR: { falha: { dano: 'total', efeitos: [{ tipo: 'puxar', metros: 3 }] }, sucesso: { dano: 'metade' } } },
    single('crepusculo-ceifa-eclipse', 'Ceifa do Eclipse', 'comum', 12, 0, 'ataque', {
      dano: '8d8', tipoDano: 'Cortante', incluirArma: true, tr_apos_acerto: true, tr: 'fortitude',
      desfechosTR: { falha: { efeitos: [{ tipo: 'condicao', condicao: 'caido', rodadas: 1 }] }, falha_critica: { efeitos: [{ tipo: 'condicao', condicao: 'caido', rodadas: 1 }] } },
    }),
    { id: 'crepusculo-reflexo-lua', nome: 'Reflexo da Lua Morta', acao: 'reacao', custoPE: '5', alcanceM: 1.5,
      tipo_alvo: 'unico', filtro_alvo: 'todos', teste: 'nenhum', tipo_efeito: 'buff',
      reacao: { gatilho: 'quando_alvo_declarar_ataque', alcance_m: 1.5, tipo_ataque: 'melee', protegido: 'usuario', alvo: 'protegido', defesa_bonus: 3 } },
    single('crepusculo-cisao-carmesim', 'Cisão Carmesim (após crítico)', 'livre', 0, 0, 'nenhum', { dano: '4d8', tipoDano: 'Cortante' }),
  ],
});

const entities = [aetheris, sagitta, raijin, ruina, crepusculo, seraphiel, lanca];
const packageFile = {
  formato: 'omni-engine.v1', nome: 'Ferramentas Amaldiçoadas', autor: 'OMNI', geradoEm: now, entidades: entities,
};

writePreset('baculo-aetheris.json', { ...aetherisPackage, geradoEm: now, entidades: [aetheris] });
writePreset('lanca-vetorial-rubra.json', { ...lancaPackage, geradoEm: now, entidades: [lanca] });
writePreset('ferramentas-amaldicoadas.json', packageFile);

// Os modelos base também são usados quando uma arma é reconstruída na ficha.
const weaponFile = path.join(root, 'src', 'lib', 'weapons.ts');
let weaponSource = fs.readFileSync(weaponFile, 'utf8');
function updateSpecialText(id, text) {
  const block = weaponSource.indexOf(`id: '${id}'`);
  const key = weaponSource.indexOf('specialText:', block);
  const openSingle = weaponSource.indexOf("'", key);
  const openDouble = weaponSource.indexOf('"', key);
  const open = openSingle < 0 ? openDouble : openDouble < 0 ? openSingle : Math.min(openSingle, openDouble);
  const quote = weaponSource[open];
  let close = open + 1;
  while (close < weaponSource.length) {
    if (weaponSource[close] === quote && weaponSource[close - 1] !== '\\') break;
    close += 1;
  }
  if (block < 0 || key < 0 || open < 0 || close >= weaponSource.length) throw new Error(`specialText não localizado para ${id}`);
  weaponSource = `${weaponSource.slice(0, key)}specialText: ${JSON.stringify(text)}${weaponSource.slice(close + 1)}`;
}
updateSpecialText('lanca-vetorial-rubra', 'Ferramenta Amaldiçoada de 1º Grau, Épica. Núcleo Carmesim: 1 marca por acerto (2 em crítico), máximo 3 e um alvo; 1 marca dá +2 no ataque, 2 ignoram 3 Defesa e causam +2d8 uma vez por rodada, 3 ampliam a margem para 18–20. Avanço Escarlate (4 PE): mova 3 m em linha e ataque; acerto aplica 2 marcas. Sentença Rubra (10 PE, 3 marcas): ataque causa dano base +10d8 Perfurante Amaldiçoado, suprime Reações e consome as marcas; não recebe Fratura Energética. As marcas terminam no combate.');
updateSpecialText('baculo-aetheris', 'Ferramenta Amaldiçoada de Grau Especial, Lendária. Asas do Firmamento: +3 m de Deslocamento, ignora terreno difícil natural e anula queda até 18 m. Rajada Sônica: 1 vez por rodada, acerto causa +3d8 e empurra 3 m. Crítico: +11d8 Sônico e TR de Fortitude para suprimir Reações. Plumas da Tempestade (8 PE): até 3 ataques independentes de 8d8 Cortante a 18 m, depois mova 4,5 m sem AdO. Reversão dos Ventos (7 PE): Reação, +5 Defesa contra ataque à distância a 9 m; se errar, pode contra-atacar por 5d8 Sônico. Trono das Nuvens (9 PE): raio 3 m a 18 m, 5d8 Impacto e Suspenso em falha no TR de Fortitude. Réquiem dos Céus (18 PE, completa, 1/cena): raio 9 m a 24 m, 18d12 Sônico, empurra 6 m e Caído em falha; transporta até 3 aliados por 9 m. Ruptura (2 PE e Reação após crítico): +8d12 Sônico, empurra 6 m e TR para Caído; não multiplica pelo crítico.');
fs.writeFileSync(weaponFile, weaponSource, 'utf8');

const index = readPreset('index.json');
index.presets = index.presets.filter((entry) => entry.id !== 'ferramentas-amaldicoadas');
index.presets.push({
  id: 'ferramentas-amaldicoadas', nome: 'Ferramentas Amaldiçoadas',
  descricao: 'Sete armas OMNI editáveis: Aetheris, Sagitta, Raijin, Ruína Esmeralda, Crepúsculo da Última Lua, Seraphiel e Lança Vetorial Rubra. Imagens e preços ficam em branco para configuração pelo Mestre.',
  arquivo: '/omni-presets/ferramentas-amaldicoadas.json',
});
writePreset('index.json', index);

console.log(`Preset gerado com ${entities.length} ferramentas e ${entities.reduce((sum, item) => sum + (item.acoesAtivas?.length ?? 0), 0)} ações ativas.`);

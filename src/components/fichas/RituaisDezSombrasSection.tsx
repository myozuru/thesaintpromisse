import { useMemo, useState } from 'react';
import { Check, Circle, MapPin, Swords } from 'lucide-react';
import type { Character } from '@/types';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useMapStore } from '@/stores/useMapStore';
import { useProfileStore } from '@/stores/useProfileStore';
import { useRoleStore } from '@/stores/useRoleStore';
import {
  requisitosComponentesQuimera,
  ritualAtivoParaAlvo,
  ritualPodeComecar,
  ritualPodeSerConcluido,
  tipoRitualDezSombras,
} from '@/lib/controlador/rituaisDezSombras';
import type { EstadoRitualDezSombras, InvocacaoControlador, RitualDezSombras, TipoRitualDezSombras } from '@/lib/controlador/tipos';

interface Props {
  character: Character;
}

const LABEL_ESTADO: Record<EstadoRitualDezSombras, string> = {
  solicitado: 'Aguardando o Mestre',
  em_andamento: 'Em andamento',
  concluido: 'Concluído',
  falhou: 'Falhou',
  cancelado: 'Cancelado',
};

const LABEL_MODO: Record<NonNullable<RitualDezSombras['modo']>, string> = {
  mapa: 'Combate no mapa',
  manual: 'Resolução manual',
};

function novoRitual(invocacao: InvocacaoControlador, tipo: TipoRitualDezSombras, profileId?: string): RitualDezSombras {
  return {
    id: `ritual-${crypto.randomUUID()}`,
    tipo,
    estado: 'solicitado',
    alvoInvocacaoId: invocacao.id,
    alvoNomeSnapshot: invocacao.apelido?.trim() || invocacao.nome,
    solicitadoEm: new Date().toISOString(),
    ...(profileId ? { solicitadoPorProfileId: profileId } : {}),
  };
}

function formatarData(valor?: string): string {
  if (!valor) return 'Data indisponível';
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? 'Data indisponível' : data.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function resolverCharacter(characterId: string): Character | undefined {
  return useCharacterStore.getState().characters.find(item => item.id === characterId);
}

function limparAlvoDoMapa(ritual: RitualDezSombras): void {
  const entityId = ritual.entidadeMapaId;
  if (!entityId) return;
  if (ritual.iniciativaMapaId) useMapStore.getState().removeInitiative(ritual.iniciativaMapaId);

  const mapa = useMapStore.getState();
  const aindaNaIniciativa = mapa.initiative.entries.some(entry => entry.entityId === entityId);
  const referenciadoPorOutroRitual = useCharacterStore.getState().characters.some(ficha =>
    (ficha.rituaisDezSombras ?? []).some(outro =>
      outro.id !== ritual.id && outro.entidadeMapaId === entityId &&
      (outro.estado === 'solicitado' || outro.estado === 'em_andamento'),
    ),
  );
  const entidade = mapa.entities[entityId];
  const criadaPorEsteRitual = entidade && (!entidade.ritualId || entidade.ritualId === ritual.id);
  if (criadaPorEsteRitual && !aindaNaIniciativa && !referenciadoPorOutroRitual) {
    mapa.removeEntities([entityId]);
  }
}

export function RituaisDezSombrasSection({ character }: Props) {
  const isMaster = useRoleStore(state => state.role === 'MASTER');
  const profileId = useProfileStore(state => state.activeProfileId ?? undefined);
  const updateCharacter = useCharacterStore(state => state.updateCharacter);
  const entidadesMapa = useMapStore(state => state.entities);
  const [mensagem, setMensagem] = useState('');
  const [erro, setErro] = useState('');

  const catalogo = character.invocacoesConhecidas ?? [];
  const rituais = character.rituaisDezSombras ?? [];
  const alvos = useMemo(() => catalogo.filter(invocacao =>
    invocacao.pacoteRegras === 'dez-sombras' && invocacao.domado === false && !invocacao.perdaPermanente,
  ), [catalogo]);
  const historico = useMemo(() => [...rituais].sort((a, b) => b.solicitadoEm.localeCompare(a.solicitadoEm)), [rituais]);

  const avisar = (texto: string) => {
    setMensagem(texto);
    setErro('');
  };

  const falhar = (texto: string) => {
    setErro(texto);
    setMensagem('');
  };

  const solicitarRitual = (invocacaoId: string) => {
    const atual = resolverCharacter(character.id);
    const invocacoes = atual?.invocacoesConhecidas ?? [];
    const alvo = invocacoes.find(item => item.id === invocacaoId);
    if (!atual || !alvo) return falhar('A ficha mudou. Atualize a tela e tente novamente.');
    if (!ritualPodeComecar(alvo, invocacoes)) return falhar('Os requisitos deste ritual ainda não foram atendidos.');
    if (ritualAtivoParaAlvo(atual.rituaisDezSombras ?? [], invocacaoId)) return falhar('Já existe uma solicitação ou tentativa aberta para esta sombra.');

    const tipo = tipoRitualDezSombras(alvo);
    if (!tipo) return falhar('Esta sombra não precisa de um novo ritual.');
    updateCharacter(character.id, {
      rituaisDezSombras: [...(atual.rituaisDezSombras ?? []), novoRitual(alvo, tipo, profileId)],
    });
    avisar(`Solicitação de ritual para ${alvo.apelido?.trim() || alvo.nome} enviada ao Mestre.`);
  };

  const iniciarRitual = (invocacaoId: string, modo: 'mapa' | 'manual') => {
    const atual = resolverCharacter(character.id);
    const invocacoes = atual?.invocacoesConhecidas ?? [];
    const alvo = invocacoes.find(item => item.id === invocacaoId);
    if (!atual || !alvo) return falhar('A ficha mudou. Atualize a tela e tente novamente.');
    if (!ritualPodeComecar(alvo, invocacoes)) return falhar('Os requisitos deste ritual ainda não foram atendidos.');
    const tipo = tipoRitualDezSombras(alvo);
    if (!tipo) return falhar('Esta sombra não precisa de um novo ritual.');

    const atualAtivo = ritualAtivoParaAlvo(atual.rituaisDezSombras ?? [], invocacaoId);
    if (atualAtivo?.estado === 'em_andamento') return falhar('Esta tentativa já está em andamento.');

    const base = atualAtivo ?? novoRitual(alvo, tipo, profileId);
    let entidadeMapaId: string | undefined;
    let iniciativaMapaId: string | undefined;

    if (modo === 'mapa') {
      const mapa = useMapStore.getState();
      const area = typeof document !== 'undefined'
        ? document.querySelector<HTMLElement>('[data-map-viewport]')
        : null;
      const largura = area && area.clientWidth > 0 ? area.clientWidth : window.innerWidth;
      const altura = area && area.clientHeight > 0 ? area.clientHeight : window.innerHeight;
      const escala = mapa.camera.scale || 1;
      const encontrosAbertos = (atual.rituaisDezSombras ?? []).filter(item =>
        item.estado === 'em_andamento' && item.modo === 'mapa' && item.entidadeMapaId,
      ).length;
      const deslocamento = (encontrosAbertos % 3) * 82;
      const nomeAlvo = alvo.apelido?.trim() || alvo.nome;
      const tamanho = 68;
      const centroX = largura / (2 * escala) - mapa.camera.x;
      const centroY = altura / (2 * escala) - mapa.camera.y;
      entidadeMapaId = mapa.addEntity({
        shape: alvo.formaToken ?? 'ELLIPSE',
        x: centroX - tamanho / 2 + deslocamento,
        y: centroY - tamanho / 2,
        w: tamanho,
        h: tamanho,
        rotation: 0,
        color: `hsl(${getComputedStyle(document.documentElement).getPropertyValue('--primary').trim()})`,
        locked: false,
        label: nomeAlvo,
        layer: 'tokens',
        nameplate: true,
        ritualId: base.id,
        hp: alvo.hpMaximo,
        hpMax: alvo.hpMaximo,
        ...(alvo.imagemAssetId ? { assetId: alvo.imagemAssetId } : {}),
        ...(alvo.imagemFallbackAssetId ? { invocationFallbackAssetId: alvo.imagemFallbackAssetId } : {}),
      });
      const iniciativaId = mapa.addInitiativeFromEntity(entidadeMapaId, { side: 'enemy' });
      if (iniciativaId) mapa.updateInitiative(iniciativaId, { name: `${nomeAlvo} · DEF ${alvo.defesa}` });
      iniciativaMapaId = iniciativaId ?? undefined;
      mapa.setSelected([entidadeMapaId]);
      mapa.setInitiativeOpen(true);
    }

    const emAndamento: RitualDezSombras = {
      ...base,
      tipo,
      estado: 'em_andamento',
      modo,
      iniciadoEm: new Date().toISOString(),
      ...(profileId ? { iniciadoPorProfileId: profileId } : {}),
      ...(entidadeMapaId ? { entidadeMapaId } : {}),
      ...(iniciativaMapaId ? { iniciativaMapaId } : {}),
    };
    updateCharacter(character.id, {
      rituaisDezSombras: [
        ...(atual.rituaisDezSombras ?? []).filter(item => item.id !== base.id),
        emAndamento,
      ],
    });

    if (modo === 'mapa') {
      avisar(`${emAndamento.alvoNomeSnapshot} foi colocado no mapa e na iniciativa. Adicione os combatentes e use o fluxo normal do rastreador.`);
      window.dispatchEvent(new CustomEvent('app:navigate', { detail: 'mapa' }));
    } else {
      avisar(`Resolução manual de ${emAndamento.alvoNomeSnapshot} iniciada. O Mestre registra o resultado abaixo.`);
    }
  };

  const finalizarRitual = (ritualId: string, resultado: 'concluido' | 'falhou' | 'cancelado') => {
    const atual = resolverCharacter(character.id);
    if (!atual) return falhar('Não foi possível localizar a ficha atual.');
    const registros = atual.rituaisDezSombras ?? [];
    const ritual = registros.find(item => item.id === ritualId);
    if (!ritual || (ritual.estado !== 'solicitado' && ritual.estado !== 'em_andamento')) return;
    const invocacoes = atual.invocacoesConhecidas ?? [];
    if (resultado === 'concluido' && !ritualPodeSerConcluido(ritual, invocacoes)) {
      return falhar('Não é possível confirmar a vitória: confira os requisitos atuais do ritual.');
    }

    const atualizado: RitualDezSombras = {
      ...ritual,
      estado: resultado,
      resolvidoEm: new Date().toISOString(),
      ...(profileId ? { resolvidoPorProfileId: profileId } : {}),
    };
    const proximosRituais = registros.map(item => item.id === ritualId ? atualizado : item);
    const invocacoesAtualizadas = resultado === 'concluido'
      ? invocacoes.map(item => item.id === ritual.alvoInvocacaoId ? { ...item, domado: true } : item)
      : invocacoes;

    updateCharacter(character.id, {
      rituaisDezSombras: proximosRituais,
      ...(resultado === 'concluido' ? { invocacoesConhecidas: invocacoesAtualizadas } : {}),
    });
    limparAlvoDoMapa(ritual);

    if (resultado === 'concluido') {
      const alvo = invocacoes.find(item => item.id === ritual.alvoInvocacaoId);
      const aguardandoAprovacao = alvo?.aprovacaoMestre !== 'aprovada';
      avisar(`Ritual de ${ritual.alvoNomeSnapshot} concluído${aguardandoAprovacao ? '; a aprovação da ficha ainda segue o fluxo do Mestre' : ''}.`);
    } else if (resultado === 'falhou') {
      avisar(`Falha registrada para ${ritual.alvoNomeSnapshot}. A sombra continua não domada.`);
    } else {
      avisar(`Ritual de ${ritual.alvoNomeSnapshot} cancelado.`);
    }
  };

  const pacotePresente = catalogo.some(invocacao => invocacao.pacoteRegras === 'dez-sombras');
  const pendencias = historico.filter(ritual => ritual.estado === 'solicitado' || ritual.estado === 'em_andamento');

  return (
    <section className="rituals-panel" aria-labelledby="rituals-title">
      <header className="rituals-header">
        <div>
          <h2 id="rituals-title">Rituais de Dez Sombras</h2>
          <p>Solicite a domesticação de uma sombra ou prepare uma quimera com os componentes domados.</p>
        </div>
        {pendencias.length > 0 && <span className="rituals-open-count">{pendencias.length} em aberto</span>}
      </header>

      {(mensagem || erro) && <p className="rituals-feedback" role={erro ? 'alert' : 'status'} aria-live="polite">{erro || mensagem}</p>}

      {!pacotePresente ? (
        <div className="rituals-empty">
          <Swords aria-hidden="true" size={22} />
          <h3>Dez Sombras ainda não está nesta ficha</h3>
          <p>Peça ao Mestre para adicionar o pacote à ficha do personagem. Ele não precisa liberar o Catálogo para isso.</p>
        </div>
      ) : alvos.length === 0 ? (
        <div className="rituals-empty">
          <Check aria-hidden="true" size={22} />
          <h3>Nenhum ritual pendente</h3>
          <p>As sombras disponíveis nesta ficha já estão domadas ou foram arquivadas.</p>
        </div>
      ) : (
        <ul className="rituals-list" aria-label="Rituais disponíveis">
          {alvos.map(invocacao => {
            const tipo = tipoRitualDezSombras(invocacao);
            if (!tipo) return null;
            const atual = ritualAtivoParaAlvo(rituais, invocacao.id);
            const componentes = tipo === 'quimera' ? requisitosComponentesQuimera(invocacao, catalogo) : [];
            const requisitosAtendidos = tipo !== 'quimera' || ritualPodeComecar(invocacao, catalogo);
            const ritualEmAndamento = atual?.estado === 'em_andamento';
            const nome = invocacao.apelido?.trim() || invocacao.nome;
            const mapaAlvoAusente = Boolean(ritualEmAndamento && atual?.modo === 'mapa' && atual.entidadeMapaId && !entidadesMapa[atual.entidadeMapaId]);

            return (
              <li key={invocacao.id} className="rituals-item">
                <div className="rituals-item-main">
                  <div className="rituals-item-heading">
                    <div>
                      <h3>{nome}</h3>
                      <p>{tipo === 'quimera' ? 'Ritual de quimera' : 'Ritual de domesticação individual'}</p>
                    </div>
                    <span role="status" aria-live="off" className={`rituals-state${atual ? ` is-${atual.estado}` : requisitosAtendidos ? ' is-ready' : ' is-blocked'}`}>
                      {atual ? LABEL_ESTADO[atual.estado] : requisitosAtendidos ? 'Pronto para solicitar' : 'Requisitos pendentes'}
                    </span>
                  </div>

                  {tipo === 'quimera' && (
                    <ul className="rituals-requirements" aria-label={`Componentes necessários para ${nome}`}>
                      {componentes.map(componente => {
                        const atendido = componente.encontrado && componente.domado;
                        return (
                          <li key={componente.id} data-complete={atendido}>
                            {atendido ? <Check aria-hidden="true" size={14} /> : <Circle aria-hidden="true" size={14} />}
                            <span>{componente.nome}</span>
                            <span className="rituals-requirement-state">{!componente.encontrado ? 'não incluído' : atendido ? 'domado' : 'pendente'}</span>
                          </li>
                        );
                      })}
                    </ul>
                  )}

                  {atual && <p className="rituals-attempt-meta">
                    {atual.modo ? `${LABEL_MODO[atual.modo]} · ` : ''}{formatarData(atual.iniciadoEm || atual.solicitadoEm)}
                  </p>}
                  {mapaAlvoAusente && <p className="rituals-notice">O adversário foi removido do mapa. O Mestre ainda pode registrar o resultado ou cancelar esta tentativa.</p>}

                  <div className="rituals-actions">
                    {!isMaster && !atual && (
                        <button type="button" className="inv-primary" disabled={!requisitosAtendidos} aria-disabled={!requisitosAtendidos} title={!requisitosAtendidos ? 'Domine todos os componentes listados para liberar o ritual.' : undefined} onClick={() => solicitarRitual(invocacao.id)}>
                        Solicitar ritual
                      </button>
                    )}
                    {isMaster && !atual && (
                      <>
                        <button type="button" className="inv-primary" disabled={!requisitosAtendidos} aria-disabled={!requisitosAtendidos} title={!requisitosAtendidos ? 'Domine todos os componentes listados para liberar o ritual.' : undefined} onClick={() => iniciarRitual(invocacao.id, 'mapa')}>
                          <MapPin aria-hidden="true" size={15} /> Preparar no mapa
                        </button>
                        <button type="button" className="inv-secondary" disabled={!requisitosAtendidos} aria-disabled={!requisitosAtendidos} title={!requisitosAtendidos ? 'Domine todos os componentes listados para liberar o ritual.' : undefined} onClick={() => iniciarRitual(invocacao.id, 'manual')}>
                          Resolver manualmente
                        </button>
                      </>
                    )}
                    {isMaster && atual?.estado === 'solicitado' && (
                      <>
                        <button type="button" className="inv-primary" disabled={!requisitosAtendidos} aria-disabled={!requisitosAtendidos} title={!requisitosAtendidos ? 'Domine todos os componentes listados para liberar o ritual.' : undefined} onClick={() => iniciarRitual(invocacao.id, 'mapa')}>
                          <MapPin aria-hidden="true" size={15} /> Preparar no mapa
                        </button>
                        <button type="button" className="inv-secondary" disabled={!requisitosAtendidos} aria-disabled={!requisitosAtendidos} title={!requisitosAtendidos ? 'Domine todos os componentes listados para liberar o ritual.' : undefined} onClick={() => iniciarRitual(invocacao.id, 'manual')}>
                          Resolver manualmente
                        </button>
                        <button type="button" className="rituals-text-action" onClick={() => finalizarRitual(atual.id, 'cancelado')}>Cancelar solicitação</button>
                      </>
                    )}
                    {isMaster && ritualEmAndamento && (
                      <>
                        <button type="button" className="inv-primary" onClick={() => finalizarRitual(atual.id, 'concluido')}>Confirmar vitória</button>
                        <button type="button" className="inv-secondary" onClick={() => finalizarRitual(atual.id, 'falhou')}>Registrar falha</button>
                        <button type="button" className="rituals-text-action" onClick={() => finalizarRitual(atual.id, 'cancelado')}>Cancelar ritual</button>
                      </>
                    )}
                    {!isMaster && atual && <p className="rituals-player-status">
                      {atual.estado === 'solicitado'
                        ? 'O Mestre precisa escolher como conduzir este ritual.'
                        : `${atual.modo === 'mapa' ? 'A luta está preparada no mapa.' : 'O Mestre está resolvendo o ritual.'} Aguarde o registro do resultado.`}
                    </p>}
                    {isMaster && !requisitosAtendidos && !atual && <p className="rituals-notice">Domine todos os componentes listados para liberar o ritual de quimera.</p>}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {historico.length > 0 && (
        <details className="rituals-history">
          <summary>Histórico de rituais <span>{historico.length}</span></summary>
          <ul>
            {historico.map(ritual => (
              <li key={ritual.id}>
                <span>{ritual.alvoNomeSnapshot}</span>
                <span className={`rituals-state is-${ritual.estado}`}>{LABEL_ESTADO[ritual.estado]}</span>
                <span>{ritual.modo ? LABEL_MODO[ritual.modo] : 'Solicitação'}</span>
                <time dateTime={ritual.resolvidoEm || ritual.solicitadoEm}>{formatarData(ritual.resolvidoEm || ritual.solicitadoEm)}</time>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

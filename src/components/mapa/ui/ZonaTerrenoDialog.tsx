import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useMapStore, type Entity, type GatilhoZonaTerreno } from '@/stores/useMapStore';
import type { CombatEffect } from '@/lib/omni/tipos';

const efeitoPadrao = (): CombatEffect => ({
  id: crypto.randomUUID(),
  formula: '1d6',
  type: 'SUBTRAIR',
  target: 'ALVO',
  resourcePath: 'vida_atual',
  damageType: 'Cortante',
});

export function ZonaTerrenoDialog({ entityId, onClose }: { entityId: string | null; onClose: () => void }) {
  const entity = useMapStore((s) => entityId ? s.entities[entityId] : undefined);
  const updateEntity = useMapStore((s) => s.updateEntity);
  const pushHistory = useMapStore((s) => s.pushHistory);
  const [duracao, setDuracao] = useState('1');
  const [gatilhos, setGatilhos] = useState<GatilhoZonaTerreno[]>(['entrada']);
  const [efeitos, setEfeitos] = useState<CombatEffect[]>([]);

  useEffect(() => {
    const zona = entity?.terrainZone;
    setDuracao(zona?.duracaoRodadas == null ? '' : String(zona.duracaoRodadas));
    setGatilhos(zona?.gatilhos ?? ['entrada']);
    setEfeitos(zona?.efeitos ?? []);
  }, [entity?.id, entity?.terrainZone]);

  const toggleGatilho = (gatilho: GatilhoZonaTerreno) => {
    setGatilhos((atual) => atual.includes(gatilho) ? atual.filter((x) => x !== gatilho) : [...atual, gatilho]);
  };
  const atualizarEfeito = (id: string, patch: Partial<CombatEffect>) => {
    setEfeitos((atual) => atual.map((efeito) => efeito.id === id ? { ...efeito, ...patch } : efeito));
  };
  const adicionarCondicao = (id: string, enabled: boolean) => {
    setEfeitos((atual) => atual.map((efeito) => {
      if (efeito.id !== id) return efeito;
      if (enabled) return { ...efeito, formula: '0', conditionApply: { id: 'caido', mode: 'apply', durationRounds: 1 } };
      const { conditionApply: _conditionApply, ...resto } = efeito;
      return { ...resto, formula: '1d6' };
    }));
  };
  const salvar = () => {
    if (!entity) return;
    const parsed = duracao.trim() ? Math.max(1, Math.floor(Number(duracao) || 1)) : null;
    const zonaAnterior = entity.terrainZone;
    const restantes = parsed === null ? null
      : zonaAnterior?.duracaoRodadas === parsed ? (zonaAnterior.rodadasRestantes ?? parsed) : parsed;
    pushHistory();
    updateEntity(entity.id, { terrainZone: { duracaoRodadas: parsed, rodadasRestantes: restantes, gatilhos, efeitos } });
    onClose();
  };
  const remover = () => {
    if (!entity) return;
    pushHistory();
    updateEntity(entity.id, { terrainZone: undefined });
    onClose();
  };

  return (
    <Dialog open={!!entityId && !!entity} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Zona de terreno</DialogTitle>
          <DialogDescription>
            A forma e a posição da entidade selecionada definem a área. Os efeitos disparam no Mestre quando um personagem entra nela ou termina o turno dentro dela.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="zona-duracao">Duração em rodadas</Label>
              <Input id="zona-duracao" type="number" min="1" value={duracao} onChange={(event) => setDuracao(event.target.value)} placeholder="Vazio = permanente" />
            </div>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Gatilhos</legend>
              {(['entrada', 'fim_turno'] as const).map((gatilho) => (
                <label key={gatilho} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={gatilhos.includes(gatilho)} onChange={() => toggleGatilho(gatilho)} />
                  {gatilho === 'entrada' ? 'Ao entrar na área' : 'Ao terminar o turno dentro da área'}
                </label>
              ))}
            </fieldset>
          </div>

          <section className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold">Efeitos OMNI</h3>
                <p className="text-xs text-muted-foreground">Use fórmulas e caminhos de recurso do sistema, ou aplique uma condição.</p>
              </div>
              <Button type="button" size="sm" variant="outline" onClick={() => setEfeitos((atual) => [...atual, efeitoPadrao()])}>Adicionar efeito</Button>
            </div>

            {efeitos.length === 0 ? (
              <p className="rounded border border-border p-3 text-xs text-muted-foreground">Nenhum efeito configurado.</p>
            ) : efeitos.map((efeito) => (
              <div key={efeito.id} className="space-y-2 rounded border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <label className="flex items-center gap-2 text-xs">
                    <input type="checkbox" checked={!!efeito.conditionApply} onChange={(event) => adicionarCondicao(efeito.id, event.target.checked)} />
                    Aplicar condição
                  </label>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setEfeitos((atual) => atual.filter((x) => x.id !== efeito.id))}>Remover</Button>
                </div>

                {efeito.conditionApply ? (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <div className="space-y-1 sm:col-span-2">
                      <Label>Id da condição</Label>
                      <Input value={efeito.conditionApply.id} onChange={(event) => atualizarEfeito(efeito.id, { conditionApply: { ...efeito.conditionApply!, id: event.target.value } })} placeholder="caido" />
                    </div>
                    <div className="space-y-1">
                      <Label>Duração (rodadas)</Label>
                      <Input type="number" min="-1" value={efeito.conditionApply.durationRounds ?? 1} onChange={(event) => atualizarEfeito(efeito.id, { conditionApply: { ...efeito.conditionApply!, durationRounds: Number(event.target.value) || 1 } })} />
                    </div>
                    <div className="space-y-1">
                      <Label>Ação</Label>
                      <select className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={efeito.conditionApply.mode} onChange={(event) => atualizarEfeito(efeito.id, { conditionApply: { ...efeito.conditionApply!, mode: event.target.value as 'apply' | 'remove' } })}>
                        <option value="apply">Aplicar</option>
                        <option value="remove">Remover</option>
                      </select>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label>Fórmula</Label>
                      <Input value={efeito.formula} onChange={(event) => atualizarEfeito(efeito.id, { formula: event.target.value })} placeholder="2d6 + @USUARIO.treino" />
                    </div>
                    <div className="space-y-1">
                      <Label>Tipo</Label>
                      <select className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={efeito.type} onChange={(event) => atualizarEfeito(efeito.id, { type: event.target.value as CombatEffect['type'] })}>
                        <option value="SUBTRAIR">Dano</option>
                        <option value="ADICIONAR">Cura / recurso</option>
                        <option value="MODIFICADOR">Modificador</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label>Recurso do alvo</Label>
                      <Input value={efeito.resourcePath ?? 'vida_atual'} onChange={(event) => atualizarEfeito(efeito.id, { resourcePath: event.target.value })} placeholder="vida_atual" />
                    </div>
                    <div className="space-y-1">
                      <Label>Tipo de dano (opcional)</Label>
                      <Input value={efeito.damageType ?? ''} onChange={(event) => atualizarEfeito(efeito.id, { damageType: event.target.value || undefined })} placeholder="Fogo" />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </section>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {entity?.terrainZone ? <Button type="button" variant="destructive" onClick={remover}>Remover zona</Button> : <span />}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="button" onClick={salvar}>Salvar zona</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

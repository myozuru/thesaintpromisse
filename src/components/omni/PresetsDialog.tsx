/**
 * Modal de Presets do Omni-Engine.
 *
 * Lê `/omni-presets/index.json`, lista pacotes prontos, baixa e importa
 * via `useOmniEntidadesStore.importarPacote` (sempre em modo "mesclar").
 */
import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Package, Download } from 'lucide-react';
import { useOmniEntidadesStore } from '@/stores/useOmniEntidadesStore';
import { PacoteOmniSchema } from '@/lib/omni/validacao';
import { useToast } from '@/hooks/use-toast';
import type { PacoteOmni } from '@/lib/omni/tipos';

interface PresetIndexEntry {
  id: string;
  nome: string;
  descricao: string;
  arquivo: string;
}

interface PresetIndex {
  formato: 'omni-presets-index.v1';
  presets: PresetIndexEntry[];
}

interface Props {
  aberto: boolean;
  onClose: () => void;
}

export function PresetsDialog({ aberto, onClose }: Props) {
  const { toast } = useToast();
  const importar = useOmniEntidadesStore((s) => s.importarPacote);
  const [index, setIndex] = useState<PresetIndex | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [importandoId, setImportandoId] = useState<string | null>(null);

  useEffect(() => {
    if (!aberto) return;
    setCarregando(true);
    setErro(null);
    fetch('/omni-presets/index.json')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: PresetIndex) => setIndex(data))
      .catch((e) => setErro((e as Error).message))
      .finally(() => setCarregando(false));
  }, [aberto]);

  const importarPreset = async (preset: PresetIndexEntry) => {
    setImportandoId(preset.id);
    try {
      const r = await fetch(preset.arquivo);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const raw = await r.json();
      const parsed = PacoteOmniSchema.safeParse(raw);
      if (!parsed.success) {
        toast({
          title: 'Pacote inválido',
          description: parsed.error.issues[0]?.message ?? 'Schema não bate.',
          variant: 'destructive',
        });
        return;
      }
      const n = importar(parsed.data as unknown as PacoteOmni, 'mesclar');
      toast({ title: 'Preset importado', description: `${n} entidade(s) de "${preset.nome}".` });
    } catch (e) {
      toast({
        title: 'Falha ao importar preset',
        description: (e as Error).message,
        variant: 'destructive',
      });
    } finally {
      setImportandoId(null);
    }
  };

  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Biblioteca de Presets
          </DialogTitle>
        </DialogHeader>

        {carregando && (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Carregando…
          </div>
        )}

        {erro && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            Falha ao carregar índice: {erro}
          </div>
        )}

        {index && index.presets.length === 0 && (
          <div className="text-sm text-muted-foreground py-4">Nenhum preset disponível.</div>
        )}

        {index && index.presets.length > 0 && (
          <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
            {index.presets.map((p) => (
              <div
                key={p.id}
                className="rounded-md border border-border/60 bg-card/80 p-3 flex items-start gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-foreground">{p.nome}</div>
                  <p className="text-xs text-muted-foreground mt-0.5">{p.descricao}</p>
                </div>
                <Button
                  size="sm"
                  onClick={() => importarPreset(p)}
                  disabled={importandoId === p.id}
                  className="shrink-0"
                >
                  {importandoId === p.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                  ) : (
                    <Download className="h-3.5 w-3.5 mr-1" />
                  )}
                  Importar
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end pt-2 border-t border-border/60">
          <Button variant="ghost" onClick={onClose}>Fechar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

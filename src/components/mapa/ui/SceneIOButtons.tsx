/**
 * SceneIOButtons — Fase 10.
 *
 * Botões de Importar/Exportar cenas no MapTopBar. Exporta a cena ativa
 * ou todas as cenas como um único JSON portátil contendo blobs de assets.
 */
import { useRef } from 'react';
import { Download, Upload, FolderDown } from 'lucide-react';
import { toast } from 'sonner';
import { useMapStore } from '@/stores/useMapStore';
import { RadioIconButton } from './RadioIconButton';
import { buildBundle, buildFullBackup, downloadBundle, downloadFullBackup, importBundle, restoreFullBackup, type FullBackupV2, type SceneBundleV1 } from '../sceneIO';

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'cena';
}

export function SceneIOButtons() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const getSceneSnapshot = useMapStore((s) => s.getSceneSnapshot);
  const getAllSceneSnapshots = useMapStore((s) => s.getAllSceneSnapshots);
  const importScenes = useMapStore((s) => s.importScenes);
  const activeId = useMapStore((s) => s.activeSceneId);

  const exportActive = async () => {
    const sc = getSceneSnapshot(activeId);
    if (!sc) return;
    try {
      const bundle = await buildBundle([sc]);
      downloadBundle(bundle, `${slug(sc.name)}.scene.json`);
      toast.success(`Cena "${sc.name}" exportada.`);
    } catch (e) {
      toast.error('Falha ao exportar cena.');
      console.error(e);
    }
  };

  const exportAll = async () => {
    const all = getAllSceneSnapshots();
    if (!all.length) return;
    try {
      const bundle = await buildBundle(all);
      const stamp = new Date().toISOString().slice(0, 10);
      downloadBundle(bundle, `cenas-${stamp}.scenes.json`);
      toast.success(`${all.length} cena(s) exportada(s).`);
    } catch (e) {
      toast.error('Falha ao exportar cenas.');
      console.error(e);
    }
  };

  const exportFullBackup = async () => {
    const all = getAllSceneSnapshots();
    try {
      const backup = await buildFullBackup(all);
      const stamp = new Date().toISOString().slice(0, 10);
      downloadFullBackup(backup, `backup-completo-${stamp}.json`);
      toast.success('Backup completo exportado.');
    } catch (e) {
      toast.error('Falha ao exportar backup completo.');
      console.error(e);
    }
  };

  const onPickFile = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as SceneBundleV1 | FullBackupV2;
      if ('kind' in parsed && parsed.kind === 'full-app-backup') {
        await restoreFullBackup(parsed);
        toast.success('Backup completo restaurado. Recarregue a página para aplicar tudo.');
        return;
      }
      const bundle = parsed as SceneBundleV1;
      const s = useMapStore.getState();
      const existingIds = new Set(s.sceneOrder);
      const existingNames = new Set(s.sceneOrder.map((id) => s.scenes[id]?.name).filter(Boolean) as string[]);
      const { scenes } = await importBundle(bundle, existingIds, existingNames);
      if (!scenes.length) {
        toast.error('Nenhuma cena encontrada no arquivo.');
        return;
      }
      importScenes(scenes);
      toast.success(`${scenes.length} cena(s) importada(s).`);
    } catch (e) {
      console.error(e);
      toast.error('Arquivo inválido ou corrompido.');
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPickFile(f);
          e.target.value = '';
        }}
      />
      <RadioIconButton
        variant="ghost"
        title="Exportar cena ativa"
        active={false}
        onClick={exportActive}
      >
        <Download className="h-4 w-4" />
      </RadioIconButton>
      <RadioIconButton
        variant="ghost"
        title="Exportar todas as cenas"
        active={false}
        onClick={exportAll}
      >
        <FolderDown className="h-4 w-4" />
      </RadioIconButton>
      <RadioIconButton
        variant="ghost"
        title="Backup completo do sistema"
        active={false}
        onClick={exportFullBackup}
      >
        <Download className="h-4 w-4" />
      </RadioIconButton>
      <RadioIconButton
        variant="ghost"
        title="Importar cenas ou restaurar backup (.json)"
        active={false}
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="h-4 w-4" />
      </RadioIconButton>
    </>
  );
}

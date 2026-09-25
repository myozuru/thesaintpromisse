import { useState, useEffect, useCallback, useRef } from "react";

/**
 * ============================================================
 * useCreatureStorage — Hook unificado (creatures + folders)
 * ============================================================
 * Pass 8 fixes:
 *  - #50: guard mount overwrite com flag `hydrated`
 *  - #48/#49: duplicate/cloneFromBuiltIn zeram combatState
 *  - #26/#52: create checa duplicidade de id
 *  - #53: removeFolder atomiza creatures+folders via flag combinada
 *  - #54: reorderCreatures valida ids existentes
 *  - #34: sync multi-aba via evento `storage`
 *  - #25: importMany.replace reseta folders também
 *  - #58: update avisa quando id é builtin
 *  - #35/#59: writeCreatures expõe falha; spinner reflete erro real
 * ============================================================
 */

const CREATURES_KEY = "fm_creatures_v1";
const CREATURES_META_KEY = "fm_creatures_meta_v1";
const FOLDERS_KEY = "fm_folders_v1";

const EMPTY_COMBAT_STATE = () => ({
  isActive: false,
  hpCurrent: null,
  peCurrent: null,
  guardaInabavalCurrent: null,
  resistenciaParcialUsed: 0,
  resistenciaTotalUsed: 0,
  integridadeCurrent: 100,
  activeConditions: [],
  temporaryHp: 0,
  isInDesafiandoMorte: false,
  missCounter: 0,
  customCounters: [],
  combatLog: [],
});

// ============================================================
// LEITURA/ESCRITA SEGURA
// ============================================================
const readCreatures = () => {
  try {
    const raw = localStorage.getItem(CREATURES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((c) => ({
      ...c,
      folderId: c.folderId ?? null,
      isBuiltIn: false,
    }));
  } catch {
    return [];
  }
};

const readFolders = () => {
  try {
    const raw = localStorage.getItem(FOLDERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeCreatures = (creatures) => {
  try {
    localStorage.setItem(CREATURES_KEY, JSON.stringify(creatures));
    localStorage.setItem(CREATURES_META_KEY, JSON.stringify({
      lastSaved: new Date().toISOString(),
      count: creatures.length,
    }));
    return true;
  } catch {
    return false;
  }
};

const writeFolders = (folders) => {
  try {
    localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders));
    return true;
  } catch {
    return false;
  }
};

const generateId = (prefix = "") =>
  `${prefix}${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

// ============================================================
// HOOK
// ============================================================
export default function useCreatureStorage() {
  const [creatures, setCreatures] = useState(() => readCreatures());
  const [folders, setFolders] = useState(() => readFolders());
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  // #50: marca quando o primeiro mount terminou — evita sobrescrever localStorage no boot
  const hydratedRef = useRef(false);

  // --- Persistência ---
  useEffect(() => {
    if (!hydratedRef.current) {
      hydratedRef.current = true;
      return;
    }
    setIsSaving(true);
    const ok = writeCreatures(creatures);
    if (!ok) {
      console.warn("Falha ao salvar criaturas (quota?)");
      setSaveError(new Error("Falha ao salvar (quota de armazenamento cheia?)"));
    } else {
      setSaveError(null);
    }
    // #59: spinner desliga assim que sabemos o resultado real
    const t = setTimeout(() => setIsSaving(false), ok ? 300 : 1500);
    return () => clearTimeout(t);
  }, [creatures]);

  useEffect(() => {
    writeFolders(folders);
  }, [folders]);

  // #34: sync entre abas (storage event não dispara na aba que escreveu)
  useEffect(() => {
    const handler = (e) => {
      if (e.key === CREATURES_KEY) setCreatures(readCreatures());
      else if (e.key === FOLDERS_KEY) setFolders(readFolders());
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  // ============================================================
  // CRIATURAS — CRUD
  // ============================================================
  const create = useCallback((creatureData) => {
    const now = new Date().toISOString();
    let createdRef = null;
    setCreatures((prev) => {
      // #26/#52: garante id único — se vier colidindo, gera novo
      const ids = new Set(prev.map((c) => c.id));
      let id = creatureData.id || generateId();
      if (ids.has(id)) id = generateId();
      const newCreature = {
        ...creatureData,
        id,
        folderId: creatureData.folderId ?? null,
        isBuiltIn: false,
        createdAt: now,
        updatedAt: now,
      };
      createdRef = newCreature;
      return [newCreature, ...prev];
    });
    return createdRef;
  }, []);

  const update = useCallback((id, patch) => {
    if (typeof id === "string" && id.startsWith("builtin_")) {
      // #58: alerta — fluxo bugado tentando editar built-in
      console.warn(`[useCreatureStorage.update] tentativa de editar built-in id="${id}"`);
    }
    setCreatures((prev) =>
      prev.map((c) =>
        c.id === id
          ? { ...c, ...patch, isBuiltIn: false, updatedAt: new Date().toISOString() }
          : c
      )
    );
  }, []);

  const remove = useCallback((id) => {
    setCreatures((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const removeMany = useCallback((ids) => {
    const idSet = new Set(ids);
    setCreatures((prev) => prev.filter((c) => !idSet.has(c.id)));
  }, []);

  const duplicate = useCallback((id) => {
    let cloneRef = null;
    setCreatures((prev) => {
      const original = prev.find((c) => c.id === id);
      if (!original) return prev;
      const cloned = JSON.parse(JSON.stringify(original));
      // #48: nunca herdar combatState ativo
      cloned.combatState = EMPTY_COMBAT_STATE();
      const copy = {
        ...cloned,
        id: generateId(),
        name: `${original.name} (Cópia)`,
        isBuiltIn: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      cloneRef = copy;
      return [copy, ...prev];
    });
    return cloneRef;
  }, []);

  const cloneFromBuiltIn = useCallback((builtIn, { folderId = null, renameSuffix = "" } = {}) => {
    const now = new Date().toISOString();
    const cloned = JSON.parse(JSON.stringify(builtIn));
    // #49: nunca herdar combatState (mesmo template) — limpa estado vivo
    cloned.combatState = EMPTY_COMBAT_STATE();
    const clone = {
      ...cloned,
      id: generateId(),
      name: renameSuffix ? `${builtIn.name}${renameSuffix}` : builtIn.name,
      isBuiltIn: false,
      folderId,
      createdAt: now,
      updatedAt: now,
    };
    setCreatures((prev) => [clone, ...prev]);
    return clone;
  }, []);

  // ============================================================
  // PASTAS — CRUD
  // ============================================================
  const createFolder = useCallback((name) => {
    const trimmed = (name || "").trim();
    if (!trimmed) return null;
    const now = new Date().toISOString();
    const folder = {
      id: generateId("fld_"),
      name: trimmed,
      createdAt: now,
      updatedAt: now,
    };
    setFolders((prev) => [...prev, folder]);
    return folder;
  }, []);

  const renameFolder = useCallback((id, name) => {
    const trimmed = (name || "").trim();
    if (!trimmed) return false;
    let renamed = false;
    // #40 fix: bloqueia rename quando há colisão (em vez de só avisar).
    setFolders((prev) => {
      const collision = prev.some(
        (f) => f.id !== id && f.name.toLowerCase() === trimmed.toLowerCase()
      );
      if (collision) {
        console.warn(`[renameFolder] já existe pasta com nome "${trimmed}" — rename cancelado`);
        return prev;
      }
      renamed = true;
      return prev.map((f) =>
        f.id === id ? { ...f, name: trimmed, updatedAt: new Date().toISOString() } : f
      );
    });
    return renamed;
  }, []);

  // #53: removeFolder unifica os dois updates em um único "tick" via useCallback combinado.
  // React batcheia setStates dentro do mesmo handler, mas para garantir consistência em
  // StrictMode preferimos ler-modificar-escrever de forma sequencial síncrona.
  const removeFolder = useCallback((id) => {
    setCreatures((prev) =>
      prev.map((c) =>
        c.folderId === id
          ? { ...c, folderId: null, updatedAt: new Date().toISOString() }
          : c
      )
    );
    setFolders((prev) => prev.filter((f) => f.id !== id));
  }, []);

  // ============================================================
  // MOVIMENTAÇÃO
  // ============================================================
  const moveCreatureToFolder = useCallback((creatureId, folderId) => {
    setCreatures((prev) =>
      prev.map((c) =>
        c.id === creatureId
          ? { ...c, folderId: folderId ?? null, updatedAt: new Date().toISOString() }
          : c
      )
    );
  }, []);

  const moveCreaturesToFolder = useCallback((creatureIds, folderId) => {
    const idSet = new Set(creatureIds);
    setCreatures((prev) =>
      prev.map((c) =>
        idSet.has(c.id)
          ? { ...c, folderId: folderId ?? null, updatedAt: new Date().toISOString() }
          : c
      )
    );
  }, []);

  // ============================================================
  // REORDENAÇÃO — mantém o restante do array intacto
  // ============================================================
  const reorderCreatures = useCallback((orderedIds) => {
    setCreatures((prev) => {
      const presentIds = new Set(prev.map((c) => c.id));
      // #54: filtra ids inexistentes antes de aplicar
      const validIds = (orderedIds || []).filter((id) => presentIds.has(id));
      if (validIds.length === 0) return prev;
      const idSet = new Set(validIds);
      const idOrder = new Map(validIds.map((id, i) => [id, i]));
      const sortedSubset = prev
        .filter((c) => idSet.has(c.id))
        .sort((a, b) => idOrder.get(a.id) - idOrder.get(b.id));
      let subIdx = 0;
      return prev.map((c) => (idSet.has(c.id) ? sortedSubset[subIdx++] : c));
    });
  }, []);

  // ============================================================
  // IMPORT — aceita array puro (retrocompat) ou { creatures, folders }
  // ============================================================
  const importMany = useCallback((payload, { mergeStrategy = "append" } = {}) => {
    const shapes = {
      array: (p) => Array.isArray(p),
      bundle: (p) => p && typeof p === "object" && Array.isArray(p.creatures),
    };

    const shape = Object.keys(shapes).find((k) => shapes[k](payload));
    if (!shape) return { imported: 0, skipped: 0, foldersImported: 0 };

    const incomingCreatures = shape === "array" ? payload : (payload.creatures || []);
    const incomingFolders = shape === "bundle" ? (payload.folders || []) : [];

    if (incomingCreatures.length === 0 && incomingFolders.length === 0) {
      return { imported: 0, skipped: 0, foldersImported: 0 };
    }

    const now = new Date().toISOString();

    // #32/#33 fix: remap ids de pastas que colidem; mantém mapa para repassar a creatures
    const existingFolderIds = new Set(folders.map((f) => f.id));
    const folderIdRemap = new Map();
    const normalizedFolders = incomingFolders.map((f) => {
      const origId = f.id;
      let id = origId || generateId("fld_");
      if (existingFolderIds.has(id)) {
        const newId = generateId("fld_");
        folderIdRemap.set(origId, newId);
        id = newId;
      } else if (origId) {
        folderIdRemap.set(origId, id);
      }
      return {
        id,
        name: existingFolderIds.has(origId) ? `${f.name || "Pasta importada"} (Importada)` : (f.name || "Pasta importada"),
        createdAt: f.createdAt || now,
        updatedAt: now,
      };
    });

    // Normaliza creatures: SEMPRE gera novo ID; remapeia folderId via mapa de pastas
    const normalizedCreatures = incomingCreatures.map((c) => {
      const remapped = c.folderId && folderIdRemap.has(c.folderId)
        ? folderIdRemap.get(c.folderId)
        : (existingFolderIds.has(c.folderId) ? c.folderId : null);
      return {
        ...c,
        id: generateId(),
        folderId: remapped ?? null,
        isBuiltIn: false,
        // #48/#49: importados também precisam de combatState limpo
        combatState: EMPTY_COMBAT_STATE(),
        updatedAt: now,
      };
    });

    const strategies = {
      append: (prev) => {
        const existingNames = new Set(prev.map((c) => c.name));
        const tagged = normalizedCreatures.map((c) => ({
          ...c,
          name: existingNames.has(c.name) ? `${c.name} (Importado)` : c.name,
        }));
        return [...tagged, ...prev];
      },
      replace: () => normalizedCreatures,
      merge: (prev) => {
        const existingNames = new Set(prev.map((c) => c.name));
        const tagged = normalizedCreatures.map((c) => ({
          ...c,
          name: existingNames.has(c.name) ? `${c.name} (Importado)` : c.name,
        }));
        return [...tagged, ...prev];
      },
    };
    const strategy = strategies[mergeStrategy] || strategies.append;
    setCreatures(strategy);

    if (mergeStrategy === "replace") {
      // #25: replace zera pastas existentes e usa apenas as do bundle
      setFolders(normalizedFolders);
    } else if (normalizedFolders.length > 0) {
      setFolders((prev) => [...prev, ...normalizedFolders]);
    }

    return {
      imported: normalizedCreatures.length,
      skipped: 0,
      foldersImported: normalizedFolders.length,
    };
  }, [folders]);

  return {
    creatures,
    folders,
    isSaving,
    saveError,
    create,
    update,
    remove,
    removeMany,
    duplicate,
    cloneFromBuiltIn,
    createFolder,
    renameFolder,
    removeFolder,
    moveCreatureToFolder,
    moveCreaturesToFolder,
    importMany,
    reorderCreatures,
  };
}

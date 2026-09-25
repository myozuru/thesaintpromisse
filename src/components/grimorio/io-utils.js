// Bug #15 fix: validação mínima de schema antes de exportar — evita gerar
// JSON corrompido por dados que vieram de uma versão antiga do app ou de
// objetos manipulados externamente (e que falhariam no re-import).
const isValidCreatureForExport = (c) => {
  if (!c || typeof c !== "object") return false;
  if (typeof c.name !== "string" || c.name.trim().length === 0) return false;
  if (c.core && typeof c.core !== "object") return false;
  if (c.attributes && typeof c.attributes !== "object") return false;
  return true;
};

export const exportCreaturesToFile = (creatures, filename, folders = []) => {
  if (!Array.isArray(creatures) || creatures.length === 0) {
    throw new Error("Nenhuma criatura para exportar.");
  }
  const invalid = creatures.filter((c) => !isValidCreatureForExport(c));
  if (invalid.length > 0) {
    const err = new Error(
      `Exportação bloqueada: ${invalid.length} criatura(s) com schema inválido.`
    );
    err.code = "INVALID_EXPORT_SCHEMA";
    err.invalidCount = invalid.length;
    throw err;
  }

  const payload = {
    version: "2.0",
    exportedAt: new Date().toISOString(),
    system: "Feiticeiros & Maldições 2.5",
    count: creatures.length,
    creatures,
    folders: Array.isArray(folders) ? folders : [],
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);

  // Bug #56 fix: fallback se primeira criatura não tem nome
  const firstName = creatures[0]?.name || "criatura";
  const defaultName =
    creatures.length === 1
      ? `${firstName.replace(/[^a-z0-9]/gi, "-").toLowerCase() || "criatura"}.json`
      : `grimorio-${creatures.length}-criaturas.json`;

  const a = document.createElement("a");
  a.href = url;
  a.download = filename || defaultName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const importFromFile = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const text = event.target.result;
        const parsed = JSON.parse(text);

        // Detecta se é array puro (v1) ou formato envelopado (v2)
        const isArray = Array.isArray(parsed);
        const creaturesData = isArray ? parsed : parsed.creatures;

        if (!Array.isArray(creaturesData)) {
          throw new Error("Formato inválido: criaturas não encontradas.");
        }

        const valid = creaturesData.map((c) => {
          if (!c.name || typeof c.name !== "string") {
            throw new Error(`Criatura inválida: ${JSON.stringify(c)}`);
          }
          const hasBuiltInId = typeof c.id === "string" && c.id.includes("builtin_");
          const safeId = !c.id || hasBuiltInId
            ? `imported_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`
            : c.id;
          return {
            ...c,
            id: safeId,
            isBuiltIn: false,
            // Bug #10 fix: preserva folderId — useCreatureStorage.importMany faz remap
            // se a pasta não existir; aqui só descarta valores claramente inválidos.
            folderId: typeof c.folderId === "string" ? c.folderId : null,
          };
        });

        const rawFolders = Array.isArray(parsed?.folders) ? parsed.folders : [];

        resolve({
          creatures: valid,
          folders: rawFolders,
          meta: isArray
            ? { format: "array-v1", importedAt: new Date().toISOString(), count: valid.length }
            : {
                format: "bundle-v2",
                system: parsed.system || "Desconhecido",
                exportedAt: parsed.exportedAt,
                count: valid.length,
              },
        });
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = () => {
      // Bug #57 fix: propaga código real do FileReader para a UI distinguir tipos de erro
      const err = new Error("Falha ao ler o arquivo.");
      err.cause = reader.error;
      err.code = reader.error?.name || "FILE_READ_ERROR";
      reject(err);
    };

    reader.readAsText(file);
  });
};
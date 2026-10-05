import React, { useState, useEffect, useRef } from "react";
import { X, Check, Upload, LoaderCircle, RotateCcw } from "lucide-react";
import { FieldLabel, TextInput, TextArea } from "../builder-controls";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

export default function SectionIdentity({ draft, actions }) {
  return (
    <div className="space-y-4">
      <div>
        <FieldLabel required>Nome da Criatura</FieldLabel>
        <TextInput
          value={draft.name}
          onChange={actions.setName}
          placeholder="Ex: Maldição da Varíola"
        />
      </div>

      <PortraitField
        value={draft.portraitUrl}
        settings={draft.portraitSettings}
        onChange={actions.setPortrait}
        onSettingsChange={actions.setPortraitSettings}
      />

      <div>
        <FieldLabel hint="Visível apenas para o narrador">
          Notas do Narrador
        </FieldLabel>
        <TextArea
          value={draft.narratorNotes}
          onChange={actions.setNotes}
          rows={3}
          placeholder="Descrição narrativa, táticas, hooks de história..."
        />
      </div>
    </div>
  );
}

const DEFAULT_PORTRAIT_SETTINGS = { zoom: 100, positionX: 50, positionY: 50, height: 160 };

async function prepareImage(file) {
  if (!file.type.startsWith("image/")) throw new Error("Escolha um arquivo de imagem.");
  if (file.size > 15 * 1024 * 1024) throw new Error("A imagem deve ter no máximo 15 MB.");

  const source = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = source;
    await image.decode();
    const scale = Math.min(1, 1200 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Não foi possível preparar a imagem.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.82);
  } finally {
    URL.revokeObjectURL(source);
  }
}

function PortraitField({ value, settings, onChange, onSettingsChange }) {
  const [draftUrl, setDraftUrl] = useState(value || "");
  const [imageError, setImageError] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef(null);
  const resolvedSettings = { ...DEFAULT_PORTRAIT_SETTINGS, ...(settings ?? {}) };

  // Sincroniza rascunho quando o pai carrega uma ficha existente
  useEffect(() => {
    setDraftUrl(value || "");
    setImageError(false);
  }, [value]);

  const handleInsert = () => {
    setImageError(false);
    onChange(draftUrl.trim());
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleInsert();
    }
  };

  const handleRemove = () => {
    setDraftUrl("");
    setImageError(false);
    onChange("");
  };

  const handleFile = async (file) => {
    if (!file) return;
    setUploading(true);
    setUploadError("");
    setImageError(false);
    try {
      const prepared = await prepareImage(file);
      setDraftUrl(prepared);
      onChange(prepared);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Não foi possível carregar a imagem.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const updateSetting = (key, nextValue) => onSettingsChange({ [key]: nextValue });

  return (
    <div>
      <FieldLabel hint="Clique no quadro para enviar uma imagem">
        Retrato da Criatura
      </FieldLabel>

      <div className="flex flex-col sm:flex-row gap-3">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="sr-only"
          onChange={(event) => handleFile(event.target.files?.[0])}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="group relative flex-shrink-0 w-full sm:w-36 h-36 rounded-md border-2 border-dashed border-slate-700 overflow-hidden bg-slate-950 flex items-center justify-center transition-colors hover:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
          aria-label={value ? "Trocar retrato da criatura" : "Enviar retrato da criatura"}
        >
          {!value || imageError ? (
            <span className="flex flex-col items-center gap-2 px-3 text-xs text-slate-500 group-hover:text-purple-300">
              {uploading ? <LoaderCircle className="w-7 h-7 animate-spin" /> : <Upload className="w-7 h-7" />}
              {uploading ? "Preparando..." : "Clique para enviar"}
            </span>
          ) : (
            <img
              src={value}
              alt="Retrato da criatura"
              className="w-full h-full object-cover"
              style={{
                objectPosition: `${resolvedSettings.positionX}% ${resolvedSettings.positionY}%`,
                transform: `scale(${resolvedSettings.zoom / 100})`,
              }}
              onError={() => setImageError(true)}
              referrerPolicy="no-referrer"
            />
          )}
          {value && !imageError && !uploading && (
            <span className="absolute inset-x-0 bottom-0 py-1.5 bg-slate-950/80 text-xs text-slate-200 opacity-0 group-hover:opacity-100 transition-opacity">
              Trocar imagem
            </span>
          )}
        </button>

        {/* Controles */}
        <div className="flex-1 min-w-0">
          {/* Input com botão de confirmar embutido */}
          <div className="relative flex-1">
            <TextInput
              value={draftUrl}
              onChange={setDraftUrl}
              onKeyDown={handleKeyDown}
              placeholder="Ou cole a URL da imagem"
              style={{ paddingRight: "2.25rem" }}
            />
            <button
              type="button"
              onClick={handleInsert}
              title="Carregar imagem"
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-purple-400 transition-colors"
            >
              <Check size={16} />
            </button>
          </div>

          {/* Linha inferior: dica à esquerda, Remover à direita */}
          <div className="flex justify-between items-start mt-1">
            <span className="text-xs text-slate-500">PNG, JPG, WEBP ou GIF · até 15 MB</span>
            {value && (
              <button
                type="button"
                onClick={handleRemove}
                className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 transition-colors shrink-0 ml-2"
              >
                <X size={12} /> Remover
              </button>
            )}
          </div>
          {uploadError && <p className="mt-2 text-xs text-red-400" role="alert">{uploadError}</p>}

          {value && !imageError && (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-3 rounded-md border border-slate-800 bg-slate-950/50 p-3">
              <PortraitSlider label="Zoom" value={resolvedSettings.zoom} min={100} max={250} suffix="%" onChange={(v) => updateSetting("zoom", v)} />
              <PortraitSlider label="Altura" value={resolvedSettings.height} min={120} max={360} suffix=" px" onChange={(v) => updateSetting("height", v)} />
              <PortraitSlider label="Posição horizontal" value={resolvedSettings.positionX} min={0} max={100} suffix="%" onChange={(v) => updateSetting("positionX", v)} />
              <PortraitSlider label="Posição vertical" value={resolvedSettings.positionY} min={0} max={100} suffix="%" onChange={(v) => updateSetting("positionY", v)} />
              <div className="sm:col-span-2 flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => onSettingsChange(DEFAULT_PORTRAIT_SETTINGS)}
                >
                  <RotateCcw /> Restaurar enquadramento
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PortraitSlider({ label, value, min, max, suffix, onChange }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center justify-between text-xs text-slate-400">
        <span>{label}</span>
        <span className="font-mono text-slate-200">{value}{suffix}</span>
      </span>
      <Slider value={[value]} min={min} max={max} step={1} onValueChange={([next]) => onChange(next)} />
    </label>
  );
}

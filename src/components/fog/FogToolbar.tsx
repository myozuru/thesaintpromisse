import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useFogStore } from "@/stores/fogStore";
import type { Tool } from "@/lib/fog/types";
import {
  MousePointer2,
  Minus,
  Square,
  Circle,
  DoorOpen,
  Lightbulb,
  Move,
  Pencil,
  Undo2,
  Redo2,
  Eye,
  EyeOff,
  Moon,
  Sparkles,
  Trash2,
} from "lucide-react";

const TOOLS: { id: Tool; label: string; icon: React.ComponentType<{ className?: string }>; hint: string }[] = [
  { id: "select", label: "Selecionar", icon: MousePointer2, hint: "Duplo-clique numa parede pra selecioná-la; arraste pra mover. Clique em porta abre/fecha. Delete remove." },
  { id: "wall", label: "Parede", icon: Minus, hint: "Clique pra adicionar pontos. Duplo clique encerra. Botão direito fecha o polígono." },
  { id: "rect", label: "Retângulo", icon: Square, hint: "Arraste para criar uma parede retangular fechada." },
  { id: "ellipse", label: "Elipse", icon: Circle, hint: "Arraste para criar uma parede em elipse fechada." },
  { id: "door", label: "Porta", icon: DoorOpen, hint: "Arraste sobre uma parede pra definir o tamanho; clique alterna; duplo clique deleta." },
  { id: "light", label: "Luz", icon: Lightbulb, hint: "Clique pra adicionar fonte de luz." },
  { id: "move-light", label: "Mover luz", icon: Move, hint: "Arraste uma fonte de luz." },
  { id: "edit", label: "Editar", icon: Pencil, hint: "Arraste vértices das paredes ou pontas das portas." },
];

export function FogToolbar() {
  const { tool, setTool, clearAll, loadDemo, undo, redo, past, future, lights, walls, doors, viewMode, setViewMode, selectedWallId, setWallKind } =
    useFogStore();
  const active = TOOLS.find((t) => t.id === tool);
  const selectedWall = walls.find((w) => w.id === selectedWallId) ?? null;
  const selectedKind = selectedWall?.kind ?? "barrier";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (mod && (e.key.toLowerCase() === "y" || (e.shiftKey && e.key.toLowerCase() === "z"))) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  const IconBtn = ({
    active: isActive,
    onClick,
    title,
    children,
    disabled,
    variant,
  }: {
    active?: boolean;
    onClick?: () => void;
    title: string;
    children: React.ReactNode;
    disabled?: boolean;
    variant?: "default" | "ghost" | "destructive";
  }) => (
    <Button
      type="button"
      size="icon"
      variant={isActive ? "default" : variant ?? "ghost"}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className="h-8 w-8"
    >
      {children}
    </Button>
  );

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1 whitespace-nowrap">
        {/* View mode */}
        <div className="flex items-center gap-0.5 rounded-md border border-border p-0.5">
          <IconBtn
            active={viewMode === "vision"}
            onClick={() => setViewMode("vision")}
            title="Visão"
          >
            <Eye className="h-4 w-4" />
          </IconBtn>
          <IconBtn
            active={viewMode === "no-vision"}
            onClick={() => setViewMode("no-vision")}
            title="Sem visão"
          >
            <EyeOff className="h-4 w-4" />
          </IconBtn>
        </div>

        <div
          className="flex items-center gap-0.5 rounded-md border border-border p-0.5"
          title={selectedWall ? "Tipo da região selecionada" : "Selecione uma parede fechada para definir o tipo"}
        >
          <IconBtn
            active={!!selectedWall && selectedKind === "barrier"}
            disabled={!selectedWall}
            onClick={() => selectedWall && setWallKind(selectedWall.id, "barrier")}
            title="Barreira (sala/visão bloqueada)"
          >
            <Eye className="h-4 w-4" />
          </IconBtn>
          <IconBtn
            active={!!selectedWall && selectedKind === "darkness"}
            disabled={!selectedWall}
            onClick={() => selectedWall && setWallKind(selectedWall.id, "darkness")}
            title="Escuridão (só revela com iluminação)"
          >
            <Moon className="h-4 w-4" />
          </IconBtn>
        </div>

        <div className="mx-1 h-6 w-px bg-border" />

        {/* Tools */}
        <div className="flex items-center gap-0.5">
          {TOOLS.map((t) => {
            const Icon = t.icon;
            return (
              <IconBtn
                key={t.id}
                active={tool === t.id}
                onClick={() => setTool(t.id)}
                title={t.label}
              >
                <Icon className="h-4 w-4" />
              </IconBtn>
            );
          })}
        </div>

        <div className="mx-1 h-6 w-px bg-border" />

        {/* History */}
        <IconBtn onClick={undo} disabled={past.length === 0} title="Desfazer (Ctrl+Z)">
          <Undo2 className="h-4 w-4" />
        </IconBtn>
        <IconBtn onClick={redo} disabled={future.length === 0} title="Refazer (Ctrl+Shift+Z)">
          <Redo2 className="h-4 w-4" />
        </IconBtn>

        <div className="mx-1 h-6 w-px bg-border" />

        {/* Actions */}
        <IconBtn onClick={loadDemo} title="Sala demo">
          <Sparkles className="h-4 w-4" />
        </IconBtn>
        <IconBtn onClick={clearAll} title="Limpar tudo" variant="destructive">
          <Trash2 className="h-4 w-4" />
        </IconBtn>
      </div>

      <div className="flex items-center justify-between gap-3 px-1 text-xs text-muted-foreground">
        <span className="truncate">{active?.hint}</span>
        <span className="shrink-0 tabular-nums">
          {walls.length}p · {doors.length}d · {lights.length}l
        </span>
      </div>
    </div>
  );
}

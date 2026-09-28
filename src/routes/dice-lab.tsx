import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { DiceTray, type DiceTrayApi } from "@/components/dice-physics/DiceTray";
import { useDice3DStore } from "@/stores/useDice3DStore";

/**
 * Laboratório de dados: monta só a bandeja 3D com foco no dado e drama
 * Lendário, para o teste de navegador que verifica a centralização do zoom.
 */
function DiceLab() {
  const apiRef = useRef<DiceTrayApi | null>(null);
  const [result, setResult] = useState<number | null>(null);
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const drama = Number(new URLSearchParams(window.location.search).get("drama") ?? 3);
    useDice3DStore.setState({
      current: { id: "lab", types: ["D20"], drama, cinematicFocus: true, at: Date.now() },
    } as never);
    (window as any).__diceZoomProbe = [];
    (window as any).__diceLab = {
      ready: () => !!apiRef.current,
      roll: () => { setCompact(false); apiRef.current?.clear(); apiRef.current?.rollOne("D20"); setTimeout(() => apiRef.current?.throwAll(2), 50); },
    };
  }, []);
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background">
      <div
        data-testid="dice-lab-tray"
        className="overflow-hidden transition-[width,height] duration-500"
        style={{ width: compact ? 240 : 820, height: compact ? 240 : 560 }}
      >
        <DiceTray apiRef={apiRef} cinematicFocus onRollComplete={(_r, total) => { setResult(total); setCompact(true); }} />
      </div>
      <div data-testid="dice-lab-result" className="fixed bottom-2 left-2 text-foreground">
        {result ?? ""}
      </div>
    </div>
  );
}

export const Route = createFileRoute("/dice-lab")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Laboratório de dados — TP Fichas" },
      { name: "description", content: "Página de teste da bandeja de dados 3D." },
      { property: "og:title", content: "Laboratório de dados — TP Fichas" },
      { property: "og:description", content: "Página de teste da bandeja de dados 3D." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DiceLab,
});

import { useFogStore } from "@/stores/fogStore";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import type { LightEdge, LightShape, LightType } from "@/lib/fog/types";

export function LightSettings() {
  const { lights, selectedLightId, updateLight, removeLight, selectLight } = useFogStore();
  const light = lights.find((l) => l.id === selectedLightId);

  if (!light) {
    return (
      <div className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
        Selecione uma luz (ferramenta Selecionar) pra ajustar suas configurações.
      </div>
    );
  }

  const set = <K extends keyof typeof light>(k: K, v: (typeof light)[K]) =>
    updateLight(light.id, { [k]: v });

  return (
    <div className="rounded-lg border border-border p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Light Settings</h3>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => selectLight(null)}
          className="h-7 px-2 text-xs"
        >
          Fechar
        </Button>
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Range — {Math.round(light.radius)} px</Label>
        <Slider
          value={[light.radius]}
          min={40}
          max={1200}
          step={10}
          onValueChange={(v) => set("radius", v[0])}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Angle</Label>
          <div className="flex gap-1">
            {(["full", "cone"] as LightShape[]).map((s) => (
              <Button
                key={s}
                size="sm"
                variant={light.shape === s ? "default" : "outline"}
                onClick={() => set("shape", s)}
                className="flex-1 h-8 text-xs"
              >
                {s === "full" ? "Circle" : "Cone"}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Edge</Label>
          <div className="flex gap-1">
            {(["solid", "blurred"] as LightEdge[]).map((e) => (
              <Button
                key={e}
                size="sm"
                variant={light.edge === e ? "default" : "outline"}
                onClick={() => set("edge", e)}
                className="flex-1 h-8 text-xs"
              >
                {e === "solid" ? "Solid" : "Blurred"}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {light.shape === "cone" && (
        <>
          <div className="space-y-2">
            <Label className="text-xs">
              Abertura — {Math.round((light.coneAngle * 180) / Math.PI)}°
            </Label>
            <Slider
              value={[(light.coneAngle * 180) / Math.PI]}
              min={10}
              max={350}
              step={5}
              onValueChange={(v) => set("coneAngle", (v[0] * Math.PI) / 180)}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">
              Direção — {Math.round((light.coneDirection * 180) / Math.PI)}°
            </Label>
            <Slider
              value={[(light.coneDirection * 180) / Math.PI]}
              min={-180}
              max={180}
              step={5}
              onValueChange={(v) => set("coneDirection", (v[0] * Math.PI) / 180)}
            />
          </div>
        </>
      )}

      <div className="space-y-1">
        <Label className="text-xs">Type</Label>
        <div className="flex gap-1">
          {(["primary", "secondary"] as LightType[]).map((t) => (
            <Button
              key={t}
              size="sm"
              variant={light.type === t ? "default" : "outline"}
              onClick={() => set("type", t)}
              className="flex-1 h-8 text-xs"
            >
              {t === "primary" ? "Primary" : "Secondary"}
            </Button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground pt-1">
          Secundárias só iluminam onde uma primária enxerga.
        </p>
      </div>

      <Button
        size="sm"
        variant="destructive"
        onClick={() => removeLight(light.id)}
        className="w-full"
      >
        Remove Light
      </Button>
    </div>
  );
}

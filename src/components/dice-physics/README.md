# Dice Physics Module

Self-contained 3D dice physics for React 18 + Vite. No audio, no MUI, no materials/textures — apenas a física + render mínimo + callback de resultado.

## 1. Instalação das dependências

No projeto destino, instale:

```bash
npm install three @react-three/fiber@^8 @react-three/drei@^9 @react-three/rapier@^1
npm install -D @types/three
```

(Compatível com React 18 + Vite 5.)

## 2. Onde colar

Copie a pasta `dice-physics/` inteira para:

```
src/components/dice-physics/
```

Os 8 arquivos `.glb` em `dice-physics/meshes/` precisam vir junto — são as malhas dos dados com os "locators" que detectam qual face está virada para cima.

## 3. Vite config

O Vite já entende `?url` para `.glb` por padrão, mas se quiser garantir, em `vite.config.ts`:

```ts
export default defineConfig({
  // ...
  assetsInclude: ["**/*.glb"],
});
```

## 4. Uso básico

```tsx
import { DiceTray } from "@/components/dice-physics";
import { useRef } from "react";
import type { DiceTrayApi } from "@/components/dice-physics";

export function Example() {
  const dice = useRef<DiceTrayApi>(null);

  return (
    <div style={{ width: 400, height: 600 }}>
      <DiceTray
        apiRef={dice}
        onRoll={(r) => console.log("rolou", r.type, "=", r.value)}
        onRollComplete={(results, total) => console.log("total:", total)}
      />
      <button onClick={() => dice.current?.rollOne("D20")}>Rolar D20</button>
      <button onClick={() => dice.current?.rollMany(["D6", "D6", "D6"])}>3d6</button>
      <button onClick={() => dice.current?.clear()}>Limpar</button>
    </div>
  );
}
```

## 5. API

### `<DiceTray />` props

| Prop | Tipo | Descrição |
|------|------|-----------|
| `onRoll` | `(r: DiceRollResult) => void` | Disparado por **cada dado** quando para. |
| `onRollComplete` | `(results, total) => void` | Disparado quando **todos** os dados que estão na bandeja pararam. |
| `apiRef` | `MutableRefObject<DiceTrayApi \| null>` | Acesso imperativo: `rollOne`, `rollMany`, `clear`. |
| `envPreset` | preset HDR do drei | Iluminação. Padrão: `"city"`. |
| `className`, `style` | — | Para o wrapper. |

### Tipos

```ts
type DiceType = "D4" | "D6" | "D8" | "D10" | "D12" | "D20" | "D100";
type DiceRollResult = { id: string; type: DiceType; value: number };
type DiceTrayApi = {
  rollOne(type: DiceType): void;
  rollMany(types: DiceType[]): void;
  clear(): void;
};
```

## 6. O que NÃO foi importado

- Áudio (colisões silenciosas)
- Materiais com textura (galaxy, iron, walnut, etc.) — usa `meshStandardMaterial` cinza simples
- UI/MUI/sidebar/picker
- Sistema de bonus, advantage, history, sets, multiplayer

Se quiser pintar os dados, é só passar `children` para `<DiceMesh>` ou estilizar o `meshStandardMaterial` editando `meshes/DiceMesh.tsx`.

## 7. Compatibilidade React 18

Este módulo usa `forwardRef` clássico e tipagem `JSX.IntrinsicElements`. Não depende de nenhuma API de React 19. As versões das libs sugeridas acima já são as últimas compatíveis com R18.

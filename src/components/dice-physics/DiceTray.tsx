// @ts-nocheck
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer, PerspectiveCamera, OrbitControls, useGLTF } from "@react-three/drei";
import { Physics, useRapier } from "@react-three/rapier";
import { useDice3DStore } from "@/stores/useDice3DStore";
import RAPIER from "@dimforge/rapier3d-compat";

// Pre-initialize the Rapier WASM module so <Physics> doesn't throw on first mount.
let rapierReady: Promise<void> | null = null;
function ensureRapier() {
  if (!rapierReady) rapierReady = RAPIER.init();
  return rapierReady;
}

function RapierGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    ensureRapier().then(() => alive && setReady(true));
    return () => { alive = false; };
  }, []);
  if (!ready) return null;
  return <>{children}</>;
}

import type { Die, DiceType, DiceTransform } from "./types";
import { generateDiceId } from "./helpers/random";
import { DiceThrower } from "./helpers/DiceThrower";
import { TrayColliders } from "./colliders/TrayColliders";
import { PhysicsDice } from "./PhysicsDice";
import { DiceMesh } from "./meshes/DiceMesh";
import { DICE_DRAMA_CONFIG } from "./dramaConfig";
import { getTrayCameraPlacement, TRAY_CAMERA_FOV } from "./cameraFraming";
import * as THREE from "three";
import d4Url from "./meshes/d4.glb?url";
import d6Url from "./meshes/d6.glb?url";
import d8Url from "./meshes/d8.glb?url";
import d10Url from "./meshes/d10.glb?url";
import d12Url from "./meshes/d12.glb?url";
import d20Url from "./meshes/d20.glb?url";
import d100Url from "./meshes/d100.glb?url";

/** Força máxima do lançamento carregado (segurar o botão). */
export const MAX_THROW_POWER = 4;

/** Carrega todos os modelos antes de liberar a bandeja; só então avisa que está pronta. */
function DiceModelsReady({ onReady }: { onReady: () => void }) {
  useGLTF([d4Url, d6Url, d8Url, d10Url, d12Url, d20Url, d100Url]);
  useEffect(() => { onReady(); }, [onReady]);
  return null;
}
import { claimDiceLaunch, type DiceLaunchGuard } from "./diceLaunchGuard";

export type DiceRollResult = { id: string; type: DiceType; value: number };

export type DiceTrayApi = {
  /** Spawn one die of the given type (em repouso, aguardando clique). */
  rollOne: (type: DiceType) => void;
  /** Spawn an array of dice in one batch (em repouso). */
  rollMany: (types: DiceType[]) => void;
  /** Lança todos os dados ainda parados. */
  throwAll: (power?: number) => void;
  /** Clear the tray. */
  clear: () => void;
};

export type DiceTrayProps = {
  /** Fires once for each die when it settles. */
  onRoll?: (result: DiceRollResult) => void;
  /** Fires once all currently-rolling dice settle, with the totals. */
  onRollComplete?: (results: DiceRollResult[], total: number) => void;
  /** Disparado quando o usuário lança os dados (saem do estado armed). */
  onThrown?: () => void;
  /** Imperative API. */
  apiRef?: React.MutableRefObject<DiceTrayApi | null>;
  /** Canvas wrapper className. */
  className?: string;
  /** Inline style for the canvas wrapper. */
  style?: React.CSSProperties;
  /** Show an environment map for lighting (defaults to "city" preset). */
  envPreset?: "city" | "studio" | "sunset" | "dawn" | "night" | "warehouse" | "forest" | "apartment" | "park" | "lobby";
  /** Segue um único dado e aproxima a câmera quando ele assenta. */
  cinematicFocus?: boolean;
};

type RollingDie = { die: Die; thrown: ReturnType<DiceThrower["getDiceThrow"]> };

/** Velocidade da simulação por nível de drama (0 normal → 3 lendário). */
export const DRAMA_TIME_SCALE = DICE_DRAMA_CONFIG.map((config) => config.timeScale);

/** Avança a física em câmera lenta quando o drama pede tensão. */
function SlowMoStepper({ scale }: { scale: number }) {
  const { step } = useRapier();
  useFrame((_, delta) => step(Math.min(delta, 1 / 30) * scale));
  return null;
}

function CinematicCamera({ positionRef, settledRef }: {
  positionRef: React.MutableRefObject<DiceTransform["position"] | null>;
  settledRef: React.MutableRefObject<boolean>;
}) {
  const lookAt = useRef(new THREE.Vector3());
  const desired = useRef(new THREE.Vector3());
  const initialized = useRef(false);
  useFrame(({ camera }, delta) => {
    const point = positionRef.current;
    if (!point) return;
    const settled = settledRef.current;
    // Durante o voo a câmera já fica próxima; ao assentar, fecha bastante
    // sobre a face do dado sem trocar a cena nem perder sua posição física.
    desired.current.set(point.x, point.y + (settled ? 0.72 : 2.25), point.z + (settled ? 0.2 : 0.38));
    const dt = Math.min(delta, 0.05);
    if (!initialized.current) {
      camera.position.copy(desired.current);
      lookAt.current.set(point.x, point.y, point.z);
      initialized.current = true;
    } else {
      camera.position.lerp(desired.current, 1 - Math.exp(-(settled ? 4.2 : 10) * dt));
      lookAt.current.lerp(new THREE.Vector3(point.x, point.y + (settled ? 0.08 : 0), point.z), 1 - Math.exp(-(settled ? 10 : 14) * dt));
    }
    camera.lookAt(lookAt.current);
    if (camera instanceof THREE.PerspectiveCamera) {
      const targetFov = settled ? 23 : 36;
      camera.fov = THREE.MathUtils.damp(camera.fov, targetFov, settled ? 4.5 : 6, dt);
      camera.updateProjectionMatrix();
    }
  });
  return null;
}

/** Mantém toda a arena visível mesmo quando a bandeja fica alta e estreita. */
function TrayCameraFraming({ active }: { active: boolean }) {
  const { camera, size } = useThree();
  useEffect(() => {
    if (!active || !(camera instanceof THREE.PerspectiveCamera)) return;
    const placement = getTrayCameraPlacement(size.width / Math.max(1, size.height));
    camera.position.set(...placement.position);
    camera.fov = placement.fov;
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }, [active, camera, size.height, size.width]);
  return null;
}

export function DiceTray({
  onRoll,
  onRollComplete,
  onThrown,
  apiRef,
  className,
  style,
  envPreset = "city",
  cinematicFocus = false,
}: DiceTrayProps) {
  const drama = useDice3DStore((st) => st.current?.drama ?? 0);
  const slowMo = DRAMA_TIME_SCALE[drama] ?? 1;
  const palette = DICE_DRAMA_CONFIG[drama]?.palette ?? DICE_DRAMA_CONFIG[0].palette;
  const [dice, setDice] = useState<RollingDie[]>([]);
  /** Enquanto true, os dados estão parados aguardando clique. */
  const [armed, setArmed] = useState(false);
  const [ready, setReady] = useState(false);
  const [power, setPower] = useState(1);
  const markReady = useCallback(() => setReady(true), []);
  const launchGuardRef = useRef<DiceLaunchGuard>({ armed: false });
  const throwerRef = useRef(new DiceThrower());
  const resultsRef = useRef<Map<string, DiceRollResult>>(new Map());
  const expectedRef = useRef(0);
  const focusPositionRef = useRef<DiceTransform["position"] | null>(null);
  const focusSettledRef = useRef(false);
  const useCinematicCamera = cinematicFocus && dice.length === 1;

  const spawn = useCallback((types: DiceType[]) => {
    if (!types.length) return;
    const next: RollingDie[] = types.map((type) => {
      const die: Die = { id: generateDiceId(), type };
      const idx = throwerRef.current["history"].length;
      const thrown = throwerRef.current.getDiceThrow(idx);
      return { die, thrown };
    });
    setDice((prev) => [...prev, ...next]);
    focusPositionRef.current = next.length === 1 ? next[0].thrown.position : null;
    focusSettledRef.current = false;
    expectedRef.current += next.length;
    launchGuardRef.current.armed = true;
    setArmed(true);
  }, []);

  const throwAll = useCallback((p?: number) => {
    // O ref é consumido imediatamente. Assim, vários pointerdown/click antes
    // do próximo render não conseguem iniciar a mesma rodada mais de uma vez.
    if (!claimDiceLaunch(launchGuardRef.current)) return;
    const n = typeof p === 'number' && isFinite(p) ? p : 1;
    setPower(Math.max(1, Math.min(MAX_THROW_POWER, n)));
    setArmed(false);
    onThrown?.();
  }, [onThrown]);

  const clear = useCallback(() => {
    setDice([]);
    focusPositionRef.current = null;
    focusSettledRef.current = false;
    throwerRef.current.clearHistory();
    resultsRef.current.clear();
    expectedRef.current = 0;
    launchGuardRef.current.armed = false;
    setArmed(false);
  }, []);

  useEffect(() => {
    // Só expõe a API depois que física e modelos terminaram de carregar.
    if (!apiRef || !ready) return;
    apiRef.current = {
      rollOne: (type) => spawn([type]),
      rollMany: (types) => spawn(types),
      throwAll: (p?: number) => throwAll(p),
      clear,
    };
    return () => { apiRef.current = null; };
  }, [apiRef, ready, spawn, throwAll, clear]);

  const handleFinished = useCallback((id: string, value: number, _t: DiceTransform) => {
    if (resultsRef.current.has(id)) return;
    const rolling = dice.find((d) => d.die.id === id);
    if (!rolling) return;
    // d10 padrão: a face "0" representa 10 (faces 1..9 + 0→10).
    let normalized = value;
    if ((rolling.die.type === "D10" || rolling.die.type === "D100") && normalized === 0) {
      // D100 usa duas faces 0..90; cada "0" individual ainda representa 10 ali
      // apenas se for um D10 puro; para D100 mantemos 0 (dezenas) como válido.
      if (rolling.die.type === "D10") normalized = 10;
    }
    const result: DiceRollResult = { id, type: rolling.die.type, value: normalized };
    if (useCinematicCamera) focusSettledRef.current = true;
    resultsRef.current.set(id, result);
    onRoll?.(result);
    if (resultsRef.current.size === expectedRef.current) {
      const all = Array.from(resultsRef.current.values());
      const total = all.reduce((s, r) => s + r.value, 0);
      onRollComplete?.(all, total);
    }
  }, [dice, onRoll, onRollComplete, useCinematicCamera]);

  return (
    <div className={className} style={{ width: "100%", height: "100%", ...style }}>
      <Canvas frameloop="always" dpr={[1, 1.25]} gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}>
        <color attach="background" args={[palette.bg]} />
        <fog attach="fog" args={[palette.bg, 9, 24]} />
        {/* Iluminação local (sem baixar HDR da internet, que travava/lagava). */}
        <Environment resolution={64}>
          <Lightformer intensity={2} position={[0, 5, 0]} scale={[10, 10, 1]} />
          <Lightformer intensity={1} color={palette.accentA} position={[-5, 1, -1]} rotation-y={Math.PI / 2} scale={[20, 1, 1]} />
          <Lightformer intensity={0.8} color={palette.accentB} position={[5, 1, 1]} rotation-y={-Math.PI / 2} scale={[20, 1, 1]} />
        </Environment>
        {/* Ambiência mística: a paleta muda conforme o nível de drama da rolagem. */}
        <ambientLight intensity={0.25} color={palette.ambient} />
        <directionalLight position={[2, 5, 2]} intensity={0.7} color={palette.accentB} />
        <pointLight position={[-2, 3, -1]} intensity={2.2} color={palette.accentA} distance={8} decay={2} />
        <pointLight position={[2, 1.5, 2]} intensity={1.4} color={palette.accentB} distance={6} decay={2} />
        <spotLight position={[0, 6, 0]} angle={0.6} penumbra={0.8} intensity={1.2} color={palette.accentA} />
        <PerspectiveCamera makeDefault fov={TRAY_CAMERA_FOV} position={[0, 9.8, 1.75]} />
        <TrayCameraFraming active={!useCinematicCamera} />
        {useCinematicCamera && <CinematicCamera positionRef={focusPositionRef} settledRef={focusSettledRef} />}
        <OrbitControls
          target={[0, 0, 0]}
          enabled={!useCinematicCamera}
          enablePan={!useCinematicCamera}
          enableZoom={!useCinematicCamera}
          enableRotate={!useCinematicCamera}
          minDistance={1.4}
          maxDistance={9}
          maxPolarAngle={Math.PI / 2.05}
          zoomSpeed={1.2}
          rotateSpeed={0.9}
          panSpeed={0.9}
          screenSpacePanning
          mouseButtons={{
            LEFT: 2, // THREE.MOUSE.PAN
            MIDDLE: 1, // DOLLY
            RIGHT: 0, // ROTATE
          }}
          touches={{
            ONE: 1, // ROTATE (touchOne)
            TWO: 2, // DOLLY_PAN
          }}
        />

        <RapierGate>
          <Physics colliders={false} interpolate timeStep={slowMo < 1 ? 'vary' : 1 / 60} paused={slowMo < 1} updateLoop="follow" gravity={[0, -14, 0]}>
            {slowMo < 1 && <SlowMoStepper scale={slowMo} />}
            <TrayColliders />
            <Suspense fallback={null}><DiceModelsReady onReady={markReady} /></Suspense>
            {dice.map(({ die, thrown }) => (
              <PhysicsDice
                key={die.id}
                die={die}
                dieThrow={thrown}
                armed={armed}
                power={power}
                onThrowRequest={() => throwAll(1)}
                onRollFinished={handleFinished}
                onPositionChange={useCinematicCamera ? (_id, position) => { focusPositionRef.current = position; } : undefined}
              >
                <DiceMesh diceType={die.type} />
              </PhysicsDice>
            ))}
          </Physics>
        </RapierGate>
      </Canvas>
    </div>
  );
}

// @ts-nocheck
import React, { useEffect, useMemo } from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import type { GLTF } from "three-stdlib";
import type { DiceType } from "../types";

import d4Url from "./d4.glb?url";
import d6Url from "./d6.glb?url";
import d8Url from "./d8.glb?url";
import d10Url from "./d10.glb?url";
import d12Url from "./d12.glb?url";
import d20Url from "./d20.glb?url";
import d100Url from "./d100.glb?url";

// Locator data for face-up detection via getValueFromDiceGroup.
// Locator name convention: NNN_locator_X where X (starting at char 12) is the face value.
type Locator = { name: string; position: [number, number, number] };

const LOCATORS: Record<DiceType, Locator[]> = {
  D4: [
    { name: "004_locator_1", position: [0, -0.61, -1.27] },
    { name: "004_locator_2", position: [-1.1, -0.61, 0.63] },
    { name: "004_locator_3", position: [1.1, -0.61, 0.63] },
    { name: "004_locator_4", position: [0, 1.18, 0] },
  ],
  D6: [
    { name: "006_locator_1", position: [0, -0.77, 0] },
    { name: "006_locator_2", position: [-0.77, 0, 0] },
    { name: "006_locator_3", position: [0, 0, 0.77] },
    { name: "006_locator_4", position: [0, 0, -0.77] },
    { name: "006_locator_5", position: [0.77, 0, 0] },
    { name: "006_locator_6", position: [0, 0.77, 0] },
  ],
  D8: [
    { name: "008_locator_1", position: [0.42, 0.52, 0.43] },
    { name: "008_locator_2", position: [-0.47, -0.46, -0.45] },
    { name: "008_locator_3", position: [0.45, -0.46, -0.47] },
    { name: "008_locator_4", position: [-0.43, 0.52, 0.42] },
    { name: "008_locator_5", position: [-0.42, 0.52, -0.43] },
    { name: "008_locator_6", position: [0.47, -0.46, 0.45] },
    { name: "008_locator_7", position: [-0.45, -0.46, 0.47] },
    { name: "008_locator_8", position: [0.43, 0.52, -0.42] },
  ],
  D10: [
    { name: "010_locator_0", position: [0.4, 0.42, -0.56] },
    { name: "010_locator_1", position: [-0.7, -0.37, -0.22] },
    { name: "010_locator_2", position: [0.01, 0.42, 0.69] },
    { name: "010_locator_3", position: [0.69, -0.37, -0.23] },
    { name: "010_locator_4", position: [-0.41, 0.42, -0.55] },
    { name: "010_locator_5", position: [0.44, -0.37, 0.59] },
    { name: "010_locator_6", position: [-0.65, 0.42, 0.22] },
    { name: "010_locator_7", position: [-0.01, -0.37, -0.73] },
    { name: "010_locator_8", position: [0.66, 0.42, 0.21] },
    { name: "010_locator_9", position: [-0.42, -0.37, 0.6] },
  ],
  D12: [
    { name: "012_locator_1", position: [0, -0.93, 0] },
    { name: "012_locator_2", position: [-0.25, -0.41, -0.8] },
    { name: "012_locator_3", position: [-0.67, 0.44, 0.5] },
    { name: "012_locator_4", position: [-0.84, -0.41, -0.01] },
    { name: "012_locator_5", position: [0.67, -0.41, 0.5] },
    { name: "012_locator_6", position: [-0.27, -0.41, 0.79] },
    { name: "012_locator_7", position: [0.25, 0.44, -0.8] },
    { name: "012_locator_8", position: [-0.68, 0.44, -0.48] },
    { name: "012_locator_9", position: [0.84, 0.44, -0.01] },
    { name: "012_locator_10", position: [0.68, -0.41, -0.48] },
    { name: "012_locator_11", position: [0.27, 0.44, 0.79] },
    { name: "012_locator_12", position: [0, 0.96, 0] },
  ],
  D20: [
    { name: "020_locator_1", position: [1.08, -0.21, 0] },
    { name: "020_locator_2", position: [-0.87, -0.2, 0.64] },
    { name: "020_locator_3", position: [0.57, 0.86, -0.39] },
    { name: "020_locator_4", position: [-0.56, -0.86, -0.39] },
    { name: "020_locator_5", position: [0.22, -0.88, 0.62] },
    { name: "020_locator_6", position: [-0.34, 0.23, -1.02] },
    { name: "020_locator_7", position: [0.88, 0.2, 0.64] },
    { name: "020_locator_8", position: [-0.66, 0.88, 0] },
    { name: "020_locator_9", position: [0.35, -0.24, -1.02] },
    { name: "020_locator_10", position: [-0.21, 0.88, 0.62] },
    { name: "020_locator_11", position: [0.21, -0.9, -0.6] },
    { name: "020_locator_12", position: [-0.35, 0.19, 1.02] },
    { name: "020_locator_13", position: [0.67, -0.88, 0] },
    { name: "020_locator_14", position: [-0.87, -0.21, -0.64] },
    { name: "020_locator_15", position: [0.36, -0.19, 1.02] },
    { name: "020_locator_16", position: [-0.2, 0.9, -0.6] },
    { name: "020_locator_17", position: [0.53, 0.89, 0.38] },
    { name: "020_locator_18", position: [-0.52, -0.89, 0.38] },
    { name: "020_locator_19", position: [0.88, 0.21, -0.64] },
    { name: "020_locator_20", position: [-1.07, 0.21, 0] },
  ],
  D100: [
    { name: "100_locator_00", position: [0.4, 0.42, -0.56] },
    { name: "100_locator_10", position: [-0.7, -0.37, -0.22] },
    { name: "100_locator_20", position: [0.01, 0.42, 0.69] },
    { name: "100_locator_30", position: [0.69, -0.37, -0.23] },
    { name: "100_locator_40", position: [-0.41, 0.42, -0.55] },
    { name: "100_locator_50", position: [0.44, -0.37, 0.59] },
    { name: "100_locator_60", position: [-0.65, 0.42, 0.22] },
    { name: "100_locator_70", position: [-0.01, -0.37, -0.73] },
    { name: "100_locator_80", position: [0.66, 0.42, 0.21] },
    { name: "100_locator_90", position: [-0.42, -0.37, 0.6] },
  ],
};

const URLS: Record<DiceType, string> = {
  D4: d4Url, D6: d6Url, D8: d8Url, D10: d10Url, D12: d12Url, D20: d20Url, D100: d100Url,
};

const NODE_NAME: Record<DiceType, string> = {
  D4: "d4", D6: "d6", D8: "d8", D10: "d10", D12: "d12", D20: "d20", D100: "d100",
};

const LABEL_TUNING: Record<DiceType, { single: [number, number]; double: [number, number]; lift: number }> = {
  D4: { single: [1.25, 1.1], double: [1.45, 0.95], lift: 0.12 },
  D6: { single: [1.2, 1.1], double: [1.4, 0.95], lift: 0.11 },
  D8: { single: [1.05, 0.95], double: [1.25, 0.85], lift: 0.11 },
  D10: { single: [1.05, 0.95], double: [1.25, 0.85], lift: 0.11 },
  D12: { single: [1.0, 0.9], double: [1.2, 0.8], lift: 0.11 },
  D20: { single: [1.0, 0.9], double: [1.25, 0.8], lift: 0.12 },
  D100: { single: [1.0, 0.9], double: [1.3, 0.8], lift: 0.11 },
};

const TEXT_NORMAL = new THREE.Vector3(0, 0, 1);

function createNumberTexture(value: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `900 ${value.length > 1 ? 250 : 330}px Cinzel, Georgia, serif`;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.shadowColor = "rgba(255, 218, 110, 0.95)";
  ctx.shadowBlur = 26;
  ctx.strokeStyle = "rgba(16, 3, 28, 1)";
  ctx.lineWidth = value.length > 1 ? 34 : 42;
  ctx.strokeText(value, 256, 268);
  ctx.fillStyle = "#fff6bd";
  ctx.fillText(value, 256, 268);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

function getLabelValue(name: string) {
  return name.slice(name.lastIndexOf("_") + 1);
}

function getFaceTextTransform(position: [number, number, number], lift: number) {
  const normal = new THREE.Vector3(...position).normalize();
  const lifted = new THREE.Vector3(...position).addScaledVector(normal, lift);
  return {
    position: [lifted.x, lifted.y, lifted.z] as [number, number, number],
    quaternion: new THREE.Quaternion().setFromUnitVectors(TEXT_NORMAL, normal),
  };
}

function FaceLabel({ diceType, locator }: { diceType: DiceType; locator: Locator }) {
  const value = getLabelValue(locator.name);
  const tuning = LABEL_TUNING[diceType];
  const { position, quaternion } = getFaceTextTransform(locator.position, tuning.lift);
  const size = value.length > 1 ? tuning.double : tuning.single;
  const texture = useMemo(() => createNumberTexture(value), [value]);

  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <mesh
      position={position}
      quaternion={quaternion}
      renderOrder={20}
    >
      <planeGeometry args={size} />
      <meshBasicMaterial
        map={texture}
        transparent
        alphaTest={0.08}
        depthWrite={false}
        polygonOffset
        polygonOffsetFactor={-8}
        toneMapped={false}
      />
    </mesh>
  );
}

type GLTFResult = GLTF & { nodes: Record<string, THREE.Mesh>; materials: Record<string, THREE.Material> };

type Props = JSX.IntrinsicElements["group"] & { diceType: DiceType };

export const DiceMesh = React.forwardRef<THREE.Group, Props>(({ diceType, children, ...props }, ref) => {
  const { nodes } = useGLTF(URLS[diceType]) as unknown as GLTFResult;
  const nodeName = NODE_NAME[diceType];
  const mesh = nodes[nodeName];
  const geometry = mesh?.geometry;
  const locators = LOCATORS[diceType];
  const meshRotation: [number, number, number] = diceType === "D20" ? [0, 0, -1.38] : [0, 0, 0];

  return (
    <group ref={ref} {...props} scale={0.1} dispose={null}>
      <group name="dice">
        <mesh name={nodeName} castShadow receiveShadow geometry={geometry} rotation={meshRotation}>
          {children}
          {locators.map((l) => (
            <React.Fragment key={l.name}>
              <group name={l.name} position={l.position} />
              <FaceLabel diceType={diceType} locator={l} />
            </React.Fragment>
          ))}
          {/* Corpo do dado mais fosco para os números claros ficarem legíveis. */}
          <meshPhysicalMaterial
            color="#3f2380"
            metalness={0.28}
            roughness={0.48}
            clearcoat={0.55}
            clearcoatRoughness={0.32}
            reflectivity={0.45}
            iridescence={0.18}
            iridescenceIOR={1.5}
            iridescenceThicknessRange={[180, 600]}
            emissive="#28104f"
            emissiveIntensity={0.12}
            sheen={1}
            sheenRoughness={0.4}
            sheenColor="#d4a64c"
          />
        </mesh>
      </group>
    </group>
  );
});
DiceMesh.displayName = "DiceMesh";

useGLTF.preload(d4Url);
useGLTF.preload(d6Url);
useGLTF.preload(d8Url);
useGLTF.preload(d10Url);
useGLTF.preload(d12Url);
useGLTF.preload(d20Url);
useGLTF.preload(d100Url);

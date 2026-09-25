export type DiceType = "D4" | "D6" | "D8" | "D10" | "D12" | "D20" | "D100";

export interface DiceVector3 { x: number; y: number; z: number }
export interface DiceQuaternion { x: number; y: number; z: number; w: number }
export interface DiceTransform { position: DiceVector3; rotation: DiceQuaternion }
export interface DiceThrow {
  position: DiceVector3;
  rotation: DiceQuaternion;
  linearVelocity: DiceVector3;
  angularVelocity: DiceVector3;
}

export interface Die {
  id: string;
  type: DiceType;
}

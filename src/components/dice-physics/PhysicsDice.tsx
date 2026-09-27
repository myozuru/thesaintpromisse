// @ts-nocheck
import * as THREE from "three";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { RigidBody, type RapierRigidBody } from "@react-three/rapier";
import { useFrame } from "@react-three/fiber";

import type { Die, DiceThrow, DiceTransform } from "./types";
import { getValueFromDiceGroup } from "./helpers/getValueFromDiceGroup";
import { DiceCollider } from "./colliders/DiceColliders";
import { DICE_SETTLEMENT, decideDiceSettlement } from "./diceSettlement";
import { useDice3DStore } from "@/stores/useDice3DStore";

/** Y máximo (mundo) para o dado ser considerado "na bandeja". */
const MAX_SETTLE_Y = 1.5;
/** Multiplicadores do lançamento — dados mais rápidos quicam mais. */
const THROW_SPEED = 1.7;
const SPIN_SPEED = 1.4;

function magnitude({ x, y, z }: { x: number; y: number; z: number }) {
  return Math.sqrt(x * x + y * y + z * z);
}

type Vec3 = [number, number, number];

export type PhysicsDiceProps = {
  die: Die;
  dieThrow: DiceThrow;
  /** Quando `true`, o dado aparece em repouso esperando um clique para ser lançado. */
  armed: boolean;
  /** Disparado quando o usuário clica em um dado armado. */
  onThrowRequest?: (id: string) => void;
  onRollFinished?: (id: string, value: number, transform: DiceTransform) => void;
  children?: React.ReactNode;
};

export function PhysicsDice({ die, dieThrow, armed, onThrowRequest, onRollFinished, children }: PhysicsDiceProps) {
  const bounciness = useDice3DStore((s) => s.bounciness);
  const groupRef = useRef<THREE.Group>(null);
  const rigidBodyRef = useRef<RapierRigidBody>(null);

  const [position] = useState<Vec3>(() => [dieThrow.position.x, dieThrow.position.y, dieThrow.position.z]);
  const [rotation] = useState<Vec3>(() => {
    const r = dieThrow.rotation;
    const q = new THREE.Quaternion(r.x, r.y, r.z, r.w);
    const e = new THREE.Euler().setFromQuaternion(q);
    return [e.x, e.y, e.z];
  });

  const thrownRef = useRef(false);
  const lockedRef = useRef(false);
  /** Instante (s) em que a velocidade caiu abaixo do limiar continuamente. null = ainda rápido. */
  const lowSpeedSinceRef = useRef<number | null>(null);
  const thrownAtRef = useRef<number | null>(null);
  const dampingAppliedRef = useRef(false);

  const lockDice = useCallback(() => {
    const rb = rigidBodyRef.current;
    if (!rb) return;
    rb.setEnabledRotations(false, false, false, false);
    rb.setAngvel({ x: 0, y: 0, z: 0 }, false);
    rb.setEnabledTranslations(false, false, false, false);
    rb.setLinvel({ x: 0, y: 0, z: 0 }, false);
    lockedRef.current = true;
  }, []);

  const resolveNow = useCallback(() => {
    const rb = rigidBodyRef.current;
    const group = groupRef.current;
    if (!rb || !group || lockedRef.current) return;
    rb.setLinvel({ x: 0, y: 0, z: 0 }, false);
    rb.setAngvel({ x: 0, y: 0, z: 0 }, false);
    rb.sleep();
    group.updateWorldMatrix(true, true);
    const value = getValueFromDiceGroup(group);
    const p = rb.translation();
    const r = rb.rotation();
    lockDice();
    onRollFinished?.(die.id, value, {
      position: { x: p.x, y: p.y, z: p.z },
      rotation: { x: r.x, y: r.y, z: r.z, w: r.w },
    });
  }, [die.id, lockDice, onRollFinished]);

  const checkRollFinished = useCallback(() => {
    const rb = rigidBodyRef.current;
    if (!rb || lockedRef.current) return;
    if (!thrownRef.current) return;
    const linearSpeed = magnitude(rb.linvel());
    const angularSpeed = magnitude(rb.angvel());
    const pos = rb.translation();
    const validPosition = pos.y < MAX_SETTLE_Y;
    const now = performance.now() / 1000;
    const thrownAt = thrownAtRef.current ?? now;

    if (linearSpeed > DICE_SETTLEMENT.linearSpeed || angularSpeed > DICE_SETTLEMENT.angularSpeed || !validPosition) {
      lowSpeedSinceRef.current = null;
    } else if (lowSpeedSinceRef.current == null) {
      lowSpeedSinceRef.current = now;
    }

    const decision = decideDiceSettlement({
      elapsedSeconds: now - thrownAt,
      quietSeconds: lowSpeedSinceRef.current == null ? 0 : now - lowSpeedSinceRef.current,
      linearSpeed,
      angularSpeed,
      inTray: validPosition,
      sleeping: rb.isSleeping(),
    });
    if (decision === 'damp' && !dampingAppliedRef.current) {
      rb.setLinearDamping(2.5);
      rb.setAngularDamping(3.5);
      dampingAppliedRef.current = true;
      return;
    }
    if (decision === 'settle') {
      resolveNow();
    }
  }, [resolveNow]);

  useFrame(() => checkRollFinished());

  /**
   * Quando o pai destrava (armed=false), aplicamos impulso/torque para
   * lançar este dado. A resolução acontece quando a velocidade ficar baixa
   * de forma contínua — sem timer arbitrário.
   */
  useEffect(() => {
    if (armed || thrownRef.current) return;
    const rb = rigidBodyRef.current;
    if (!rb) return;
    rb.wakeUp?.();
    rb.setLinvel(
      { x: dieThrow.linearVelocity.x * THROW_SPEED, y: dieThrow.linearVelocity.y * THROW_SPEED, z: dieThrow.linearVelocity.z * THROW_SPEED },
      true,
    );
    rb.setAngvel(
      { x: dieThrow.angularVelocity.x * SPIN_SPEED, y: dieThrow.angularVelocity.y * SPIN_SPEED, z: dieThrow.angularVelocity.z * SPIN_SPEED },
      true,
    );
    thrownRef.current = true;
    thrownAtRef.current = performance.now() / 1000;
    lowSpeedSinceRef.current = null;
    dampingAppliedRef.current = false;
  }, [armed, dieThrow]);

  // Resetar cursor quando desmontar.
  useEffect(() => () => { document.body.style.cursor = ''; }, []);

  const handlePointerDown = useCallback((e: any) => {
    if (!armed || thrownRef.current) return;
    e.stopPropagation();
    onThrowRequest?.(die.id);
  }, [armed, die.id, onThrowRequest]);

  const handlePointerOver = useCallback((e: any) => {
    if (!armed || thrownRef.current) return;
    e.stopPropagation();
    document.body.style.cursor = 'pointer';
  }, [armed]);

  const handlePointerOut = useCallback(() => {
    document.body.style.cursor = '';
  }, []);

  return (
    <RigidBody
      ref={rigidBodyRef}
      type={armed ? 'fixed' : 'dynamic'}
      gravityScale={2.4}
      density={1.3}
      friction={1.1}
      restitution={Math.min(0.9, 0.55 * bounciness)}
      ccd
      linearDamping={0.3}
      angularDamping={0.4}
      position={position}
      rotation={rotation}
      linearVelocity={[0, 0, 0]}
      angularVelocity={[0, 0, 0]}
    >
      <group
        ref={groupRef}
        onPointerDown={handlePointerDown}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        <DiceCollider diceType={die.type} />
        {children}
      </group>
    </RigidBody>
  );
}

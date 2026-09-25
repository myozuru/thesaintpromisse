export interface Vec2 {
  x: number;
  y: number;
}

export type WallKind = "barrier" | "darkness";

export interface Wall {
  id: string;
  points: Vec2[];
  closed?: boolean;
  /**
   * "barrier" (padrão): sala/parede que bloqueia visão — qualquer visão (token ou luz) revela.
   * "darkness": área de escuridão — só revela onde há iluminação real (luzes manuais
   * ou tochas em tokens); a visão pura do token não revela sozinha (vira "secundária"
   * que só conta dentro de luz).
   */
  kind?: WallKind;
}

export interface Door {
  id: string;
  a: Vec2;
  b: Vec2;
  open: boolean;
  /** Parede onde a porta está encaixada (opcional para portas livres antigas). */
  wallId?: string;
  /** Índice da aresta da parede (0..N-1, incluindo a aresta de fechamento). */
  segIndex?: number;
  /** Parâmetros [0..1] ao longo da aresta delimitando a porta. */
  t0?: number;
  t1?: number;
}

export type LightShape = "full" | "cone";
export type LightEdge = "solid" | "blurred";
export type LightType = "primary" | "secondary";

export interface Light {
  id: string;
  position: Vec2;
  /** Raio em pixels */
  radius: number;
  /** Full circle ou cone */
  shape: LightShape;
  /** Direção do cone em radianos (0 = direita) */
  coneDirection: number;
  /** Abertura total do cone em radianos */
  coneAngle: number;
  /** Borda sólida (hard) ou desfocada (gradient) */
  edge: LightEdge;
  /** primary = ilumina sempre; secondary = só dentro do polígono de um primary */
  type: LightType;
  color?: string;
}

export type Tool =
  | "select"
  | "wall"
  | "rect"
  | "ellipse"
  | "door"
  | "light"
  | "move-light"
  | "edit";

export interface Segment {
  a: Vec2;
  b: Vec2;
}

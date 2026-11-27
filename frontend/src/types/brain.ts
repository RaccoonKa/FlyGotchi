export type FlyBehaviorState =
  | 'idle'
  | 'grooming'
  | 'walk'
  | 'fly'
  | 'eat'
  | 'drink'
  | 'sleep'
  | 'startled'
  | 'electrocuted';

export interface Neuromodulators {
  octopamine: number;
  dopamine: number;
  serotonin: number;
}

export interface BrainClusters {
  vision: number;
  olfactory: number;
  mushroomBody: number;
  motor: number;
  hunger: number;
}

export interface BrainTelemetry {
  tick: number;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  lookAngle: number;
  state: FlyBehaviorState;
  neuromodulators: Neuromodulators;
  clusters: BrainClusters;
  arena: {
    width: number;
    height: number;
  };
}

export type SensoryInputEvent =
  | { type: 'cursor_hover'; x: number; y: number }
  | { type: 'feed_drop'; x: number; y: number }
  | { type: 'dew_drink'; x: number; y: number }
  | { type: 'feather_tickle'; x: number; y: number }
  | { type: 'flashlight'; enabled: boolean; x?: number; y?: number }
  | { type: 'electrode_zap'; cluster: keyof BrainClusters; intensity?: number };

export type TimeOfDay = 'morning' | 'day' | 'sunset' | 'night';

export type MockMode = 'autopilot' | 'manual';

export type ConnectionStatus = 'mock' | 'connecting' | 'connected' | 'disconnected';

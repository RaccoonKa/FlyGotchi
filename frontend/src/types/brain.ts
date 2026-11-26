export type FlyBehaviorState = 'foraging' | 'resting' | 'startled' | 'feeding';

export interface NeuralClusters {
  vision: number;
  motor: number;
  hunger: number;
}

export interface BrainState {
  tick: number;
  x: number;
  y: number;
  angle: number;
  hunger: number;
  state: FlyBehaviorState;
  clusters: NeuralClusters;
  arena: {
    width: number;
    height: number;
  };
}

export type ClientCommand =
  | { action: 'feed' }
  | { action: 'stimulate_vision' }
  | { action: 'poke'; x: number; y: number };

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

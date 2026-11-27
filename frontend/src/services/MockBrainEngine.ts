import type {
  BrainClusters,
  BrainTelemetry,
  FlyBehaviorState,
  MockMode,
  Neuromodulators,
  SensoryInputEvent,
} from '../types/brain';

const ARENA_WIDTH = 800;
const ARENA_HEIGHT = 600;
// Root Y range so the fly's sitting feet (root.y + ~39px) rest directly on the windowsill
const SILL_MIN_Y = 398;
const SILL_MAX_Y = 462;
const TICK_INTERVAL_MS = 50; // 20 Hz

const LANDMARKS = {
  berry: { x: 175, y: 368 },
  dew: { x: 525, y: 292 },
  restSpot: { x: 465, y: 446 },
  center: { x: 375, y: 442 },
};

function pickValidPerchSpot(): { x: number; y: number } {
  const roll = Math.random();
  if (roll < 0.36) {
    // Windowsill surface (avoiding basket x=115..235 and pot x=575..695)
    const x =
      Math.random() < 0.78
        ? 250 + Math.random() * 305
        : 78 + Math.random() * 42;
    return { x, y: SILL_MIN_Y + Math.random() * (SILL_MAX_Y - SILL_MIN_Y) };
  }
  if (roll < 0.56) {
    // Horizontal window crossbar (y=206 -> feet at 212 -> root.y = 177)
    const onLeftPane = Math.random() < 0.5;
    return {
      x: onLeftPane ? 105 + Math.random() * 265 : 430 + Math.random() * 265,
      y: 177,
    };
  }
  if (roll < 0.7) {
    // Vertical white window bar (x=400, resting along the bar)
    return {
      x: 400,
      y: 78 + Math.random() * 290,
    };
  }
  if (roll < 0.86) {
    // Left or right flower leaf (feet resting on top of leaf surface)
    return Math.random() < 0.55
      ? { x: 520 + Math.random() * 55, y: 288 + Math.random() * 10 }
      : { x: 660 + Math.random() * 52, y: 278 + Math.random() * 10 };
  }
  // Berry basket rim / top berries
  return {
    x: 152 + Math.random() * 46,
    y: 366 + Math.random() * 8,
  };
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export type TelemetryListener = (telemetry: BrainTelemetry) => void;

export class MockBrainEngine {
  private timerId: number | null = null;
  private listeners = new Set<TelemetryListener>();

  private mode: MockMode = 'autopilot';
  private tick = 0;

  private x = LANDMARKS.center.x;
  private y = LANDMARKS.center.y;
  private targetX = LANDMARKS.center.x;
  private targetY = LANDMARKS.center.y;
  private lookAngle = 0;
  private state: FlyBehaviorState = 'idle';
  private stateTicksRemaining = 40;

  private neuromodulators: Neuromodulators = {
    octopamine: 0.22,
    dopamine: 0.45,
    serotonin: 0.55,
  };

  private clusters: BrainClusters = {
    vision: 0.25,
    olfactory: 0.2,
    mushroomBody: 0.3,
    motor: 0.15,
    hunger: 0.28,
  };

  private clusterBoosts: BrainClusters = {
    vision: 0,
    olfactory: 0,
    mushroomBody: 0,
    motor: 0,
    hunger: 0,
  };

  private cursorGazeTicks = 0;
  private flashlightEnabled = false;

  private manualNeuromodulators: Neuromodulators | null = null;
  private manualClusters: BrainClusters | null = null;

  start(): void {
    if (this.timerId !== null) return;
    this.emit();
    this.timerId = window.setInterval(() => {
      this.step();
      this.emit();
    }, TICK_INTERVAL_MS);
  }

  stop(): void {
    if (this.timerId !== null) {
      window.clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  subscribe(listener: TelemetryListener): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => {
      this.listeners.delete(listener);
    };
  }

  getMode(): MockMode {
    return this.mode;
  }

  setMode(mode: MockMode): void {
    this.mode = mode;
    if (mode === 'autopilot') {
      this.manualNeuromodulators = null;
      this.manualClusters = null;
      this.stateTicksRemaining = 25;
    }
    this.emit();
  }

  forceState(state: FlyBehaviorState): void {
    this.state = state;
    this.stateTicksRemaining = 80;
    if (state === 'walk' || state === 'fly') {
      this.pickRandomTarget(state === 'fly');
    } else if (state === 'eat') {
      this.targetX = LANDMARKS.berry.x;
      this.targetY = LANDMARKS.berry.y;
    } else if (state === 'drink') {
      this.targetX = LANDMARKS.dew.x;
      this.targetY = LANDMARKS.dew.y;
    } else if (state === 'sleep') {
      this.targetX = LANDMARKS.restSpot.x;
      this.targetY = LANDMARKS.restSpot.y;
    }
    this.emit();
  }

  setManualNeuromodulators(values: Neuromodulators): void {
    this.manualNeuromodulators = { ...values };
    this.neuromodulators = { ...values };
    this.emit();
  }

  setManualClusters(values: BrainClusters): void {
    this.manualClusters = { ...values };
    this.clusters = { ...values };
    this.emit();
  }

  handleInput(event: SensoryInputEvent): void {
    switch (event.type) {
      case 'cursor_hover': {
        const dx = event.x - this.x;
        const dy = event.y - this.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 4) {
          this.lookAngle = Math.atan2(dy, dx);
          this.cursorGazeTicks = 24;
        }
        if (dist < 130) {
          this.clusterBoosts.vision = Math.max(this.clusterBoosts.vision, 0.55);
        }
        break;
      }

      case 'feed_drop': {
        this.targetX = event.x;
        this.targetY = event.y;
        this.lookAngle = Math.atan2(event.y - this.y, event.x - this.x);
        this.clusterBoosts.olfactory = 0.85;
        this.clusterBoosts.mushroomBody = 0.65;
        if (this.mode === 'autopilot') {
          this.state = Math.hypot(event.x - this.x, event.y - this.y) > 160 ? 'fly' : 'walk';
          this.stateTicksRemaining = 55;
        }
        break;
      }

      case 'dew_drink': {
        this.targetX = event.x;
        this.targetY = event.y;
        this.lookAngle = Math.atan2(event.y - this.y, event.x - this.x);
        this.clusterBoosts.olfactory = 0.5;
        this.neuromodulators.serotonin = clamp01(this.neuromodulators.serotonin + 0.12);
        if (this.mode === 'autopilot') {
          this.state = 'drink';
          this.stateTicksRemaining = 50;
        }
        break;
      }

      case 'feather_tickle': {
        this.clusterBoosts.vision = 0.6;
        this.clusterBoosts.motor = 0.75;
        this.neuromodulators.octopamine = clamp01(this.neuromodulators.octopamine + 0.25);
        const dist = Math.hypot(event.x - this.x, event.y - this.y);
        if (this.mode === 'autopilot') {
          if (dist < 85) {
            this.state = 'startled';
            this.stateTicksRemaining = 24;
            const escapeSpot = pickValidPerchSpot();
            this.targetX = escapeSpot.x;
            this.targetY = escapeSpot.y;
          } else {
            this.state = 'grooming';
            this.stateTicksRemaining = 45;
          }
        }
        break;
      }

      case 'flashlight': {
        this.flashlightEnabled = event.enabled;
        if (event.enabled) {
          this.clusterBoosts.vision = 0.92;
          if (event.x !== undefined && event.y !== undefined) {
            this.lookAngle = Math.atan2(event.y - this.y, event.x - this.x);
            this.cursorGazeTicks = 30;
          }
        }
        break;
      }

      case 'electrode_zap': {
        const intensity = event.intensity ?? 0.95;
        this.clusterBoosts[event.cluster] = Math.max(this.clusterBoosts[event.cluster], intensity);
        this.clusterBoosts.motor = Math.max(this.clusterBoosts.motor, 0.85);
        this.neuromodulators.octopamine = clamp01(this.neuromodulators.octopamine + 0.35);
        if (this.mode === 'autopilot') {
          this.state = 'electrocuted';
          this.stateTicksRemaining = 22;
        }
        break;
      }
    }
  }

  getSnapshot(): BrainTelemetry {
    return {
      tick: this.tick,
      x: Math.round(this.x * 100) / 100,
      y: Math.round(this.y * 100) / 100,
      targetX: Math.round(this.targetX * 100) / 100,
      targetY: Math.round(this.targetY * 100) / 100,
      lookAngle: Math.round(this.lookAngle * 1000) / 1000,
      state: this.state,
      neuromodulators: { ...this.neuromodulators },
      clusters: { ...this.clusters },
      arena: {
        width: ARENA_WIDTH,
        height: ARENA_HEIGHT,
      },
    };
  }

  private step(): void {
    this.tick += 1;

    if (this.cursorGazeTicks > 0) {
      this.cursorGazeTicks -= 1;
    }

    if (this.mode === 'autopilot') {
      this.stepAutopilot();
    } else {
      this.stepKinematics();
    }

    this.stepSignals();
  }

  private stepAutopilot(): void {
    const arrived = this.stepKinematics();
    const isMoving =
      this.state === 'walk' || this.state === 'fly' || this.state === 'startled';

    // Never stop or switch to idle/grooming/sleep in mid-air before landing on a perch
    if (isMoving) {
      if (arrived) {
        if (Math.hypot(this.x - LANDMARKS.berry.x, this.y - LANDMARKS.berry.y) < 35) {
          this.state = 'eat';
          this.stateTicksRemaining = 50;
        } else if (Math.hypot(this.x - LANDMARKS.dew.x, this.y - LANDMARKS.dew.y) < 35) {
          this.state = 'drink';
          this.stateTicksRemaining = 45;
        } else {
          this.state = Math.random() < 0.45 ? 'grooming' : 'idle';
          this.stateTicksRemaining = 40 + Math.floor(Math.random() * 45);
        }
      }
      return;
    }

    this.stateTicksRemaining -= 1;
    if (this.stateTicksRemaining <= 0) {
      this.pickNextAutopilotState();
    }
  }

  private pickNextAutopilotState(): void {
    const roll = Math.random();
    if (this.clusters.hunger > 0.68 || roll < 0.16) {
      this.targetX = LANDMARKS.berry.x;
      this.targetY = LANDMARKS.berry.y;
      this.state = 'fly';
      this.stateTicksRemaining = 70;
    } else if (roll < 0.28) {
      this.targetX = LANDMARKS.dew.x;
      this.targetY = LANDMARKS.dew.y;
      this.state = 'fly';
      this.stateTicksRemaining = 75;
    } else if (roll < 0.72) {
      const isOnSill =
        this.y >= SILL_MIN_Y - 12 &&
        this.y <= SILL_MAX_Y + 12 &&
        this.x >= 245 &&
        this.x <= 555;
      if (roll < 0.52 && isOnSill) {
        this.pickRandomTarget(false);
        this.state = 'walk';
        this.stateTicksRemaining = 70;
      } else {
        this.pickRandomTarget(true);
        this.state = 'fly';
        this.stateTicksRemaining = 70;
      }
    } else if (roll < 0.88) {
      this.state = 'grooming';
      this.stateTicksRemaining = 45;
    } else if (roll < 0.95) {
      this.state = 'idle';
      this.stateTicksRemaining = 40;
    } else {
      const nearRest =
        Math.hypot(this.x - LANDMARKS.restSpot.x, this.y - LANDMARKS.restSpot.y) < 25;
      if (nearRest) {
        this.state = 'sleep';
        this.stateTicksRemaining = 85;
      } else {
        this.targetX = LANDMARKS.restSpot.x;
        this.targetY = LANDMARKS.restSpot.y;
        this.state = 'fly';
        this.stateTicksRemaining = 75;
      }
    }
  }

  private pickRandomTarget(isFlight: boolean): void {
    if (isFlight) {
      const spot = pickValidPerchSpot();
      this.targetX = spot.x;
      this.targetY = spot.y;
      return;
    }
    // Walking stays strictly on the windowsill surface (between basket & pot)
    this.targetX = 245 + Math.random() * (550 - 245);
    this.targetY = SILL_MIN_Y + Math.random() * (SILL_MAX_Y - SILL_MIN_Y);
  }

  private stepKinematics(): boolean {
    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    const dist = Math.hypot(dx, dy);

    let speedPerTick = 0;
    if (this.state === 'walk') speedPerTick = 2.6;
    else if (this.state === 'fly') speedPerTick = 6.2;
    else if (this.state === 'startled') speedPerTick = 8.5;

    if (speedPerTick > 0 && dist > 2) {
      const step = Math.min(dist, speedPerTick);
      this.x += (dx / dist) * step;
      this.y += (dy / dist) * step;
      if (this.cursorGazeTicks <= 0) {
        this.lookAngle = Math.atan2(dy, dx);
      }
      return dist - step <= 2;
    }

    return dist <= 2;
  }

  private stepSignals(): void {
    // Decay transient sensory boosts
    for (const key of Object.keys(this.clusterBoosts) as Array<keyof BrainClusters>) {
      this.clusterBoosts[key] *= 0.88;
    }

    if (!this.manualNeuromodulators) {
      const targetOcto =
        this.state === 'startled' || this.state === 'electrocuted'
          ? 0.88
          : this.state === 'fly'
            ? 0.45
            : 0.18;
      const targetDopa = this.state === 'eat' || this.state === 'drink' ? 0.85 : 0.42;
      const targetSero = this.state === 'sleep' ? 0.9 : this.state === 'grooming' ? 0.65 : 0.45;

      this.neuromodulators.octopamine = clamp01(lerp(this.neuromodulators.octopamine, targetOcto, 0.06));
      this.neuromodulators.dopamine = clamp01(lerp(this.neuromodulators.dopamine, targetDopa, 0.05));
      this.neuromodulators.serotonin = clamp01(lerp(this.neuromodulators.serotonin, targetSero, 0.04));
    }

    if (!this.manualClusters) {
      const t = this.tick * 0.14;
      const waveA = (Math.sin(t) + 1) * 0.06;
      const waveB = (Math.cos(t * 0.7) + 1) * 0.05;

      const hungerDelta = this.state === 'eat' ? -0.012 : 0.0008;
      const nextHunger = clamp01(this.clusters.hunger + hungerDelta);

      const baseVision = this.flashlightEnabled ? 0.82 : this.state === 'sleep' ? 0.06 : 0.22;
      const baseOlfactory = this.state === 'eat' || this.state === 'drink' ? 0.62 : 0.18;
      const baseMushroom =
        this.state === 'eat' || this.state === 'grooming'
          ? 0.55
          : 0.24 + this.neuromodulators.dopamine * 0.2;
      const baseMotor =
        this.state === 'fly' || this.state === 'startled' || this.state === 'electrocuted'
          ? 0.82
          : this.state === 'walk'
            ? 0.52
            : this.state === 'grooming'
              ? 0.34
              : this.state === 'sleep'
                ? 0.04
                : 0.12;

      this.clusters = {
        vision: clamp01(Math.max(baseVision + waveA, this.clusterBoosts.vision)),
        olfactory: clamp01(Math.max(baseOlfactory + waveB, this.clusterBoosts.olfactory)),
        mushroomBody: clamp01(Math.max(baseMushroom + waveA * 0.8, this.clusterBoosts.mushroomBody)),
        motor: clamp01(Math.max(baseMotor + waveB * 0.9, this.clusterBoosts.motor)),
        hunger: clamp01(Math.max(nextHunger, this.clusterBoosts.hunger)),
      };
    }
  }

  private emit(): void {
    const snapshot = this.getSnapshot();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }
}

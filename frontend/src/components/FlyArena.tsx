import { useEffect, useRef } from 'react';
import { Application, Container, Graphics } from 'pixi.js';
import type { BrainState } from '../types/brain';

interface FlyArenaProps {
  brainState: BrainState | null;
  onPoke: (x: number, y: number) => void;
}

interface Ripple {
  graphic: Graphics;
  age: number;
  maxAge: number;
}

const ARENA_WIDTH = 800;
const ARENA_HEIGHT = 600;

function lerpAngle(current: number, target: number, alpha: number): number {
  const diff = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + diff * alpha;
}

function buildFlyGraphic(): {
  flyContainer: Container;
  leftWing: Graphics;
  rightWing: Graphics;
} {
  const flyContainer = new Container();

  // Six schematic legs
  const legs = new Graphics();
  const legPairs = [
    [-4, -6, -12, -16],
    [0, -7, 0, -18],
    [4, -6, 12, -15],
    [-4, 6, -12, 16],
    [0, 7, 0, 18],
    [4, 6, 12, 15],
  ];
  for (const [x1, y1, x2, y2] of legPairs) {
    legs.moveTo(x1, y1).lineTo(x2, y2);
  }
  legs.stroke({ width: 1.5, color: 0x94a3b8 });
  flyContainer.addChild(legs);

  // Abdomen (striped amber/dark)
  const abdomen = new Graphics();
  abdomen.ellipse(-11, 0, 11, 7).fill({ color: 0xd97706 });
  abdomen.rect(-18, -5, 3, 10).fill({ color: 0x1e293b, alpha: 0.7 });
  abdomen.rect(-12, -6, 3, 12).fill({ color: 0x1e293b, alpha: 0.7 });
  flyContainer.addChild(abdomen);

  // Thorax
  const thorax = new Graphics();
  thorax.ellipse(2, 0, 7, 6).fill({ color: 0xf59e0b });
  flyContainer.addChild(thorax);

  // Head & iconic Drosophila red compound eyes
  const head = new Graphics();
  head.circle(10, 0, 5).fill({ color: 0xb45309 });
  head.circle(12, -3.5, 2.5).fill({ color: 0xef4444 });
  head.circle(12, 3.5, 2.5).fill({ color: 0xef4444 });
  // Antennae
  head.moveTo(14, -1.5).lineTo(19, -4).moveTo(14, 1.5).lineTo(19, 4);
  head.stroke({ width: 1.2, color: 0xcbd5e1 });
  flyContainer.addChild(head);

  // Translucent wings animated independently
  const leftWing = new Graphics();
  leftWing
    .ellipse(-8, -8, 12, 5)
    .fill({ color: 0xe2e8f0, alpha: 0.35 })
    .stroke({ width: 1, color: 0x94a3b8, alpha: 0.65 });
  leftWing.pivot.set(2, 0);

  const rightWing = new Graphics();
  rightWing
    .ellipse(-8, 8, 12, 5)
    .fill({ color: 0xe2e8f0, alpha: 0.35 })
    .stroke({ width: 1, color: 0x94a3b8, alpha: 0.65 });
  rightWing.pivot.set(2, 0);

  flyContainer.addChild(leftWing, rightWing);

  return { flyContainer, leftWing, rightWing };
}

export function FlyArena({ brainState, onPoke }: FlyArenaProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const targetRef = useRef<{ x: number; y: number; angle: number; motor: number; state: string }>({
    x: ARENA_WIDTH / 2,
    y: ARENA_HEIGHT / 2,
    angle: 0,
    motor: 0.3,
    state: 'foraging',
  });
  const onPokeRef = useRef(onPoke);
  const spawnRippleRef = useRef<((x: number, y: number) => void) | null>(null);

  useEffect(() => {
    onPokeRef.current = onPoke;
  }, [onPoke]);

  useEffect(() => {
    if (!brainState) return;
    targetRef.current = {
      x: brainState.x,
      y: brainState.y,
      angle: brainState.angle,
      motor: brainState.clusters.motor,
      state: brainState.state,
    };
  }, [brainState]);

  useEffect(() => {
    const mount = containerRef.current;
    if (!mount) return;

    let destroyed = false;
    const app = new Application();
    const ripples: Ripple[] = [];

    const initPixi = async () => {
      await app.init({
        width: ARENA_WIDTH,
        height: ARENA_HEIGHT,
        background: '#0b1120',
        antialias: true,
      });

      if (destroyed) {
        app.destroy(true, { children: true });
        return;
      }

      app.canvas.style.width = '100%';
      app.canvas.style.height = 'auto';
      app.canvas.style.display = 'block';
      app.canvas.style.cursor = 'crosshair';
      mount.appendChild(app.canvas);

      // Arena grid & petri dish border
      const bg = new Graphics();
      for (let gx = 40; gx < ARENA_WIDTH; gx += 40) {
        bg.moveTo(gx, 0).lineTo(gx, ARENA_HEIGHT);
      }
      for (let gy = 40; gy < ARENA_HEIGHT; gy += 40) {
        bg.moveTo(0, gy).lineTo(ARENA_WIDTH, gy);
      }
      bg.stroke({ width: 1, color: 0x1e293b, alpha: 0.65 });
      bg.rect(16, 16, ARENA_WIDTH - 32, ARENA_HEIGHT - 32).stroke({
        width: 2,
        color: 0x334155,
      });
      app.stage.addChild(bg);

      const trailLayer = new Graphics();
      const rippleLayer = new Container();
      const { flyContainer, leftWing, rightWing } = buildFlyGraphic();

      flyContainer.x = targetRef.current.x;
      flyContainer.y = targetRef.current.y;
      flyContainer.rotation = targetRef.current.angle;

      app.stage.addChild(trailLayer, rippleLayer, flyContainer);

      const trailPoints: Array<{ x: number; y: number }> = [];
      let wingPhase = 0;

      spawnRippleRef.current = (rx: number, ry: number) => {
        const g = new Graphics();
        g.x = rx;
        g.y = ry;
        rippleLayer.addChild(g);
        ripples.push({ graphic: g, age: 0, maxAge: 28 });
      };

      app.ticker.add((ticker) => {
        const alpha = Math.min(1, 0.22 * ticker.deltaTime);
        const target = targetRef.current;

        flyContainer.x += (target.x - flyContainer.x) * alpha;
        flyContainer.y += (target.y - flyContainer.y) * alpha;
        flyContainer.rotation = lerpAngle(flyContainer.rotation, target.angle, alpha);

        // Wing flutter speed scales with motor cluster activity
        const flutterRate = target.state === 'resting' ? 0.08 : 0.35 + target.motor * 0.7;
        wingPhase += flutterRate * ticker.deltaTime;
        const wingAngle = Math.sin(wingPhase) * (target.state === 'resting' ? 0.04 : 0.22);
        leftWing.rotation = -wingAngle;
        rightWing.rotation = wingAngle;

        // Movement trail
        trailPoints.push({ x: flyContainer.x, y: flyContainer.y });
        if (trailPoints.length > 48) {
          trailPoints.shift();
        }
        trailLayer.clear();
        for (let i = 1; i < trailPoints.length; i++) {
          const prev = trailPoints[i - 1];
          const curr = trailPoints[i];
          const progress = i / trailPoints.length;
          trailLayer
            .moveTo(prev.x, prev.y)
            .lineTo(curr.x, curr.y)
            .stroke({ width: 1.5, color: 0x38bdf8, alpha: progress * 0.35 });
        }

        // Update click ripples
        for (let i = ripples.length - 1; i >= 0; i--) {
          const r = ripples[i];
          r.age += ticker.deltaTime;
          if (r.age >= r.maxAge) {
            rippleLayer.removeChild(r.graphic);
            r.graphic.destroy();
            ripples.splice(i, 1);
            continue;
          }
          const t = r.age / r.maxAge;
          r.graphic.clear();
          r.graphic
            .circle(0, 0, 8 + t * 34)
            .stroke({ width: 2, color: 0x38bdf8, alpha: 1 - t });
        }
      });

      app.canvas.addEventListener('pointerdown', (event: PointerEvent) => {
        const rect = app.canvas.getBoundingClientRect();
        const scaleX = ARENA_WIDTH / rect.width;
        const scaleY = ARENA_HEIGHT / rect.height;
        const x = Math.round((event.clientX - rect.left) * scaleX);
        const y = Math.round((event.clientY - rect.top) * scaleY);
        spawnRippleRef.current?.(x, y);
        onPokeRef.current(x, y);
      });
    };

    void initPixi();

    return () => {
      destroyed = true;
      spawnRippleRef.current = null;
      if (app.renderer) {
        app.destroy(true, { children: true });
      }
      mount.innerHTML = '';
    };
  }, []);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2.5 text-xs text-slate-400">
        <span>Арена Drosophila (800 × 600)</span>
        <span>Клик по арене отправляет poke(x, y)</span>
      </div>
      <div ref={containerRef} className="w-full" />
    </div>
  );
}

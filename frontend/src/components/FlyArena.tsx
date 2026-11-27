import { useEffect, useRef } from 'react';
import { Application, Container, Graphics } from 'pixi.js';
import { ChibiFlyRig } from '../scene/ChibiFlyRig';
import {
  createWindowsillScene,
  SCENE_HEIGHT,
  SCENE_WIDTH,
  SILL_INTERACTABLES,
  type WindowsillSceneHandle,
} from '../scene/WindowsillScene';
import type {
  BrainClusters,
  BrainTelemetry,
  FlyBehaviorState,
  Neuromodulators,
  SensoryInputEvent,
  TimeOfDay,
} from '../types/brain';

interface FlyArenaProps {
  telemetry: BrainTelemetry | null;
  timeOfDay: TimeOfDay;
  xrayEnabled: boolean;
  onInput: (event: SensoryInputEvent) => void;
}

interface Ripple {
  graphic: Graphics;
  color: number;
  age: number;
  maxAge: number;
}

const TIME_LABELS: Record<TimeOfDay, string> = {
  morning: 'Утро',
  day: 'День',
  sunset: 'Закат',
  night: 'Ночь',
};

export function FlyArena({ telemetry, timeOfDay, xrayEnabled, onInput }: FlyArenaProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<WindowsillSceneHandle | null>(null);
  const timeOfDayRef = useRef<TimeOfDay>(timeOfDay);
  const xrayRef = useRef<boolean>(xrayEnabled);
  const cursorPosRef = useRef<{ x: number; y: number } | null>(null);

  const targetRef = useRef<{
    x: number;
    y: number;
    lookAngle: number;
    state: FlyBehaviorState;
    clusters: BrainClusters;
    neuromodulators: Neuromodulators;
  }>({
    x: 375,
    y: 442,
    lookAngle: 0,
    state: 'idle',
    clusters: {
      vision: 0.25,
      olfactory: 0.2,
      mushroomBody: 0.3,
      motor: 0.2,
      hunger: 0.25,
    },
    neuromodulators: {
      octopamine: 0.2,
      dopamine: 0.45,
      serotonin: 0.5,
    },
  });

  const onInputRef = useRef(onInput);
  const spawnRippleRef = useRef<((x: number, y: number, color?: number) => void) | null>(null);

  useEffect(() => {
    onInputRef.current = onInput;
  }, [onInput]);

  useEffect(() => {
    timeOfDayRef.current = timeOfDay;
    sceneRef.current?.setTimeOfDay(timeOfDay);
  }, [timeOfDay]);

  useEffect(() => {
    xrayRef.current = xrayEnabled;
  }, [xrayEnabled]);

  useEffect(() => {
    if (!telemetry) return;
    targetRef.current = {
      x: telemetry.x,
      y: telemetry.y,
      lookAngle: telemetry.lookAngle,
      state: telemetry.state,
      clusters: telemetry.clusters,
      neuromodulators: telemetry.neuromodulators,
    };
  }, [telemetry]);

  useEffect(() => {
    const mount = containerRef.current;
    if (!mount) return;

    let destroyed = false;
    const app = new Application();
    const ripples: Ripple[] = [];

    const initPixi = async () => {
      await app.init({
        width: SCENE_WIDTH,
        height: SCENE_HEIGHT,
        background: '#131726',
        antialias: true,
        resolution: Math.min(3, Math.max(window.devicePixelRatio || 1, 2)),
        autoDensity: true,
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

      const scene = createWindowsillScene(
        (x, y) => {
          spawnRippleRef.current?.(x, y, 0x38bdf8);
          onInputRef.current({ type: 'dew_drink', x, y });
        },
        (x, y) => {
          spawnRippleRef.current?.(x, y, 0xfb7185);
          onInputRef.current({ type: 'feed_drop', x, y });
        }
      );
      scene.setTimeOfDay(timeOfDayRef.current);
      sceneRef.current = scene;
      app.stage.addChild(scene.root);

      const rippleLayer = new Container();
      app.stage.addChild(rippleLayer);

      const flyRig = new ChibiFlyRig();
      flyRig.root.x = targetRef.current.x;
      flyRig.root.y = targetRef.current.y;
      scene.flyLayer.addChild(flyRig.root);

      let lastHoverSent = 0;

      spawnRippleRef.current = (rx: number, ry: number, color = 0x38bdf8) => {
        const g = new Graphics();
        g.x = rx;
        g.y = ry;
        rippleLayer.addChild(g);
        ripples.push({ graphic: g, color, age: 0, maxAge: 28 });
      };

      app.ticker.add((ticker) => {
        const alpha = Math.min(1, 0.22 * ticker.deltaTime);
        const target = targetRef.current;

        scene.update(ticker.deltaTime, timeOfDayRef.current);

        flyRig.root.x += (target.x - flyRig.root.x) * alpha;
        flyRig.root.y += (target.y - flyRig.root.y) * alpha;

        // Perspective depth scaling: closer on foreground sill -> slightly larger
        const depthScale = 0.84 + Math.max(0, Math.min(1, flyRig.root.y / SCENE_HEIGHT)) * 0.28;
        flyRig.root.scale.set(depthScale);

        const isFlying = target.state === 'fly' || target.state === 'startled';
        scene.shadow.x = flyRig.root.x;
        scene.shadow.y = flyRig.root.y + (isFlying ? 52 : 39) * depthScale;
        scene.shadow.scale.set(isFlying ? depthScale * 0.68 : depthScale);
        scene.shadow.alpha = isFlying ? 0.2 : 0.36;

        const cursorOffset = cursorPosRef.current
          ? {
              dx: cursorPosRef.current.x - flyRig.root.x,
              dy: cursorPosRef.current.y - flyRig.root.y,
            }
          : null;

        flyRig.update({
          deltaTime: ticker.deltaTime,
          state: target.state,
          clusters: target.clusters,
          neuromodulators: target.neuromodulators,
          lookAngle: target.lookAngle,
          cursorOffset,
          xrayEnabled: xrayRef.current,
        });

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
            .stroke({ width: 2, color: r.color, alpha: 1 - t });
        }
      });

      const toArenaCoords = (event: PointerEvent) => {
        const rect = app.canvas.getBoundingClientRect();
        const scaleX = SCENE_WIDTH / rect.width;
        const scaleY = SCENE_HEIGHT / rect.height;
        return {
          x: Math.round((event.clientX - rect.left) * scaleX),
          y: Math.round((event.clientY - rect.top) * scaleY),
        };
      };

      app.canvas.addEventListener('pointerdown', (event: PointerEvent) => {
        const { x, y } = toArenaCoords(event);
        const hitDew =
          Math.hypot(x - SILL_INTERACTABLES.dewDrop.x, y - SILL_INTERACTABLES.dewDrop.y) <=
          SILL_INTERACTABLES.dewDrop.radius;
        const hitBerry =
          Math.hypot(
            x - SILL_INTERACTABLES.berryBasket.x,
            y - SILL_INTERACTABLES.berryBasket.y
          ) <= SILL_INTERACTABLES.berryBasket.radius;
        if (!hitDew && !hitBerry) {
          spawnRippleRef.current?.(x, y, 0x38bdf8);
          onInputRef.current({ type: 'feather_tickle', x, y });
        }
      });

      app.canvas.addEventListener('pointermove', (event: PointerEvent) => {
        const coords = toArenaCoords(event);
        cursorPosRef.current = coords;
        const now = performance.now();
        if (now - lastHoverSent < 60) return;
        lastHoverSent = now;
        onInputRef.current({ type: 'cursor_hover', x: coords.x, y: coords.y });
      });

      app.canvas.addEventListener('pointerleave', () => {
        cursorPosRef.current = null;
      });
    };

    void initPixi();

    return () => {
      destroyed = true;
      sceneRef.current = null;
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
        <span>Подоконник (анфас) · Освещение: {TIME_LABELS[timeOfDay]}</span>
        <span>Клик по корзинке/росе — покормить/напоить · По сцене — щекотка</span>
      </div>
      <div ref={containerRef} className="w-full" />
    </div>
  );
}

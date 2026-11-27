import { useState } from 'react';
import type {
  BrainClusters,
  BrainTelemetry,
  FlyBehaviorState,
  MockMode,
  Neuromodulators,
  TimeOfDay,
} from '../types/brain';

interface GraphicsDevPanelProps {
  isMock: boolean;
  mode: MockMode;
  telemetry: BrainTelemetry | null;
  timeOfDay: TimeOfDay;
  onModeChange: (mode: MockMode) => void;
  onForceState: (state: FlyBehaviorState) => void;
  onNeuromodulatorsChange: (values: Neuromodulators) => void;
  onClustersChange: (values: BrainClusters) => void;
  onTimeOfDayChange: (time: TimeOfDay) => void;
}

const BEHAVIOR_STATES: Array<{ id: FlyBehaviorState; label: string }> = [
  { id: 'idle', label: 'idle' },
  { id: 'grooming', label: 'grooming' },
  { id: 'walk', label: 'walk' },
  { id: 'fly', label: 'fly' },
  { id: 'eat', label: 'eat' },
  { id: 'drink', label: 'drink' },
  { id: 'sleep', label: 'sleep' },
  { id: 'startled', label: 'startled' },
  { id: 'electrocuted', label: 'electrocuted' },
];

const TIME_OF_DAY_OPTIONS: Array<{ id: TimeOfDay; label: string }> = [
  { id: 'morning', label: 'Утро' },
  { id: 'day', label: 'День' },
  { id: 'sunset', label: 'Закат' },
  { id: 'night', label: 'Ночь' },
];

const NEUROMODULATOR_FIELDS: Array<{ key: keyof Neuromodulators; label: string }> = [
  { key: 'octopamine', label: 'Octopamine' },
  { key: 'dopamine', label: 'Dopamine' },
  { key: 'serotonin', label: 'Serotonin' },
];

const CLUSTER_FIELDS: Array<{ key: keyof BrainClusters; label: string }> = [
  { key: 'vision', label: 'Vision' },
  { key: 'olfactory', label: 'Olfactory' },
  { key: 'mushroomBody', label: 'Mushroom Body' },
  { key: 'motor', label: 'Motor' },
  { key: 'hunger', label: 'Hunger' },
];

export function GraphicsDevPanel({
  isMock,
  mode,
  telemetry,
  timeOfDay,
  onModeChange,
  onForceState,
  onNeuromodulatorsChange,
  onClustersChange,
  onTimeOfDayChange,
}: GraphicsDevPanelProps) {
  const [isOpen, setIsOpen] = useState(false);

  const neuromodulators: Neuromodulators = telemetry?.neuromodulators ?? {
    octopamine: 0.2,
    dopamine: 0.4,
    serotonin: 0.5,
  };

  const clusters: BrainClusters = telemetry?.clusters ?? {
    vision: 0.2,
    olfactory: 0.2,
    mushroomBody: 0.2,
    motor: 0.2,
    hunger: 0.2,
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
      {isOpen && (
        <div className="max-h-[82vh] w-80 overflow-y-auto rounded-2xl border border-slate-700/80 bg-slate-900/95 p-4 text-xs text-slate-200 shadow-2xl backdrop-blur-md">
          <div className="mb-3 flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="font-semibold text-white">Graphics Dev Sandbox</span>
            <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-400">
              {isMock ? 'MOCK' : 'WS'}
            </span>
          </div>

          {/* Режим работы мока */}
          <div className="mb-4 space-y-1.5">
            <div className="text-[11px] font-medium text-slate-400">Режим мока</div>
            <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-slate-950 p-1">
              <button
                type="button"
                disabled={!isMock}
                onClick={() => onModeChange('autopilot')}
                className={`rounded-lg px-2 py-1.5 font-medium transition ${
                  mode === 'autopilot'
                    ? 'bg-violet-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                } disabled:opacity-40`}
              >
                Автопилот
              </button>
              <button
                type="button"
                disabled={!isMock}
                onClick={() => onModeChange('manual')}
                className={`rounded-lg px-2 py-1.5 font-medium transition ${
                  mode === 'manual'
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-400 hover:text-slate-200'
                } disabled:opacity-40`}
              >
                Ручное управление
              </button>
            </div>
          </div>

          {/* Время суток */}
          <div className="mb-4 space-y-1.5">
            <div className="text-[11px] font-medium text-slate-400">Время суток (освещение)</div>
            <div className="grid grid-cols-4 gap-1">
              {TIME_OF_DAY_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onTimeOfDayChange(opt.id)}
                  className={`rounded-lg border px-1.5 py-1.5 text-[11px] font-medium transition ${
                    timeOfDay === opt.id
                      ? 'border-sky-400 bg-sky-500/20 text-sky-200'
                      : 'border-slate-800 bg-slate-950/70 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Принудительные состояния */}
          <div className="mb-4 space-y-1.5">
            <div className="text-[11px] font-medium text-slate-400">
              Принудительное состояние (FlyBehaviorState)
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {BEHAVIOR_STATES.map((item) => {
                const active = telemetry?.state === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={!isMock}
                    onClick={() => {
                      if (mode !== 'manual') {
                        onModeChange('manual');
                      }
                      onForceState(item.id);
                    }}
                    className={`rounded-lg border px-1.5 py-1.5 font-mono text-[11px] transition ${
                      active
                        ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200'
                        : 'border-slate-800 bg-slate-950/70 text-slate-300 hover:border-slate-700'
                    } disabled:opacity-40`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Слайдеры нейромедиаторов */}
          <div className="mb-4 space-y-2">
            <div className="text-[11px] font-medium text-slate-400">Нейромедиаторы</div>
            {NEUROMODULATOR_FIELDS.map(({ key, label }) => (
              <label key={key} className="block space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-300">{label}</span>
                  <span className="font-mono text-slate-400">
                    {Math.round(neuromodulators[key] * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  disabled={!isMock}
                  value={neuromodulators[key]}
                  onChange={(e) => {
                    if (mode !== 'manual') {
                      onModeChange('manual');
                    }
                    onNeuromodulatorsChange({
                      ...neuromodulators,
                      [key]: Number(e.target.value),
                    });
                  }}
                  className="h-1.5 w-full cursor-pointer accent-amber-400 disabled:opacity-40"
                />
              </label>
            ))}
          </div>

          {/* Слайдеры кластеров мозга */}
          <div className="space-y-2">
            <div className="text-[11px] font-medium text-slate-400">Кластеры мозга</div>
            {CLUSTER_FIELDS.map(({ key, label }) => (
              <label key={key} className="block space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-300">{label}</span>
                  <span className="font-mono text-slate-400">
                    {Math.round(clusters[key] * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  disabled={!isMock}
                  value={clusters[key]}
                  onChange={(e) => {
                    if (mode !== 'manual') {
                      onModeChange('manual');
                    }
                    onClustersChange({
                      ...clusters,
                      [key]: Number(e.target.value),
                    });
                  }}
                  className="h-1.5 w-full cursor-pointer accent-sky-400 disabled:opacity-40"
                />
              </label>
            ))}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/95 px-4 py-2 text-xs font-semibold text-slate-100 shadow-xl backdrop-blur-md transition hover:border-violet-400 hover:text-white"
      >
        <span className="h-2 w-2 rounded-full bg-violet-400" />
        <span>{isOpen ? 'Скрыть Dev Sandbox' : 'Dev Sandbox'}</span>
      </button>
    </div>
  );
}

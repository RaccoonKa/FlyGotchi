import { useState } from 'react';
import type {
  BrainTelemetry,
  ConnectionStatus,
  FlyBehaviorState,
  SensoryInputEvent,
} from '../types/brain';

interface TelemetryPanelProps {
  telemetry: BrainTelemetry | null;
  status: ConnectionStatus;
  onSendEvent: (event: SensoryInputEvent) => void;
}

type TelemetrySection = 'status' | 'clusters' | 'neuromodulators';

interface MeterBarProps {
  label: string;
  value: number;
  colorClass: string;
}

function MeterBar({ label, value, colorClass }: MeterBarProps) {
  const percent = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px] font-medium">
        <span className="text-slate-300">{label}</span>
        <span className="font-mono text-slate-400">{percent}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
        <div
          className={`h-full rounded-full transition-all duration-100 ${colorClass}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

const STATUS_BADGE: Record<ConnectionStatus, { text: string; style: string }> = {
  mock: {
    text: 'Мок-мозг',
    style: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
  },
  connected: {
    text: 'WS онлайн',
    style: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  },
  connecting: {
    text: 'Подключение...',
    style: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  },
  disconnected: {
    text: 'Переподключение...',
    style: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  },
};

const BEHAVIOR_LABELS: Record<FlyBehaviorState, string> = {
  idle: 'Покой',
  grooming: 'Чистка лапок',
  walk: 'Прогулка',
  fly: 'Полёт',
  eat: 'Поедание малины',
  drink: 'Питьё росы',
  sleep: 'Сон',
  startled: 'Испуг',
  electrocuted: 'Электрошок',
};

export function TelemetryPanel({ telemetry, status, onSendEvent }: TelemetryPanelProps) {
  const [openSections, setOpenSections] = useState<Record<TelemetrySection, boolean>>({
    status: false,
    clusters: false,
    neuromodulators: false,
  });

  const toggleSection = (section: TelemetrySection) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const badge = STATUS_BADGE[status];
  const isReady = status === 'mock' || status === 'connected';

  return (
    <section className="rounded-2xl border border-slate-800/90 bg-slate-900/80 p-3.5 shadow-xl backdrop-blur">
      {/* Компактная строка действий и переключателей секций */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!isReady}
            onClick={() => onSendEvent({ type: 'feed_drop', x: 175, y: 368 })}
            className="rounded-xl bg-amber-500 px-3 py-1.5 text-xs font-semibold text-slate-950 transition hover:bg-amber-400 disabled:opacity-40"
          >
            Угостить малиной
          </button>
          <button
            type="button"
            disabled={!isReady}
            onClick={() => onSendEvent({ type: 'dew_drink', x: 525, y: 292 })}
            className="rounded-xl border border-cyan-500/40 bg-cyan-500/15 px-3 py-1.5 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-500/25 disabled:opacity-40"
          >
            Напоить росой
          </button>
          <button
            type="button"
            disabled={!isReady}
            onClick={() => onSendEvent({ type: 'flashlight', enabled: true, x: 400, y: 120 })}
            className="rounded-xl border border-sky-500/40 bg-sky-500/15 px-3 py-1.5 text-xs font-semibold text-sky-200 transition hover:bg-sky-500/25 disabled:opacity-40"
          >
            Фонарик
          </button>
          <button
            type="button"
            disabled={!isReady}
            onClick={() => onSendEvent({ type: 'electrode_zap', cluster: 'motor', intensity: 0.95 })}
            className="rounded-xl border border-rose-500/40 bg-rose-500/15 px-3 py-1.5 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/25 disabled:opacity-40"
          >
            Электрод
          </button>
        </div>

        {/* Скрываемые разделы телеметрии + мини-статус */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1 text-[11px] text-slate-300">
            {telemetry ? BEHAVIOR_LABELS[telemetry.state] : '—'}
          </span>
          <span className={`mr-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${badge.style}`}>
            {badge.text}
          </span>

          <button
            type="button"
            onClick={() => toggleSection('status')}
            className={`rounded-lg border px-2.5 py-1 text-[11px] font-medium transition ${
              openSections.status
                ? 'border-slate-500 bg-slate-800 text-white'
                : 'border-slate-800 bg-slate-950/70 text-slate-400 hover:text-slate-200'
            }`}
          >
            {openSections.status ? '▾ Статус' : '▸ Статус'}
          </button>
          <button
            type="button"
            onClick={() => toggleSection('clusters')}
            className={`rounded-lg border px-2.5 py-1 text-[11px] font-medium transition ${
              openSections.clusters
                ? 'border-sky-500/60 bg-sky-500/15 text-sky-200'
                : 'border-slate-800 bg-slate-950/70 text-slate-400 hover:text-slate-200'
            }`}
          >
            {openSections.clusters ? '▾ Кластеры' : '▸ Кластеры'}
          </button>
          <button
            type="button"
            onClick={() => toggleSection('neuromodulators')}
            className={`rounded-lg border px-2.5 py-1 text-[11px] font-medium transition ${
              openSections.neuromodulators
                ? 'border-amber-500/60 bg-amber-500/15 text-amber-200'
                : 'border-slate-800 bg-slate-950/70 text-slate-400 hover:text-slate-200'
            }`}
          >
            {openSections.neuromodulators ? '▾ Медиаторы' : '▸ Медиаторы'}
          </button>
        </div>
      </div>

      {/* Раскрывающиеся по выбору блоки телеметрии */}
      {(openSections.status || openSections.clusters || openSections.neuromodulators) && (
        <div className="mt-3 grid grid-cols-1 gap-3 border-t border-slate-800/80 pt-3 md:grid-cols-3">
          {openSections.status && (
            <div className="grid grid-cols-2 gap-2.5 rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-xs">
              <div>
                <div className="text-[11px] text-slate-500">Состояние</div>
                <div className="mt-0.5 font-medium text-slate-200">
                  {telemetry ? BEHAVIOR_LABELS[telemetry.state] : '—'}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-500">Тик</div>
                <div className="mt-0.5 font-mono text-slate-200">{telemetry?.tick ?? 0}</div>
              </div>
              <div>
                <div className="text-[11px] text-slate-500">Координаты</div>
                <div className="mt-0.5 font-mono text-slate-200">
                  {telemetry ? `${Math.round(telemetry.x)}, ${Math.round(telemetry.y)}` : '—, —'}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-500">Угол взгляда</div>
                <div className="mt-0.5 font-mono text-slate-200">
                  {telemetry ? `${Math.round((telemetry.lookAngle * 180) / Math.PI)}°` : '—'}
                </div>
              </div>
            </div>
          )}

          {openSections.clusters && (
            <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-950/70 p-3">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Кластеры мозга
              </div>
              <MeterBar label="Vision" value={telemetry?.clusters.vision ?? 0} colorClass="bg-sky-400" />
              <MeterBar
                label="Olfactory"
                value={telemetry?.clusters.olfactory ?? 0}
                colorClass="bg-lime-400"
              />
              <MeterBar
                label="Mushroom Body"
                value={telemetry?.clusters.mushroomBody ?? 0}
                colorClass="bg-fuchsia-400"
              />
              <MeterBar label="Motor" value={telemetry?.clusters.motor ?? 0} colorClass="bg-emerald-400" />
              <MeterBar label="Hunger" value={telemetry?.clusters.hunger ?? 0} colorClass="bg-amber-400" />
            </div>
          )}

          {openSections.neuromodulators && (
            <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-950/70 p-3">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Нейромодуляторы
              </div>
              <MeterBar
                label="Octopamine (возбуждение)"
                value={telemetry?.neuromodulators.octopamine ?? 0}
                colorClass="bg-rose-400"
              />
              <MeterBar
                label="Dopamine (награда)"
                value={telemetry?.neuromodulators.dopamine ?? 0}
                colorClass="bg-amber-300"
              />
              <MeterBar
                label="Serotonin (покой)"
                value={telemetry?.neuromodulators.serotonin ?? 0}
                colorClass="bg-indigo-400"
              />
            </div>
          )}
        </div>
      )}
    </section>
  );
}

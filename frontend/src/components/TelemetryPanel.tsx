import type { BrainState, ClientCommand, ConnectionStatus } from '../types/brain';

interface TelemetryPanelProps {
  brainState: BrainState | null;
  status: ConnectionStatus;
  onSendCommand: (cmd: ClientCommand) => void;
}

interface ClusterBarProps {
  label: string;
  value: number;
  colorClass: string;
}

function ClusterBar({ label, value, colorClass }: ClusterBarProps) {
  const percent = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs font-medium">
        <span className="text-slate-300">{label}</span>
        <span className="font-mono text-slate-400">{percent}%</span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-800">
        <div
          className={`h-full rounded-full transition-all duration-100 ${colorClass}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

const STATUS_BADGE: Record<ConnectionStatus, { text: string; style: string }> = {
  connected: {
    text: 'WS подключён',
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

const BEHAVIOR_LABELS: Record<BrainState['state'], string> = {
  foraging: 'Поиск пищи',
  resting: 'Покой',
  startled: 'Испуг / реакция',
  feeding: 'Питание',
};

export function TelemetryPanel({ brainState, status, onSendCommand }: TelemetryPanelProps) {
  const badge = STATUS_BADGE[status];
  const isConnected = status === 'connected';

  return (
    <aside className="flex flex-col gap-5 rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-2xl">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-slate-100">Телеметрия мозга</h2>
          <p className="text-xs text-slate-400">Коннектом Drosophila (20 Hz)</p>
        </div>
        <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${badge.style}`}>
          {badge.text}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-xs">
        <div>
          <div className="text-slate-500">Состояние</div>
          <div className="mt-0.5 font-medium text-slate-200">
            {brainState ? BEHAVIOR_LABELS[brainState.state] : '—'}
          </div>
        </div>
        <div>
          <div className="text-slate-500">Тик</div>
          <div className="mt-0.5 font-mono text-slate-200">{brainState?.tick ?? 0}</div>
        </div>
        <div>
          <div className="text-slate-500">Координаты</div>
          <div className="mt-0.5 font-mono text-slate-200">
            {brainState ? `${Math.round(brainState.x)}, ${Math.round(brainState.y)}` : '—, —'}
          </div>
        </div>
        <div>
          <div className="text-slate-500">Голод</div>
          <div className="mt-0.5 font-mono text-slate-200">
            {brainState ? `${Math.round(brainState.hunger * 100)}%` : '—'}
          </div>
        </div>
      </div>

      <div className="space-y-3.5">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Активность нейронных кластеров
        </h3>
        <ClusterBar
          label="Vision (зрительная доля)"
          value={brainState?.clusters.vision ?? 0}
          colorClass="bg-sky-400"
        />
        <ClusterBar
          label="Motor (моторный контур)"
          value={brainState?.clusters.motor ?? 0}
          colorClass="bg-emerald-400"
        />
        <ClusterBar
          label="Hunger (метаболический драйв)"
          value={brainState?.clusters.hunger ?? 0}
          colorClass="bg-amber-400"
        />
      </div>

      <div className="mt-auto space-y-2.5 pt-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Стимуляция и уход
        </h3>
        <button
          type="button"
          disabled={!isConnected}
          onClick={() => onSendCommand({ action: 'feed' })}
          className="w-full rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-amber-400 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Покормить
        </button>
        <button
          type="button"
          disabled={!isConnected}
          onClick={() => onSendCommand({ action: 'stimulate_vision' })}
          className="w-full rounded-xl border border-sky-500/40 bg-sky-500/15 px-4 py-2.5 text-sm font-semibold text-sky-200 transition hover:bg-sky-500/25 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Стимулировать зрительный нерв
        </button>
      </div>
    </aside>
  );
}

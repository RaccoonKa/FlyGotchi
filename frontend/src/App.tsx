import { FlyArena } from './components/FlyArena';
import { TelemetryPanel } from './components/TelemetryPanel';
import { useBrainSocket } from './hooks/useBrainSocket';

export function App() {
  const { brainState, status, sendCommand } = useBrainSocket();

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">FlyGotchi</h1>
            <p className="text-sm text-slate-400">
              Цифровой питомец на базе симуляции коннектома плодовой мушки (Drosophila)
            </p>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 font-mono text-xs text-slate-400">
            ws://localhost:8000/ws/brain
          </div>
        </header>

        <main className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
          <FlyArena
            brainState={brainState}
            onPoke={(x, y) => sendCommand({ action: 'poke', x, y })}
          />
          <TelemetryPanel
            brainState={brainState}
            status={status}
            onSendCommand={sendCommand}
          />
        </main>
      </div>
    </div>
  );
}

export default App;

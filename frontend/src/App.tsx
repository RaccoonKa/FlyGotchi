import { useState } from 'react';
import { FlyArena } from './components/FlyArena';
import { GraphicsDevPanel } from './components/GraphicsDevPanel';
import { TelemetryPanel } from './components/TelemetryPanel';
import { useBrainConnection } from './hooks/useBrainConnection';
import type {
  BrainClusters,
  FlyBehaviorState,
  MockMode,
  Neuromodulators,
  TimeOfDay,
} from './types/brain';

export function App() {
  const { telemetry, status, isMock, connection, sendEvent } = useBrainConnection();
  const [mockMode, setMockMode] = useState<MockMode>('autopilot');
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>('day');
  const [xrayEnabled, setXrayEnabled] = useState(false);

  const handleModeChange = (nextMode: MockMode) => {
    setMockMode(nextMode);
    connection.getMockEngine()?.setMode(nextMode);
  };

  const handleForceState = (state: FlyBehaviorState) => {
    connection.getMockEngine()?.forceState(state);
  };

  const handleNeuromodulatorsChange = (values: Neuromodulators) => {
    connection.getMockEngine()?.setManualNeuromodulators(values);
  };

  const handleClustersChange = (values: BrainClusters) => {
    connection.getMockEngine()?.setManualClusters(values);
  };

  return (
    <div className="min-h-screen bg-slate-950 px-3 py-4 text-slate-100 sm:px-5 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-3">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
          <div className="flex items-baseline gap-3">
            <h1 className="text-xl font-bold tracking-tight text-white">FlyGotchi</h1>
            <p className="hidden text-xs text-slate-400 sm:block">
              Цифровой питомец на базе коннектома Drosophila
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setXrayEnabled((prev) => !prev)}
              className={`rounded-lg border px-3 py-1 text-xs font-semibold transition ${
                xrayEnabled
                  ? 'border-sky-400 bg-sky-500/20 text-sky-200 shadow-sm shadow-sky-500/20'
                  : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-600'
              }`}
            >
              {xrayEnabled ? 'Рентген мозга: ВКЛ' : 'Рентген мозга: ВЫКЛ'}
            </button>
            <div className="rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1 font-mono text-[11px] text-slate-400">
              {isMock ? 'MOCK' : 'WS:8000'}
            </div>
          </div>
        </header>

        <main className="space-y-3">
          <FlyArena
            telemetry={telemetry}
            timeOfDay={timeOfDay}
            xrayEnabled={xrayEnabled}
            onInput={sendEvent}
          />
          <TelemetryPanel telemetry={telemetry} status={status} onSendEvent={sendEvent} />
        </main>
      </div>

      <GraphicsDevPanel
        isMock={isMock}
        mode={mockMode}
        telemetry={telemetry}
        timeOfDay={timeOfDay}
        onModeChange={handleModeChange}
        onForceState={handleForceState}
        onNeuromodulatorsChange={handleNeuromodulatorsChange}
        onClustersChange={handleClustersChange}
        onTimeOfDayChange={setTimeOfDay}
      />
    </div>
  );
}

export default App;

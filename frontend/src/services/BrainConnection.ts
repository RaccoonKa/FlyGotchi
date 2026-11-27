import type {
  BrainTelemetry,
  ConnectionStatus,
  SensoryInputEvent,
} from '../types/brain';
import { MockBrainEngine, type TelemetryListener } from './MockBrainEngine';

export type StatusListener = (status: ConnectionStatus) => void;

function getUseMockFlag(): boolean {
  const raw = import.meta.env.VITE_USE_MOCK_BRAIN as string | undefined;
  if (raw === undefined) return true;
  return raw.toLowerCase() !== 'false';
}

function getWebSocketUrl(): string {
  const customUrl = import.meta.env.VITE_WS_URL as string | undefined;
  if (customUrl) return customUrl;
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.hostname || 'localhost';
  return `${protocol}//${host}:8000/ws/brain`;
}

export class BrainConnection {
  readonly isMock: boolean;
  private mockEngine: MockBrainEngine | null = null;
  private ws: WebSocket | null = null;
  private reconnectTimer: number | null = null;
  private disposed = false;

  private status: ConnectionStatus;
  private telemetryListeners = new Set<TelemetryListener>();
  private statusListeners = new Set<StatusListener>();
  private mockUnsubscribe: (() => void) | null = null;

  constructor(useMock = getUseMockFlag()) {
    this.isMock = useMock;
    this.status = useMock ? 'mock' : 'connecting';
  }

  connect(): void {
    this.disposed = false;

    if (this.isMock) {
      if (!this.mockEngine) {
        this.mockEngine = new MockBrainEngine();
      }
      if (!this.mockUnsubscribe) {
        this.mockUnsubscribe = this.mockEngine.subscribe((telemetry) => {
          for (const listener of this.telemetryListeners) {
            listener(telemetry);
          }
        });
      }
      this.mockEngine.start();
      this.setStatus('mock');
      return;
    }

    this.openWebSocket();
  }

  disconnect(): void {
    this.disposed = true;
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.mockUnsubscribe?.();
    this.mockUnsubscribe = null;
    this.mockEngine?.stop();
    this.ws?.close();
    this.ws = null;
  }

  getMockEngine(): MockBrainEngine | null {
    return this.mockEngine;
  }

  getStatus(): ConnectionStatus {
    return this.status;
  }

  subscribeTelemetry(listener: TelemetryListener): () => void {
    this.telemetryListeners.add(listener);
    if (this.mockEngine) {
      listener(this.mockEngine.getSnapshot());
    }
    return () => {
      this.telemetryListeners.delete(listener);
    };
  }

  subscribeStatus(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    listener(this.status);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  sendEvent(event: SensoryInputEvent): void {
    if (this.isMock && this.mockEngine) {
      this.mockEngine.handleInput(event);
      return;
    }

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(event));
    }
  }

  private setStatus(next: ConnectionStatus): void {
    this.status = next;
    for (const listener of this.statusListeners) {
      listener(next);
    }
  }

  private openWebSocket(): void {
    if (this.disposed) return;
    this.setStatus('connecting');

    const ws = new WebSocket(getWebSocketUrl());
    this.ws = ws;

    ws.onopen = () => {
      if (!this.disposed) {
        this.setStatus('connected');
      }
    };

    ws.onmessage = (msg: MessageEvent<string>) => {
      try {
        const parsed = JSON.parse(msg.data) as Partial<BrainTelemetry>;
        if (typeof parsed.tick === 'number' && parsed.clusters) {
          const telemetry: BrainTelemetry = {
            tick: parsed.tick,
            x: parsed.x ?? 400,
            y: parsed.y ?? 300,
            targetX: parsed.targetX ?? parsed.x ?? 400,
            targetY: parsed.targetY ?? parsed.y ?? 300,
            lookAngle: parsed.lookAngle ?? 0,
            state: parsed.state ?? 'idle',
            neuromodulators: parsed.neuromodulators ?? {
              octopamine: 0.2,
              dopamine: 0.4,
              serotonin: 0.5,
            },
            clusters: {
              vision: parsed.clusters.vision ?? 0,
              olfactory: parsed.clusters.olfactory ?? 0,
              mushroomBody: parsed.clusters.mushroomBody ?? 0,
              motor: parsed.clusters.motor ?? 0,
              hunger: parsed.clusters.hunger ?? 0,
            },
            arena: parsed.arena ?? { width: 800, height: 600 },
          };
          for (const listener of this.telemetryListeners) {
            listener(telemetry);
          }
        }
      } catch {
        // Ignore malformed frames
      }
    };

    ws.onerror = () => {
      ws.close();
    };

    ws.onclose = () => {
      if (this.disposed) return;
      this.setStatus('disconnected');
      this.reconnectTimer = window.setTimeout(() => this.openWebSocket(), 1500);
    };
  }
}

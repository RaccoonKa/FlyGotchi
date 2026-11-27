import { useCallback, useEffect, useRef, useState } from 'react';
import { BrainConnection } from '../services/BrainConnection';
import type { BrainTelemetry, ConnectionStatus, SensoryInputEvent } from '../types/brain';

export function useBrainConnection() {
  const connectionRef = useRef<BrainConnection | null>(null);
  if (!connectionRef.current) {
    connectionRef.current = new BrainConnection();
  }

  const [telemetry, setTelemetry] = useState<BrainTelemetry | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>(connectionRef.current.getStatus());

  useEffect(() => {
    const conn = connectionRef.current!;
    const unsubTelemetry = conn.subscribeTelemetry(setTelemetry);
    const unsubStatus = conn.subscribeStatus(setStatus);
    conn.connect();

    return () => {
      unsubTelemetry();
      unsubStatus();
      conn.disconnect();
    };
  }, []);

  const sendEvent = useCallback((event: SensoryInputEvent) => {
    connectionRef.current?.sendEvent(event);
  }, []);

  return {
    telemetry,
    status,
    isMock: connectionRef.current.isMock,
    connection: connectionRef.current,
    sendEvent,
  };
}

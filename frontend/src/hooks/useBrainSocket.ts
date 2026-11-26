import { useCallback, useEffect, useRef, useState } from 'react';
import type { BrainState, ClientCommand, ConnectionStatus } from '../types/brain';

function getWebSocketUrl(): string {
  const customUrl = import.meta.env.VITE_WS_URL as string | undefined;
  if (customUrl) {
    return customUrl;
  }
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.hostname || 'localhost';
  return `${protocol}//${host}:8000/ws/brain`;
}

export function useBrainSocket() {
  const [brainState, setBrainState] = useState<BrainState | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let unmounted = false;

    const connect = () => {
      if (unmounted) return;
      setStatus('connecting');

      const ws = new WebSocket(getWebSocketUrl());
      wsRef.current = ws;

      ws.onopen = () => {
        if (!unmounted) {
          setStatus('connected');
        }
      };

      ws.onmessage = (event: MessageEvent<string>) => {
        try {
          const parsed = JSON.parse(event.data) as BrainState | { error?: string };
          if ('tick' in parsed && 'clusters' in parsed) {
            setBrainState(parsed);
          }
        } catch {
          // Ignore malformed frames
        }
      };

      ws.onerror = () => {
        ws.close();
      };

      ws.onclose = () => {
        if (unmounted) return;
        setStatus('disconnected');
        reconnectTimerRef.current = window.setTimeout(connect, 1500);
      };
    };

    connect();

    return () => {
      unmounted = true;
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
      }
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, []);

  const sendCommand = useCallback((command: ClientCommand) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(command));
    }
  }, []);

  return { brainState, status, sendCommand };
}

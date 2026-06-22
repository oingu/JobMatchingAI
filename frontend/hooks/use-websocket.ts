"use client";

import { useEffect, useState } from "react";

type WebSocketMessage = {
  type: string;
  [key: string]: any;
};

let globalWs: WebSocket | null = null;
let globalWsToken: string | null = null;
const listeners = new Set<(msg: WebSocketMessage) => void>();
let reconnectTimeout: NodeJS.Timeout | undefined;

function connectGlobal(token: string) {
  if (globalWsToken === token && globalWs?.readyState === WebSocket.OPEN) return;
  if (globalWs) {
    globalWs.onclose = null; // prevent reconnect loop on intentional close
    globalWs.close();
  }
  
  globalWsToken = token;
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = process.env.NEXT_PUBLIC_API_URL 
    ? process.env.NEXT_PUBLIC_API_URL.replace(/^http(s)?:\/\//, '') 
    : "localhost:8000";
    
  const wsUrl = `${protocol}//${host}/ws?token=${token}`;
  globalWs = new WebSocket(wsUrl);

  globalWs.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      listeners.forEach(fn => fn(data));
    } catch (e) {
      console.error("Failed to parse websocket message", e);
    }
  };

  globalWs.onclose = (event) => {
    if (event.code !== 1008 && globalWsToken === token) {
      reconnectTimeout = setTimeout(() => {
        connectGlobal(token);
      }, 3000);
    }
  };

  globalWs.onerror = () => {
    globalWs?.close();
  };
}

export function useWebSocket(token: string | null) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);

  useEffect(() => {
    if (!token) {
      if (globalWs) {
        globalWsToken = null;
        globalWs.onclose = null;
        globalWs.close();
        globalWs = null;
      }
      return;
    }

    connectGlobal(token);
    
    // Polling connection state for UI
    const interval = setInterval(() => {
      setIsConnected(globalWs?.readyState === WebSocket.OPEN);
    }, 500);
    setIsConnected(globalWs?.readyState === WebSocket.OPEN);

    const handler = (msg: WebSocketMessage) => {
      setLastMessage(msg);
    };
    listeners.add(handler);

    return () => {
      listeners.delete(handler);
      clearInterval(interval);
    };
  }, [token]);

  return { isConnected, lastMessage };
}

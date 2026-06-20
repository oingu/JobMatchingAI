"use client";

import { useEffect, useRef, useState } from "react";

type WebSocketMessage = {
  type: string;
  [key: string]: any;
};

export function useWebSocket(token: string | null) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  useEffect(() => {
    if (!token) return;

    function connect() {
      // Determine ws protocol based on window.location
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      // We assume backend is running on port 8000
      const host = process.env.NEXT_PUBLIC_API_URL 
        ? process.env.NEXT_PUBLIC_API_URL.replace(/^http(s)?:\/\//, '') 
        : "localhost:8000";
        
      const wsUrl = `${protocol}//${host}/ws?token=${token}`;
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setLastMessage(data);
        } catch (e) {
          console.error("Failed to parse websocket message", e);
        }
      };

      ws.onclose = (event) => {
        setIsConnected(false);
        if (event.code !== 1008) { // 1008 means invalid token
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, 3000);
        }
      };

      ws.onerror = (error) => {
        ws.close();
      };
    }

    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [token]);

  return { isConnected, lastMessage };
}

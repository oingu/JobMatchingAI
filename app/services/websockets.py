import json
import logging
from typing import Dict, Any

from fastapi import WebSocket

logger = logging.getLogger(__name__)

import asyncio

class ConnectionManager:
    def __init__(self):
        # Maps user_id -> List[WebSocket]
        self.active_connections: Dict[int, list[WebSocket]] = {}
        self.loop = None

    def dispatch(self, message: dict, user_id: int):
        if self.loop and self.loop.is_running():
            asyncio.run_coroutine_threadsafe(self.send_personal_message(message, user_id), self.loop)

    async def connect(self, websocket: WebSocket, user_id: int):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(websocket)
        logger.info(f"User {user_id} connected to WebSocket.")

    def disconnect(self, websocket: WebSocket, user_id: int):
        if user_id in self.active_connections:
            if websocket in self.active_connections[user_id]:
                self.active_connections[user_id].remove(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
        logger.info(f"User {user_id} disconnected from WebSocket.")

    async def send_personal_message(self, message: dict, user_id: int):
        connections = self.active_connections.get(user_id, [])
        dead_connections = []
        for websocket in connections:
            try:
                await websocket.send_json(message)
            except Exception as e:
                logger.error(f"Error sending message to user {user_id}: {e}")
                dead_connections.append(websocket)
                
        for websocket in dead_connections:
            self.disconnect(websocket, user_id)

    async def broadcast(self, message: dict):
        for user_id, connections in list(self.active_connections.items()):
            dead_connections = []
            for websocket in connections:
                try:
                    await websocket.send_json(message)
                except Exception as e:
                    logger.error(f"Error broadcasting to user {user_id}: {e}")
                    dead_connections.append(websocket)
            for websocket in dead_connections:
                self.disconnect(websocket, user_id)

manager = ConnectionManager()

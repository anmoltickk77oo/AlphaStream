import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// Initialize the WebSocket connection globally, disabled auto-connect if preferred,
// but here we let it connect on initialization.
export const socket = io(SOCKET_URL, {
    autoConnect: true,
    transports: ['websocket'], // Force WebSocket transport for performance
});
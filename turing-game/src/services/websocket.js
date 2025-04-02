import { io } from 'socket.io-client';

class SocketService {
  constructor() {
    this.socket = null;
    this.eventHandlers = new Map();
    this.messageQueue = [];
    this.isConnecting = false;
  }

  connect() {
    if (this.isConnecting) return;
    this.isConnecting = true;

    console.log('Attempting to connect to WebSocket server...');
    this.socket = io('http://localhost:8080', {
      transports: ['websocket', 'polling'],
      withCredentials: true
    });

    this.socket.on('connect', () => {
      console.log('Socket.IO connected successfully');
      this.isConnecting = false;
      // Process any queued messages
      while (this.messageQueue.length > 0) {
        const message = this.messageQueue.shift();
        console.log('Processing queued message:', message);
        this.send(message.event, message.data);
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket.IO connection error:', error);
      this.isConnecting = false;
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Socket.IO disconnected. Reason:', reason);
      this.isConnecting = false;
      // Attempt to reconnect after a delay
      setTimeout(() => this.connect(), 3000);
    });

    this.socket.on('error', (error) => {
      console.error('Socket.IO error:', error);
      this.isConnecting = false;
    });

    this.socket.on('reconnect', (attemptNumber) => {
      console.log('Socket.IO reconnected after', attemptNumber, 'attempts');
    });

    this.socket.on('reconnect_error', (error) => {
      console.error('Socket.IO reconnection error:', error);
    });
  }

  send(event, data) {
    if (!this.socket || !this.socket.connected) {
      console.log('Socket not connected, queueing message:', { event, data });
      this.messageQueue.push({ event, data });
      if (!this.isConnecting) {
        this.connect();
      }
      return;
    }

    console.log('Socket service sending message:', { event, data });
    this.socket.emit(event, data);
  }

  on(event, handler) {
    console.log('Registering handler for event:', event);
    if (!this.socket) {
      console.error('Cannot register handler: socket not initialized');
      return;
    }
    this.socket.on(event, handler);
  }

  off(event, handler) {
    console.log('Removing handler for event:', event);
    if (!this.socket) {
      console.error('Cannot remove handler: socket not initialized');
      return;
    }
    this.socket.off(event, handler);
  }

  isConnected() {
    return this.socket && this.socket.connected;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.eventHandlers.clear();
    this.messageQueue = [];
    this.isConnecting = false;
  }
}

export const wsService = new SocketService(); 
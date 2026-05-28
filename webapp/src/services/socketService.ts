
// Simple polling-based socket service (no actual WebSocket needed)
// Notifications can be polled or handled server-side

type NotificationCallback = (notification: any) => void;

class SocketService {
  private callbacks: NotificationCallback[] = [];
  private pollingInterval: ReturnType<typeof setInterval> | null = null;

  onNotification(callback: NotificationCallback): () => void {
    this.callbacks.push(callback);
    return () => {
      this.callbacks = this.callbacks.filter(cb => cb !== callback);
    };
  }

  emit(event: string, data: any): void {
    // For now, just log events locally
    // In a real app this would send to WebSocket server
    console.log(`[Socket] Emitting ${event}:`, data?.id || '');
  }

  private notify(notification: any): void {
    this.callbacks.forEach(cb => {
      try { cb(notification); } catch (e) { /* ignore */ }
    });
  }
}

export const socketService = new SocketService();

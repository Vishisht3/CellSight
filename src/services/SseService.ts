import { Response } from 'express';
import { logger } from '../utils/logger';

interface SseClient {
  userId: string;
  res: Response;
}

/**
 * Server-Sent Events hub.
 * Route handlers register clients; the AlertService calls broadcast()
 * whenever a new alert is created.
 *
 * Falls back gracefully — if the hosting platform drops the long-lived
 * connection the frontend retries via EventSource's built-in reconnect,
 * and if SSE is completely blocked the frontend falls back to polling.
 */
class SseService {
  private clients: Map<string, SseClient> = new Map();

  /** Register a new SSE client and send an initial ping */
  add(clientId: string, userId: string, res: Response): void {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // disable Nginx buffering
    res.flushHeaders();

    this.clients.set(clientId, { userId, res });
    logger.debug('SSE client connected', { clientId, userId, total: this.clients.size });

    // Heartbeat every 25 s to keep the connection alive through proxies
    const heartbeat = setInterval(() => {
      if (!res.writableEnded) {
        res.write(': heartbeat\n\n');
      } else {
        clearInterval(heartbeat);
        this.remove(clientId);
      }
    }, 25_000);

    // Send initial connected event
    this.send(res, 'connected', { clientId });

    res.on('close', () => {
      clearInterval(heartbeat);
      this.remove(clientId);
    });
  }

  remove(clientId: string): void {
    this.clients.delete(clientId);
    logger.debug('SSE client disconnected', { clientId, total: this.clients.size });
  }

  /** Broadcast a typed event to all connected clients (or a specific userId) */
  broadcast(event: string, data: unknown, toUserId?: string): void {
    let sent = 0;
    for (const [id, client] of this.clients) {
      if (toUserId && client.userId !== toUserId) continue;
      if (client.res.writableEnded) {
        this.remove(id);
        continue;
      }
      this.send(client.res, event, data);
      sent++;
    }
    if (sent > 0) logger.debug('SSE broadcast', { event, sent });
  }

  get clientCount(): number {
    return this.clients.size;
  }

  private send(res: Response, event: string, data: unknown): void {
    try {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    } catch {
      // ignore write errors — client already disconnected
    }
  }
}

export const sseService = new SseService();

import { Response } from 'express';
import { logger } from '../utils/logger';

interface SseClient {
  userId: string;
  res: Response;
}

/**
 * Server-Sent Events hub.
 *
 * The OutboxPublisher calls broadcast() with the outbox row ID as eventId.
 * That ID is written as the SSE `id:` field so browsers automatically
 * track it in EventSource.lastEventId.  On reconnect, the SSE route
 * reads Last-Event-ID and replays any missed outbox rows.
 */
class SseService {
  private clients: Map<string, SseClient> = new Map();

  add(clientId: string, userId: string, res: Response): void {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    this.clients.set(clientId, { userId, res });
    logger.debug('SSE client connected', { clientId, userId, total: this.clients.size });

    const heartbeat = setInterval(() => {
      if (!res.writableEnded) {
        res.write(': heartbeat\n\n');
      } else {
        clearInterval(heartbeat);
        this.remove(clientId);
      }
    }, 25_000);

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

  /**
   * Broadcast to all connected clients.
   * @param eventId  The outbox row ID — written as the SSE `id:` field so
   *                 the browser tracks it for Last-Event-ID replay.
   */
  broadcast(event: string, data: unknown, toUserId?: string, eventId?: string): void {
    let sent = 0;
    for (const [id, client] of this.clients) {
      if (toUserId && client.userId !== toUserId) continue;
      if (client.res.writableEnded) {
        this.remove(id);
        continue;
      }
      this.send(client.res, event, data, eventId);
      sent++;
    }
    if (sent > 0) logger.debug('SSE broadcast', { event, sent });
  }

  get clientCount(): number {
    return this.clients.size;
  }

  private send(res: Response, event: string, data: unknown, eventId?: string): void {
    try {
      const idLine = eventId ? `id: ${eventId}\n` : '';
      res.write(`${idLine}event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    } catch {
      // ignore — client already disconnected
    }
  }
}

export const sseService = new SseService();

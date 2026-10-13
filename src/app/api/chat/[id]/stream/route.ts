import { NextRequest } from 'next/server';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { subscribeToConversation } from '@/lib/events';
import { Message } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession(req);
  if (!session) {
    return new Response('Unauthorized', { status: 401 });
  }

  const conversationId = params.id;

  // Verify participant authorization
  const participant = await db.conversationParticipant.findFirst({
    where: { conversationId, userId: session.userId },
  });
  if (!participant) {
    return new Response('Forbidden', { status: 403 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection event
      controller.enqueue(
        encoder.encode(`event: connected\ndata: ${JSON.stringify({ status: 'connected', conversationId })}\n\n`)
      );

      // Subscribe to real-time events
      const unsubscribe = subscribeToConversation(
        conversationId,
        (msg: Message) => {
          try {
            const data = JSON.stringify({
              id: msg.id,
              senderId: msg.senderId,
              content: msg.content,
              createdAt: msg.createdAt,
              isMine: msg.senderId === session.userId,
            });
            controller.enqueue(encoder.encode(`event: message\ndata: ${data}\n\n`));
          } catch (err) {
            // Controller closed
          }
        },
        (endData) => {
          try {
            controller.enqueue(
              encoder.encode(`event: conversation_ended\ndata: ${JSON.stringify(endData)}\n\n`)
            );
          } catch (err) {
            // Controller closed
          }
        }
      );

      // Keepalive heartbeat every 15 seconds
      const heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`event: ping\ndata: {}\n\n`));
        } catch {
          clearInterval(heartbeatInterval);
        }
      }, 15000);

      req.signal.addEventListener('abort', () => {
        clearInterval(heartbeatInterval);
        unsubscribe();
        try {
          controller.close();
        } catch {}
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}

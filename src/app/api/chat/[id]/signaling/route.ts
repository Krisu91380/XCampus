import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { verifyAndResolveParticipants } from '@/lib/conversation';
import { pushSignal, getSignalsForUser, clearSignals } from '@/lib/signaling';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAuth(req);
    const conversationId = params.id;

    const verified = await verifyAndResolveParticipants(conversationId, session.userId);
    if (!verified) {
      return NextResponse.json(
        { success: false, message: 'Access denied. You are not a participant in this conversation.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { type, payload } = body;

    if (!type) {
      return NextResponse.json({ success: false, message: 'Signal type is required' }, { status: 400 });
    }

    const partnerId = verified.partnerId;

    if (type === 'call-end' || type === 'call-reject') {
      // Clear old signaling backlog when a call terminates
      const signal = pushSignal({
        conversationId,
        fromUserId: session.userId,
        toUserId: partnerId,
        type,
        payload,
      });
      return NextResponse.json({ success: true, signalId: signal.id });
    }

    const signal = pushSignal({
      conversationId,
      fromUserId: session.userId,
      toUserId: partnerId,
      type,
      payload,
    });

    return NextResponse.json({
      success: true,
      signalId: signal.id,
      toUserId: partnerId,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    console.error('Signaling POST error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAuth(req);
    const conversationId = params.id;

    const verified = await verifyAndResolveParticipants(conversationId, session.userId);
    if (!verified) {
      return NextResponse.json(
        { success: false, message: 'Access denied. You are not a participant in this conversation.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const sinceParam = searchParams.get('since');
    const sinceTimestamp = sinceParam ? parseInt(sinceParam, 10) : 0;

    const signals = getSignalsForUser(conversationId, session.userId, sinceTimestamp);

    return NextResponse.json({
      success: true,
      partnerId: verified.partnerId,
      signals,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req);

    // Default reliable STUN servers (Google & Mozilla)
    const iceServers: RTCIceServer[] = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
      { urls: 'stun:stun.services.mozilla.com' },
    ];

    // Check server environment variables for custom STUN/TURN configurations
    const customStun = process.env.STUN_SERVER_URL || process.env.NEXT_PUBLIC_STUN_SERVER_URL;
    if (customStun && !iceServers.some((s) => s.urls === customStun)) {
      iceServers.unshift({ urls: customStun });
    }

    const turnUrl = process.env.TURN_SERVER_URL || process.env.TURN_URL || process.env.NEXT_PUBLIC_TURN_SERVER_URL;
    const turnUsername = process.env.TURN_USERNAME || process.env.NEXT_PUBLIC_TURN_USERNAME;
    const turnCredential = process.env.TURN_CREDENTIAL || process.env.TURN_SECRET || process.env.NEXT_PUBLIC_TURN_CREDENTIAL;

    if (turnUrl) {
      iceServers.unshift({
        urls: turnUrl,
        username: turnUsername || undefined,
        credential: turnCredential || undefined,
      });
    } else {
      // Default open relay fallback for restrictive symmetric NATs
      iceServers.push({
        urls: [
          'turn:global.relay.metered.ca:80',
          'turn:global.relay.metered.ca:80?transport=tcp',
          'turn:global.relay.metered.ca:443',
          'turns:global.relay.metered.ca:443?transport=tcp',
        ],
        username: 'openrelayproject',
        credential: 'openrelayproject',
      });
    }

    return NextResponse.json({
      success: true,
      iceServers,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

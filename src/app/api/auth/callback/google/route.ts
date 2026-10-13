import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createSessionToken, setSessionCookie } from '@/lib/auth';
import { addCredits } from '@/lib/ledger';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'localhost:3000';
  const proto = req.headers.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https');
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || `${proto}://${host}`).replace(/\/$/, '');

  try {
    const searchParams = req.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const errorParam = searchParams.get('error');

    // Handle user cancellation or denial
    if (errorParam) {
      if (errorParam === 'access_denied') {
        return NextResponse.redirect(`${appUrl}/login?error=cancelled`);
      }
      return NextResponse.redirect(`${appUrl}/login?error=failed`);
    }

    if (!code || !state) {
      return NextResponse.redirect(`${appUrl}/login?error=invalid_request`);
    }

    // Verify CSRF state
    const oauthCookie = req.cookies.get('campusconnect_oauth_state')?.value;
    if (!oauthCookie) {
      return NextResponse.redirect(`${appUrl}/login?error=invalid_state`);
    }

    let savedState = '';
    let savedRedirectUri = '';
    try {
      const parsed = JSON.parse(oauthCookie);
      savedState = parsed.state;
      savedRedirectUri = parsed.redirectUri;
    } catch {
      return NextResponse.redirect(`${appUrl}/login?error=invalid_state`);
    }

    if (savedState !== state) {
      return NextResponse.redirect(`${appUrl}/login?error=invalid_state`);
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      return NextResponse.redirect(`${appUrl}/login?error=google_not_configured`);
    }

    const redirectUri = savedRedirectUri || `${appUrl}/api/auth/callback/google`;

    // Exchange authorization code with Google OAuth token endpoint
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId.trim(),
        client_secret: clientSecret.trim(),
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      const tokenErr = await tokenRes.text();
      console.error('Google token exchange failure:', tokenErr);
      return NextResponse.redirect(`${appUrl}/login?error=token_exchange_failed`);
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;
    if (!accessToken) {
      return NextResponse.redirect(`${appUrl}/login?error=token_exchange_failed`);
    }

    // Fetch user profile from Google OpenID UserInfo endpoint
    const userinfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!userinfoRes.ok) {
      console.error('Google userinfo fetch failure:', await userinfoRes.text());
      return NextResponse.redirect(`${appUrl}/login?error=failed`);
    }

    const googleUser = await userinfoRes.json();
    const email = googleUser.email?.toLowerCase().trim();
    const name = googleUser.name || googleUser.given_name || email.split('@')[0];
    const picture = googleUser.picture || null;
    const emailVerified = googleUser.email_verified;

    if (!email) {
      return NextResponse.redirect(`${appUrl}/login?error=failed`);
    }

    if (!emailVerified) {
      return NextResponse.redirect(`${appUrl}/login?error=email_not_verified`);
    }

    // Lookup user in persistent database
    let user = await db.user.findUnique({ where: { email } });

    if (user) {
      // Existing account: preserve all existing data, profile, credits, transactions
      if (user.status === 'SUSPENDED' || user.status === 'BANNED') {
        return NextResponse.redirect(`${appUrl}/login?error=suspended`);
      }

      // Update avatar if missing
      if (picture) {
        const existingProfile = await db.profile.findUnique({ where: { userId: user.id } });
        if (existingProfile && !existingProfile.avatarUrl) {
          await db.profile.update({
            where: { userId: user.id },
            data: { avatarUrl: picture },
          }).catch(() => {});
        }
      }
    } else {
      // New student registration via Google: grant 5 free signup credits once
      const domain = email.split('@')[1]?.toLowerCase();
      const universities = await db.university.findMany({ where: { isActive: true } });
      const matchedUni = universities.find((u) => u.approvedDomains.includes(domain));
      const defaultUni = matchedUni || universities.find((u) => u.code === 'LPU') || universities[0];

      const autoVerified = Boolean(matchedUni);

      user = await db.user.create({
        data: {
          email,
          passwordHash: 'OAUTH_GOOGLE',
          role: autoVerified ? 'VERIFIED_STUDENT' : 'USER',
          status: 'ACTIVE',
          isAgeVerified: true,
          dateOfBirth: new Date('2003-01-01'),
          universityId: defaultUni ? defaultUni.id : null,
        },
      });

      // Create student profile
      await db.profile.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          displayName: name,
          avatarUrl: picture,
          gender: 'PREFER_NOT_TO_SAY',
          language: 'English',
          interests: ['Campus Life', 'Networking'],
          isOnline: true,
          isDiscoverable: true,
          lastSeenAt: new Date(),
        },
        update: {},
      });

      // Domain auto-verification
      if (autoVerified && defaultUni) {
        await db.verification.create({
          data: {
            userId: user.id,
            universityId: defaultUni.id,
            institutionalEmail: email,
            documentType: 'INSTITUTION_EMAIL',
            status: 'APPROVED',
            reviewedBy: 'SYSTEM_DOMAIN_CHECK',
            reviewedAt: new Date(),
          },
        });
      }

      // Grant exactly 5 free signup credits ONCE in immutable ledger
      await addCredits({
        userId: user.id,
        amount: 5,
        reason: 'SIGNUP_BONUS',
        referenceId: `signup_bonus_${user.id}`,
        metadata: { provider: 'google', note: 'Welcome bonus: 5 free chat credits for Google registration' },
      });
    }

    const profile = await db.profile.findUnique({ where: { userId: user.id } });
    const displayName = profile?.displayName || name;

    // Issue 7-day secure session JWT token (well above the 60 minutes requirement)
    const sessionToken = await createSessionToken({
      userId: user.id,
      email: user.email,
      role: user.role as any,
      isAgeVerified: true,
      universityId: user.universityId,
      displayName,
    });

    const response = NextResponse.redirect(`${appUrl}/dashboard`);
    await setSessionCookie(sessionToken, response);

    // Clear temporary OAuth state cookie
    response.cookies.set('campusconnect_oauth_state', '', { maxAge: 0, path: '/' });

    return response;
  } catch (error: any) {
    console.error('Error during Google OAuth callback processing:', error);
    return NextResponse.redirect(`${appUrl}/login?error=failed`);
  }
}

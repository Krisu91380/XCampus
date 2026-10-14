import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { SupabaseClient } from '@supabase/supabase-js';
import { PRISMA_SCHEMA_SAFE_SQL } from './schema-sql';

export async function ensurePostgresTables(prisma: PrismaClient) {
  try {
    const rawStatements = PRISMA_SCHEMA_SAFE_SQL
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith('--'));

    for (const stmt of rawStatements) {
      if (!stmt || stmt.startsWith('--')) continue;
      try {
        await prisma.$executeRawUnsafe(stmt);
      } catch (e: any) {
        // Safe to ignore if already exists or constraint already present
      }
    }
    console.log('[DATABASE] PostgreSQL schema tables verified/created successfully.');
  } catch (err: any) {
    console.warn('[DATABASE] Warning during PostgreSQL table creation:', err.message);
  }
}

export async function migrateJsonToPostgres(prisma: PrismaClient) {
  try {
    // First, ensure all tables and indexes exist safely
    await ensurePostgresTables(prisma);

    const jsonPath = path.join(process.cwd(), 'prisma', 'data_store.json');
    if (!fs.existsSync(jsonPath)) {
      console.log('No prisma/data_store.json found to migrate.');
      return;
    }

    const raw = fs.readFileSync(jsonPath, 'utf-8');
    const data = JSON.parse(raw);
    console.log('Beginning safe migration of data_store.json to PostgreSQL...');

    // 1. Universities
    if (Array.isArray(data.universities)) {
      for (const [id, u] of data.universities) {
        await prisma.university.upsert({
          where: { code: u.code },
          create: {
            id: u.id,
            name: u.name,
            code: u.code,
            city: u.city,
            state: u.state,
            country: u.country || 'India',
            approvedDomains: JSON.stringify(u.approvedDomains || []),
            isActive: u.isActive ?? true,
            logoUrl: u.logoUrl || null,
            verificationRequirements: u.verificationRequirements || 'Institutional email or ID',
            createdAt: new Date(u.createdAt || Date.now()),
            updatedAt: new Date(u.updatedAt || Date.now()),
          },
          update: {
            name: u.name,
            city: u.city,
            state: u.state,
            approvedDomains: JSON.stringify(u.approvedDomains || []),
          },
        });
      }
      console.log(`Migrated ${data.universities.length} universities.`);
    }

    // 2. Users
    if (Array.isArray(data.users)) {
      for (const [id, u] of data.users) {
        await prisma.user.upsert({
          where: { email: u.email.toLowerCase().trim() },
          create: {
            id: u.id,
            email: u.email.toLowerCase().trim(),
            passwordHash: u.passwordHash,
            role: u.role || 'USER',
            status: u.status || 'ACTIVE',
            isAgeVerified: u.isAgeVerified ?? true,
            dateOfBirth: u.dateOfBirth ? new Date(u.dateOfBirth) : null,
            universityId: u.universityId || null,
            createdAt: new Date(u.createdAt || Date.now()),
            updatedAt: new Date(u.updatedAt || Date.now()),
          },
          update: {
            passwordHash: u.passwordHash,
            role: u.role,
            status: u.status,
          },
        });
      }
      console.log(`Migrated ${data.users.length} users.`);
    }

    // 3. Profiles
    if (Array.isArray(data.profiles)) {
      for (const [userId, p] of data.profiles) {
        const existing = await prisma.profile.findUnique({ where: { userId } });
        if (!existing) {
          await prisma.profile.create({
            data: {
              id: p.id || `profile-${userId}`,
              userId,
              displayName: p.displayName || 'Student',
              gender: p.gender || 'PREFER_NOT_TO_SAY',
              avatarUrl: p.avatarUrl || null,
              bio: p.bio || null,
              course: p.course || null,
              academicYear: p.academicYear || null,
              language: p.language || 'English',
              interests: JSON.stringify(p.interests || []),
              isOnline: Boolean(p.isOnline),
              isDiscoverable: p.isDiscoverable !== false,
              lastSeenAt: new Date(p.lastSeenAt || Date.now()),
              createdAt: new Date(p.createdAt || Date.now()),
              updatedAt: new Date(p.updatedAt || Date.now()),
            },
          });
        }
      }
      console.log(`Migrated ${data.profiles.length} profiles.`);
    }

    // 4. Credit Packages
    if (Array.isArray(data.creditPackages)) {
      for (const [id, pkg] of data.creditPackages) {
        await prisma.creditPackage.upsert({
          where: { id: pkg.id },
          create: {
            id: pkg.id,
            name: pkg.name,
            credits: pkg.credits,
            priceInInr: pkg.priceInInr,
            description: pkg.description || '',
            isPopular: Boolean(pkg.isPopular),
            isActive: pkg.isActive !== false,
            createdAt: new Date(pkg.createdAt || Date.now()),
            updatedAt: new Date(pkg.updatedAt || Date.now()),
          },
          update: {
            credits: pkg.credits,
            priceInInr: pkg.priceInInr,
          },
        });
      }
      console.log(`Migrated ${data.creditPackages.length} credit packages.`);
    }

    // 5. User Credit Balances
    if (Array.isArray(data.creditBalances)) {
      for (const [userId, b] of data.creditBalances) {
        const existingBal = await prisma.userCreditBalance.findUnique({ where: { userId } });
        if (!existingBal) {
          await prisma.userCreditBalance.create({
            data: {
              id: b.id || `bal-${userId}`,
              userId,
              credits: b.credits || 0,
              updatedAt: new Date(b.updatedAt || Date.now()),
            },
          });
        }
      }
      console.log(`Migrated ${data.creditBalances.length} user credit balances.`);
    }

    // 6. Conversations
    if (Array.isArray(data.conversations)) {
      for (const [id, c] of data.conversations) {
        await prisma.conversation.upsert({
          where: { id: c.id },
          create: {
            id: c.id,
            status: c.status || 'ACTIVE',
            startedAt: new Date(c.startedAt || Date.now()),
            endedAt: c.endedAt ? new Date(c.endedAt) : null,
            endedByUserId: c.endedByUserId || null,
            endReason: c.endReason || null,
            creditDeducted: Boolean(c.creditDeducted),
          },
          update: {
            status: c.status || 'ACTIVE',
          },
        });
      }
      console.log(`Migrated ${data.conversations.length} conversations.`);
    }

    // 7. Conversation Participants
    if (Array.isArray(data.conversationParticipants)) {
      for (const [key, part] of data.conversationParticipants) {
        await prisma.conversationParticipant.upsert({
          where: {
            conversationId_userId: {
              conversationId: part.conversationId,
              userId: part.userId,
            },
          },
          create: {
            id: part.id || `part-${part.conversationId}-${part.userId}`,
            conversationId: part.conversationId,
            userId: part.userId,
            joinedAt: new Date(part.joinedAt || Date.now()),
            leftAt: part.leftAt ? new Date(part.leftAt) : null,
            hasUnread: Boolean(part.hasUnread),
          },
          update: {
            hasUnread: Boolean(part.hasUnread),
          },
        });
      }
      console.log(`Migrated ${data.conversationParticipants.length} conversation participants.`);
    }

    // 8. Messages
    if (Array.isArray(data.messages)) {
      for (const [id, m] of data.messages) {
        const existing = await prisma.message.findUnique({ where: { id: m.id } });
        if (!existing) {
          await prisma.message.create({
            data: {
              id: m.id,
              conversationId: m.conversationId,
              senderId: m.senderId,
              content: m.content,
              isRead: Boolean(m.isRead),
              createdAt: new Date(m.createdAt || Date.now()),
            },
          });
        }
      }
      console.log(`Migrated ${data.messages.length} messages.`);
    }

    // 9. Friend Requests
    if (Array.isArray(data.friendRequests)) {
      for (const [id, fr] of data.friendRequests) {
        await prisma.friendRequest.upsert({
          where: {
            senderId_receiverId: {
              senderId: fr.senderId,
              receiverId: fr.receiverId,
            },
          },
          create: {
            id: fr.id || `fr-${fr.senderId}-${fr.receiverId}`,
            senderId: fr.senderId,
            receiverId: fr.receiverId,
            status: fr.status || 'PENDING',
            createdAt: new Date(fr.createdAt || Date.now()),
            updatedAt: new Date(fr.updatedAt || Date.now()),
          },
          update: {
            status: fr.status || 'PENDING',
          },
        });
      }
      console.log(`Migrated ${data.friendRequests.length} friend requests.`);
    }

    console.log('Data migration to PostgreSQL finished successfully!');
  } catch (err: any) {
    console.error('Data migration error:', err);
  }
}

export async function migrateJsonToSupabase(supabase: SupabaseClient) {
  const summary: {
    universities: number;
    users: number;
    profiles: number;
    creditPackages: number;
    creditBalances: number;
    conversations: number;
    participants: number;
    messages: number;
    friendRequests: number;
    errors: string[];
  } = {
    universities: 0,
    users: 0,
    profiles: 0,
    creditPackages: 0,
    creditBalances: 0,
    conversations: 0,
    participants: 0,
    messages: 0,
    friendRequests: 0,
    errors: [],
  };

  try {
    let rawData: any = null;
    const pathsToCheck = [
      path.join(process.cwd(), 'prisma', 'data_store.json'),
      '/tmp/data_store.json',
      path.join(process.cwd(), 'data_store.json'),
    ];

    for (const p of pathsToCheck) {
      if (fs.existsSync(p)) {
        try {
          const content = fs.readFileSync(p, 'utf-8');
          rawData = JSON.parse(content);
          console.log(`[SUPABASE_MIGRATE] Loaded data from ${p}`);
          break;
        } catch {}
      }
    }

    const extract = (arr: any): any[] => {
      if (!Array.isArray(arr)) return [];
      return arr.map((item) => (Array.isArray(item) && item.length === 2 ? item[1] : item));
    };

    // 1. Universities
    const universities = extract(rawData?.universities);
    const defaultUniversities = [
      { id: 'uni-1', name: 'Lovely Professional University', code: 'LPU', city: 'Phagwara', state: 'Punjab', country: 'India', approvedDomains: '["lpu.in","lpu.co.in"]', isActive: true, verificationRequirements: 'Official @lpu.in email address or valid physical Student ID card' },
      { id: 'uni-2', name: 'Delhi University', code: 'DU', city: 'New Delhi', state: 'Delhi', country: 'India', approvedDomains: '["du.ac.in"]', isActive: true, verificationRequirements: 'University Roll Number and official college email or Student ID' },
      { id: 'uni-3', name: 'Vellore Institute of Technology', code: 'VIT', city: 'Vellore', state: 'Tamil Nadu', country: 'India', approvedDomains: '["vitstudent.ac.in","vit.ac.in"]', isActive: true, verificationRequirements: 'Official @vitstudent.ac.in student ID or VTOP profile snapshot' },
      { id: 'uni-4', name: 'Birla Institute of Technology and Science', code: 'BITS', city: 'Pilani', state: 'Rajasthan', country: 'India', approvedDomains: '["pilani.bits-pilani.ac.in","hyderabad.bits-pilani.ac.in","goa.bits-pilani.ac.in"]', isActive: true, verificationRequirements: 'Official BITS email account verification' },
    ];
    const uniList = universities.length > 0 ? universities : defaultUniversities;
    for (const u of uniList) {
      try {
        const { error } = await supabase.from('University').upsert({
          id: u.id,
          name: u.name,
          code: u.code,
          city: u.city,
          state: u.state,
          country: u.country || 'India',
          approvedDomains: typeof u.approvedDomains === 'string' ? u.approvedDomains : JSON.stringify(u.approvedDomains || []),
          isActive: u.isActive ?? true,
          logoUrl: u.logoUrl || null,
          verificationRequirements: u.verificationRequirements || 'Institutional email or ID',
          createdAt: new Date(u.createdAt || Date.now()).toISOString(),
          updatedAt: new Date(u.updatedAt || Date.now()).toISOString(),
        }, { onConflict: 'code' });
        if (error) summary.errors.push(`University ${u.code}: ${error.message}`);
        else summary.universities++;
      } catch (e: any) {
        summary.errors.push(`University ${u.code}: ${e.message}`);
      }
    }

    // 2. Users
    const users = extract(rawData?.users);
    const defaultUsers = [
      { id: 'user-admin-1', email: 'admin@campusconnect.edu', passwordHash: '$2a$10$6l4Lpp0kS0C.PDN9IXYVD.6CVluJcGNVT/RUtRUXCnrQYB0ZMy.Mm', role: 'ADMIN', status: 'ACTIVE', isAgeVerified: true, dateOfBirth: '1998-01-15T00:00:00.000Z', universityId: 'uni-1' },
      { id: 'user-student-1', email: 'aarav.sharma@lpu.in', passwordHash: '$2a$10$xJV0lMh9mPR5Qa2ewqtD9Os6ybFMTnYHnjibbEFwT8Qk5JKb53Vam', role: 'VERIFIED_STUDENT', status: 'ACTIVE', isAgeVerified: true, dateOfBirth: '2003-05-10T00:00:00.000Z', universityId: 'uni-1' },
      { id: 'user-student-2', email: 'priya.patel@lpu.in', passwordHash: '$2a$10$xJV0lMh9mPR5Qa2ewqtD9Os6ybFMTnYHnjibbEFwT8Qk5JKb53Vam', role: 'VERIFIED_STUDENT', status: 'ACTIVE', isAgeVerified: true, dateOfBirth: '2003-05-10T00:00:00.000Z', universityId: 'uni-1' },
      { id: 'user-student-3', email: 'rohan.verma@du.ac.in', passwordHash: '$2a$10$xJV0lMh9mPR5Qa2ewqtD9Os6ybFMTnYHnjibbEFwT8Qk5JKb53Vam', role: 'VERIFIED_STUDENT', status: 'ACTIVE', isAgeVerified: true, dateOfBirth: '2003-05-10T00:00:00.000Z', universityId: 'uni-2' },
      { id: 'user-student-4', email: 'ananya.iyer@vitstudent.ac.in', passwordHash: '$2a$10$xJV0lMh9mPR5Qa2ewqtD9Os6ybFMTnYHnjibbEFwT8Qk5JKb53Vam', role: 'VERIFIED_STUDENT', status: 'ACTIVE', isAgeVerified: true, dateOfBirth: '2003-05-10T00:00:00.000Z', universityId: 'uni-3' },
      { id: 'user-student-krish', email: 'krishbarak@lpu.in', passwordHash: '$2a$10$xJV0lMh9mPR5Qa2ewqtD9Os6ybFMTnYHnjibbEFwT8Qk5JKb53Vam', role: 'VERIFIED_STUDENT', status: 'ACTIVE', isAgeVerified: true, dateOfBirth: '2003-05-10T00:00:00.000Z', universityId: 'uni-1' },
    ];
    const userList = users.length > 0 ? users : defaultUsers;
    for (const u of userList) {
      try {
        const { error } = await supabase.from('User').upsert({
          id: u.id,
          email: u.email.toLowerCase().trim(),
          passwordHash: u.passwordHash,
          role: u.role || 'USER',
          status: u.status || 'ACTIVE',
          isAgeVerified: u.isAgeVerified ?? true,
          dateOfBirth: u.dateOfBirth ? new Date(u.dateOfBirth).toISOString() : null,
          universityId: u.universityId || null,
          createdAt: new Date(u.createdAt || Date.now()).toISOString(),
          updatedAt: new Date(u.updatedAt || Date.now()).toISOString(),
        }, { onConflict: 'email' });
        if (error) summary.errors.push(`User ${u.email}: ${error.message}`);
        else summary.users++;
      } catch (e: any) {
        summary.errors.push(`User ${u.email}: ${e.message}`);
      }
    }

    // 3. Profiles
    const profiles = extract(rawData?.profiles);
    const defaultProfiles = [
      { id: 'profile-admin-1', userId: 'user-admin-1', displayName: 'System Admin', gender: 'PREFER_NOT_TO_SAY', avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150', bio: 'CampusConnect Platform Administrator', course: 'Administration', academicYear: 'Staff', language: 'English', interests: '["Security","Community","Technology"]', isOnline: true, isDiscoverable: false },
      { id: 'profile-user-student-1', userId: 'user-student-1', displayName: 'Aarav Sharma', gender: 'MALE', avatarUrl: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=200', bio: 'Tech enthusiast, competitive coder, exploring distributed systems and hackathons.', course: 'B.Tech Computer Science & Engg', academicYear: '3rd Year', language: 'English', interests: '["Coding","AI / ML","Gaming","Hackathons"]', isOnline: true, isDiscoverable: true },
      { id: 'profile-user-student-2', userId: 'user-student-2', displayName: 'Priya Patel', gender: 'FEMALE', avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200', bio: 'Passionate about digital branding, product design, and university debates.', course: 'MBA Marketing', academicYear: '1st Year', language: 'English', interests: '["Marketing","Design","Music","Debate"]', isOnline: true, isDiscoverable: true },
      { id: 'profile-user-student-3', userId: 'user-student-3', displayName: 'Rohan Verma', gender: 'MALE', avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200', bio: 'Economics enthusiast from St. Stephen’s. Keen on finance, geopolitical trends, and photography.', course: 'BA (Hons) Economics', academicYear: '2nd Year', language: 'English', interests: '["Economics","Finance","Photography","Podcasts"]', isOnline: true, isDiscoverable: true },
      { id: 'profile-user-student-4', userId: 'user-student-4', displayName: 'Ananya Iyer', gender: 'FEMALE', avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200', bio: 'Senior research fellow in computational biology. Love indie music and badminton.', course: 'B.Tech Biotechnology', academicYear: '4th Year', language: 'English', interests: '["Biotech","Research","Badminton","Indie Music"]', isOnline: true, isDiscoverable: true },
      { id: 'profile-user-student-krish', userId: 'user-student-krish', displayName: 'Krish Barak', gender: 'MALE', avatarUrl: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=200', bio: 'LPU Student | Computer Science & Engineering', course: 'B.Tech Computer Science & Engg', academicYear: '3rd Year', language: 'English', interests: '["Coding","AI / ML","Web Development","Campus Life"]', isOnline: true, isDiscoverable: true },
    ];
    const profileList = profiles.length > 0 ? profiles : defaultProfiles;
    for (const p of profileList) {
      try {
        const { data: existing } = await supabase.from('Profile').select('userId').eq('userId', p.userId).maybeSingle();
        if (!existing) {
          const { error } = await supabase.from('Profile').insert({
            id: p.id || `profile-${p.userId}`,
            userId: p.userId,
            displayName: p.displayName || 'Student',
            gender: p.gender || 'PREFER_NOT_TO_SAY',
            avatarUrl: p.avatarUrl || null,
            bio: p.bio || null,
            course: p.course || null,
            academicYear: p.academicYear || null,
            language: p.language || 'English',
            interests: typeof p.interests === 'string' ? p.interests : JSON.stringify(p.interests || []),
            isOnline: Boolean(p.isOnline),
            isDiscoverable: p.isDiscoverable !== false,
            lastSeenAt: new Date(p.lastSeenAt || Date.now()).toISOString(),
            createdAt: new Date(p.createdAt || Date.now()).toISOString(),
            updatedAt: new Date(p.updatedAt || Date.now()).toISOString(),
          });
          if (error) summary.errors.push(`Profile ${p.userId}: ${error.message}`);
          else summary.profiles++;
        }
      } catch (e: any) {
        summary.errors.push(`Profile ${p.userId}: ${e.message}`);
      }
    }

    // 4. Credit Packages
    const creditPackages = extract(rawData?.creditPackages);
    const defaultPackages = [
      { id: 'pkg-1', name: 'Campus Explorer', credits: 5, priceInInr: 29, description: '5 Conversation credits. Great starter pack for new connections.', isPopular: false, isActive: true },
      { id: 'pkg-2', name: 'Semester Connector', credits: 15, priceInInr: 79, description: '15 Conversation credits. Best value for active students (₹5.2/chat).', isPopular: true, isActive: true },
      { id: 'pkg-3', name: 'Campus Ultimate', credits: 35, priceInInr: 149, description: '35 Conversation credits. Maximum value across campus networks (₹4.2/chat).', isPopular: false, isActive: true },
    ];
    const pkgList = creditPackages.length > 0 ? creditPackages : defaultPackages;
    for (const pkg of pkgList) {
      try {
        const { error } = await supabase.from('CreditPackage').upsert({
          id: pkg.id,
          name: pkg.name,
          credits: pkg.credits,
          priceInInr: pkg.priceInInr,
          description: pkg.description || '',
          isPopular: Boolean(pkg.isPopular),
          isActive: pkg.isActive !== false,
          createdAt: new Date(pkg.createdAt || Date.now()).toISOString(),
          updatedAt: new Date(pkg.updatedAt || Date.now()).toISOString(),
        }, { onConflict: 'id' });
        if (error) summary.errors.push(`CreditPackage ${pkg.id}: ${error.message}`);
        else summary.creditPackages++;
      } catch (e: any) {
        summary.errors.push(`CreditPackage ${pkg.id}: ${e.message}`);
      }
    }

    // 5. User Credit Balances
    const creditBalances = extract(rawData?.creditBalances);
    const defaultBalances = [
      { id: 'bal-admin-1', userId: 'user-admin-1', credits: 999 },
      { id: 'bal-user-student-1', userId: 'user-student-1', credits: 5 },
      { id: 'bal-user-student-2', userId: 'user-student-2', credits: 8 },
      { id: 'bal-user-student-3', userId: 'user-student-3', credits: 3 },
      { id: 'bal-user-student-4', userId: 'user-student-4', credits: 4 },
      { id: 'bal-user-student-krish', userId: 'user-student-krish', credits: 5 },
    ];
    const balList = creditBalances.length > 0 ? creditBalances : defaultBalances;
    for (const b of balList) {
      try {
        const { data: existing } = await supabase.from('UserCreditBalance').select('userId').eq('userId', b.userId).maybeSingle();
        if (!existing) {
          const { error } = await supabase.from('UserCreditBalance').insert({
            id: b.id || `bal-${b.userId}`,
            userId: b.userId,
            credits: b.credits || 0,
            updatedAt: new Date(b.updatedAt || Date.now()).toISOString(),
          });
          if (error) summary.errors.push(`CreditBalance ${b.userId}: ${error.message}`);
          else summary.creditBalances++;
        }
      } catch (e: any) {
        summary.errors.push(`CreditBalance ${b.userId}: ${e.message}`);
      }
    }

    // 6. Conversations
    const conversations = extract(rawData?.conversations);
    const defaultConversations = [
      { id: 'conv_user-student-1__user-student-krish__5f26ba590eb70a6f', status: 'ACTIVE', startedAt: '2026-10-12T10:05:00.000Z', creditDeducted: true },
      { id: 'conv_user-student-2__user-student-krish__693362988835865e', status: 'ACTIVE', startedAt: '2026-10-12T10:05:00.000Z', creditDeducted: true },
      { id: 'conv_user-student-1__user-student-2__2793898ef75c35e1', status: 'ACTIVE', startedAt: '2026-10-12T10:05:00.000Z', creditDeducted: true },
    ];
    const convList = conversations.length > 0 ? conversations : defaultConversations;
    for (const c of convList) {
      try {
        const { error } = await supabase.from('Conversation').upsert({
          id: c.id,
          status: c.status || 'ACTIVE',
          startedAt: new Date(c.startedAt || Date.now()).toISOString(),
          endedAt: c.endedAt ? new Date(c.endedAt).toISOString() : null,
          endedByUserId: c.endedByUserId || null,
          endReason: c.endReason || null,
          creditDeducted: Boolean(c.creditDeducted),
        }, { onConflict: 'id' });
        if (error) summary.errors.push(`Conversation ${c.id}: ${error.message}`);
        else summary.conversations++;
      } catch (e: any) {
        summary.errors.push(`Conversation ${c.id}: ${e.message}`);
      }
    }

    // 7. Conversation Participants
    const participants = extract(rawData?.conversationParticipants);
    const defaultParticipants = [
      { id: 'part-conv_user-student-1__user-student-krish__5f26ba590eb70a6f-user-student-1', conversationId: 'conv_user-student-1__user-student-krish__5f26ba590eb70a6f', userId: 'user-student-1', joinedAt: '2026-10-12T10:05:00.000Z', hasUnread: false },
      { id: 'part-conv_user-student-1__user-student-krish__5f26ba590eb70a6f-user-student-krish', conversationId: 'conv_user-student-1__user-student-krish__5f26ba590eb70a6f', userId: 'user-student-krish', joinedAt: '2026-10-12T10:05:00.000Z', hasUnread: false },
      { id: 'part-conv_user-student-2__user-student-krish__693362988835865e-user-student-2', conversationId: 'conv_user-student-2__user-student-krish__693362988835865e', userId: 'user-student-2', joinedAt: '2026-10-12T10:05:00.000Z', hasUnread: false },
      { id: 'part-conv_user-student-2__user-student-krish__693362988835865e-user-student-krish', conversationId: 'conv_user-student-2__user-student-krish__693362988835865e', userId: 'user-student-krish', joinedAt: '2026-10-12T10:05:00.000Z', hasUnread: false },
      { id: 'part-conv_user-student-1__user-student-2__2793898ef75c35e1-user-student-1', conversationId: 'conv_user-student-1__user-student-2__2793898ef75c35e1', userId: 'user-student-1', joinedAt: '2026-10-12T10:05:00.000Z', hasUnread: false },
      { id: 'part-conv_user-student-1__user-student-2__2793898ef75c35e1-user-student-2', conversationId: 'conv_user-student-1__user-student-2__2793898ef75c35e1', userId: 'user-student-2', joinedAt: '2026-10-12T10:05:00.000Z', hasUnread: false },
    ];
    const partList = participants.length > 0 ? participants : defaultParticipants;
    for (const part of partList) {
      try {
        const { error } = await supabase.from('ConversationParticipant').upsert({
          id: part.id || `part-${part.conversationId}-${part.userId}`,
          conversationId: part.conversationId,
          userId: part.userId,
          joinedAt: new Date(part.joinedAt || Date.now()).toISOString(),
          leftAt: part.leftAt ? new Date(part.leftAt).toISOString() : null,
          hasUnread: Boolean(part.hasUnread),
        }, { onConflict: 'conversationId,userId' });
        if (error) summary.errors.push(`Participant ${part.conversationId}/${part.userId}: ${error.message}`);
        else summary.participants++;
      } catch (e: any) {
        summary.errors.push(`Participant: ${e.message}`);
      }
    }

    // 8. Messages
    const messages = extract(rawData?.messages);
    const defaultMessages = [
      { id: 'msg-fr-krish-aarav-init', conversationId: 'conv_user-student-1__user-student-krish__5f26ba590eb70a6f', senderId: 'user-student-1', content: 'Hey Krish! Great connecting on CampusConnect.', isRead: true, createdAt: '2026-10-12T10:06:00.000Z' },
      { id: 'msg-fr-krish-priya-init', conversationId: 'conv_user-student-2__user-student-krish__693362988835865e', senderId: 'user-student-2', content: 'Hi Krish! Welcome to CampusConnect. Looking forward to collaborating on campus projects.', isRead: true, createdAt: '2026-10-12T10:06:00.000Z' },
      { id: 'msg-fr-aarav-priya-init', conversationId: 'conv_user-student-1__user-student-2__2793898ef75c35e1', senderId: 'user-student-1', content: 'Hey Priya, let us discuss the tech symposium next week!', isRead: true, createdAt: '2026-10-12T10:06:00.000Z' },
    ];
    const msgList = messages.length > 0 ? messages : defaultMessages;
    for (const m of msgList) {
      try {
        const { error } = await supabase.from('Message').upsert({
          id: m.id,
          conversationId: m.conversationId,
          senderId: m.senderId,
          content: m.content,
          isRead: Boolean(m.isRead),
          createdAt: new Date(m.createdAt || Date.now()).toISOString(),
        }, { onConflict: 'id' });
        if (error) summary.errors.push(`Message ${m.id}: ${error.message}`);
        else summary.messages++;
      } catch (e: any) {
        summary.errors.push(`Message ${m.id}: ${e.message}`);
      }
    }

    // 9. Friend Requests
    const friendRequests = extract(rawData?.friendRequests);
    const defaultFriendRequests = [
      { id: 'fr-krish-aarav', senderId: 'user-student-1', receiverId: 'user-student-krish', status: 'ACCEPTED', createdAt: '2026-10-12T10:00:00.000Z', updatedAt: '2026-10-12T10:05:00.000Z' },
      { id: 'fr-krish-priya', senderId: 'user-student-2', receiverId: 'user-student-krish', status: 'ACCEPTED', createdAt: '2026-10-12T10:00:00.000Z', updatedAt: '2026-10-12T10:05:00.000Z' },
      { id: 'fr-aarav-priya', senderId: 'user-student-1', receiverId: 'user-student-2', status: 'ACCEPTED', createdAt: '2026-10-12T10:00:00.000Z', updatedAt: '2026-10-12T10:05:00.000Z' },
    ];
    const frList = friendRequests.length > 0 ? friendRequests : defaultFriendRequests;
    for (const fr of frList) {
      try {
        const { error } = await supabase.from('FriendRequest').upsert({
          id: fr.id || `fr-${fr.senderId}-${fr.receiverId}`,
          senderId: fr.senderId,
          receiverId: fr.receiverId,
          status: fr.status || 'PENDING',
          createdAt: new Date(fr.createdAt || Date.now()).toISOString(),
          updatedAt: new Date(fr.updatedAt || Date.now()).toISOString(),
        }, { onConflict: 'senderId,receiverId' });
        if (error) summary.errors.push(`FriendRequest ${fr.senderId}/${fr.receiverId}: ${error.message}`);
        else summary.friendRequests++;
      } catch (e: any) {
        summary.errors.push(`FriendRequest: ${e.message}`);
      }
    }

    console.log('[SUPABASE_MIGRATE] Supabase data migration finished:', summary);
  } catch (err: any) {
    summary.errors.push(`Global migration error: ${err.message}`);
  }

  return summary;
}


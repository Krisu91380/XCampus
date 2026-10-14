import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';

export async function migrateJsonToPostgres(prisma: PrismaClient) {
  try {
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
        await prisma.profile.upsert({
          where: { userId },
          create: {
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
          update: {
            displayName: p.displayName,
            avatarUrl: p.avatarUrl || undefined,
            course: p.course || undefined,
            academicYear: p.academicYear || undefined,
            bio: p.bio || undefined,
          },
        });
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
        await prisma.userCreditBalance.upsert({
          where: { userId },
          create: {
            id: b.id || `bal-${userId}`,
            userId,
            credits: b.credits || 0,
            updatedAt: new Date(b.updatedAt || Date.now()),
          },
          update: {
            credits: b.credits || 0,
          },
        });
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

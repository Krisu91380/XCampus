import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { APP_CONFIG } from './config';
import { getSupabaseClient } from './supabase';
import {
  User,
  Profile,
  University,
  StudentVerification,
  MatchingPreference,
  MatchQueueEntry,
  Conversation,
  ConversationParticipant,
  Message,
  CreditPackage,
  UserCreditBalance,
  CreditLedgerEntry,
  PaymentOrder,
  PaymentTransaction,
  Block,
  AbuseReport,
  AdminAuditLog,
  FriendRequest,
  FriendRequestStatus,
} from '@/types';

declare global {
  // eslint-disable-next-line no-var
  var __campusConnectDb: InMemoryStore | undefined;
  // eslint-disable-next-line no-var
  var __campusConnectPrisma: PrismaClient | undefined;
  // eslint-disable-next-line no-var
  var __campusConnectPgMigrated: boolean | undefined;
}

class InMemoryStore {
  users: Map<string, User> = new Map();
  profiles: Map<string, Profile> = new Map();
  universities: Map<string, University> = new Map();
  verifications: Map<string, StudentVerification> = new Map();
  preferences: Map<string, MatchingPreference> = new Map();
  matchQueue: Map<string, MatchQueueEntry> = new Map();
  conversations: Map<string, Conversation> = new Map();
  conversationParticipants: Map<string, ConversationParticipant> = new Map();
  messages: Map<string, Message> = new Map();
  creditPackages: Map<string, CreditPackage> = new Map();
  creditBalances: Map<string, UserCreditBalance> = new Map();
  creditLedgers: Map<string, CreditLedgerEntry> = new Map();
  paymentOrders: Map<string, PaymentOrder> = new Map();
  paymentTransactions: Map<string, PaymentTransaction> = new Map();
  blocks: Map<string, Block> = new Map();
  abuseReports: Map<string, AbuseReport> = new Map();
  auditLogs: Map<string, AdminAuditLog> = new Map();
  friendRequests: Map<string, FriendRequest> = new Map();
  signals: Map<string, any[]> = new Map();

  initialized = false;
  isSyncing = false;
  saveTimeout: NodeJS.Timeout | null = null;

  constructor() {
    this.loadFromDisk();
    this.seed();
  }

  getStoreFilePath() {
    if (process.env.VERCEL) {
      return '/tmp/data_store.json';
    }
    return path.join(process.cwd(), 'prisma', 'data_store.json');
  }

  saveToDisk() {
    try {
      if (process.env.NEXT_PHASE === 'phase-production-build') return;
      const dbFile = this.getStoreFilePath();
      const dir = path.dirname(dbFile);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const serialized = {
        users: Array.from(this.users.entries()),
        profiles: Array.from(this.profiles.entries()),
        universities: Array.from(this.universities.entries()),
        verifications: Array.from(this.verifications.entries()),
        preferences: Array.from(this.preferences.entries()),
        matchQueue: Array.from(this.matchQueue.entries()),
        conversations: Array.from(this.conversations.entries()),
        conversationParticipants: Array.from(this.conversationParticipants.entries()),
        messages: Array.from(this.messages.entries()),
        creditPackages: Array.from(this.creditPackages.entries()),
        creditBalances: Array.from(this.creditBalances.entries()),
        creditLedgers: Array.from(this.creditLedgers.entries()),
        paymentOrders: Array.from(this.paymentOrders.entries()),
        paymentTransactions: Array.from(this.paymentTransactions.entries()),
        blocks: Array.from(this.blocks.entries()),
        abuseReports: Array.from(this.abuseReports.entries()),
        auditLogs: Array.from(this.auditLogs.entries()),
        friendRequests: Array.from(this.friendRequests.entries()),
        signals: Array.from(this.signals.entries()),
      };
      const tmpFile = `${dbFile}.${process.pid}.${Date.now()}.tmp`;
      fs.writeFileSync(tmpFile, JSON.stringify(serialized, null, 2), 'utf-8');
      try {
        fs.renameSync(tmpFile, dbFile);
      } catch {
        fs.copyFileSync(tmpFile, dbFile);
        try { fs.unlinkSync(tmpFile); } catch {}
      }
      this.lastDiskLoadTime = Date.now();
    } catch {
      // Ignore write error on read-only environments
    }
  }

  scheduleSave() {
    if (this.isSyncing) return;
    if (this.saveTimeout) clearTimeout(this.saveTimeout);
    this.saveToDisk();
  }

  hookMapPersistence(map: Map<any, any>) {
    const origSet = map.set.bind(map);
    const origDelete = map.delete.bind(map);
    const origClear = map.clear.bind(map);
    map.set = (...args: any[]) => {
      const res = (origSet as any)(...args);
      this.scheduleSave();
      return res;
    };
    map.delete = (...args: any[]) => {
      const res = (origDelete as any)(...args);
      this.scheduleSave();
      return res;
    };
    map.clear = () => {
      origClear();
      this.scheduleSave();
    };
  }

  attachAllHooks() {
    this.hookMapPersistence(this.users);
    this.hookMapPersistence(this.profiles);
    this.hookMapPersistence(this.universities);
    this.hookMapPersistence(this.verifications);
    this.hookMapPersistence(this.preferences);
    this.hookMapPersistence(this.matchQueue);
    this.hookMapPersistence(this.conversations);
    this.hookMapPersistence(this.conversationParticipants);
    this.hookMapPersistence(this.messages);
    this.hookMapPersistence(this.creditPackages);
    this.hookMapPersistence(this.creditBalances);
    this.hookMapPersistence(this.creditLedgers);
    this.hookMapPersistence(this.paymentOrders);
    this.hookMapPersistence(this.paymentTransactions);
    this.hookMapPersistence(this.blocks);
    this.hookMapPersistence(this.abuseReports);
    this.hookMapPersistence(this.auditLogs);
    this.hookMapPersistence(this.friendRequests);
    this.hookMapPersistence(this.signals);
  }

  lastDiskLoadTime: number = 0;

  loadFromDisk() {
    try {
      const bundledFile = path.join(process.cwd(), 'prisma', 'data_store.json');
      const storeFile = this.getStoreFilePath();

      const loadDataFromFile = (filePath: string) => {
        if (!fs.existsSync(filePath)) return null;
        try {
          const raw = fs.readFileSync(filePath, 'utf-8');
          if (raw && raw.trim().startsWith('{')) {
            return JSON.parse(raw);
          }
        } catch (e) {
          console.error(`Error reading ${filePath}:`, e);
        }
        return null;
      };

      // 1. Always load bundled prisma/data_store.json as permanent baseline
      const bundledData = loadDataFromFile(bundledFile);
      if (bundledData) {
        if (bundledData.users) this.users = new Map(bundledData.users);
        if (bundledData.profiles) this.profiles = new Map(bundledData.profiles);
        if (bundledData.universities) this.universities = new Map(bundledData.universities);
        if (bundledData.verifications) this.verifications = new Map(bundledData.verifications);
        if (bundledData.preferences) this.preferences = new Map(bundledData.preferences);
        if (bundledData.matchQueue) this.matchQueue = new Map(bundledData.matchQueue);
        if (bundledData.conversations) this.conversations = new Map(bundledData.conversations);
        if (bundledData.conversationParticipants) this.conversationParticipants = new Map(bundledData.conversationParticipants);
        if (bundledData.messages) this.messages = new Map(bundledData.messages);
        if (bundledData.creditPackages) this.creditPackages = new Map(bundledData.creditPackages);
        if (bundledData.creditBalances) this.creditBalances = new Map(bundledData.creditBalances);
        if (bundledData.creditLedgers) this.creditLedgers = new Map(bundledData.creditLedgers);
        if (bundledData.paymentOrders) this.paymentOrders = new Map(bundledData.paymentOrders);
        if (bundledData.paymentTransactions) this.paymentTransactions = new Map(bundledData.paymentTransactions);
        if (bundledData.blocks) this.blocks = new Map(bundledData.blocks);
        if (bundledData.abuseReports) this.abuseReports = new Map(bundledData.abuseReports);
        if (bundledData.auditLogs) this.auditLogs = new Map(bundledData.auditLogs);
        if (bundledData.friendRequests) this.friendRequests = new Map(bundledData.friendRequests);
        if (bundledData.signals) this.signals = new Map(bundledData.signals);
      }

      // 2. If runtime storeFile exists and is distinct from bundledFile, merge runtime modifications on top
      if (storeFile !== bundledFile && fs.existsSync(storeFile)) {
        const runtimeData = loadDataFromFile(storeFile);
        if (runtimeData) {
          const mergeMap = (target: Map<any, any>, entries: [any, any][] | undefined) => {
            if (entries && Array.isArray(entries)) {
              for (const [k, v] of entries) {
                target.set(k, v);
              }
            }
          };
          mergeMap(this.users, runtimeData.users);
          mergeMap(this.profiles, runtimeData.profiles);
          mergeMap(this.universities, runtimeData.universities);
          mergeMap(this.verifications, runtimeData.verifications);
          mergeMap(this.preferences, runtimeData.preferences);
          mergeMap(this.matchQueue, runtimeData.matchQueue);
          mergeMap(this.conversations, runtimeData.conversations);
          mergeMap(this.conversationParticipants, runtimeData.conversationParticipants);
          mergeMap(this.messages, runtimeData.messages);
          mergeMap(this.creditPackages, runtimeData.creditPackages);
          mergeMap(this.creditBalances, runtimeData.creditBalances);
          mergeMap(this.creditLedgers, runtimeData.creditLedgers);
          mergeMap(this.paymentOrders, runtimeData.paymentOrders);
          mergeMap(this.paymentTransactions, runtimeData.paymentTransactions);
          mergeMap(this.blocks, runtimeData.blocks);
          mergeMap(this.abuseReports, runtimeData.abuseReports);
          mergeMap(this.auditLogs, runtimeData.auditLogs);
          mergeMap(this.friendRequests, runtimeData.friendRequests);
          mergeMap(this.signals, runtimeData.signals);
        }
      }

      this.lastDiskLoadTime = Date.now();
    } catch (err) {
      console.error('Error loading data_store from disk:', err);
    }
    this.attachAllHooks();
  }

  syncFromDiskIfNeeded() {
    try {
      const storeFile = this.getStoreFilePath();
      if (fs.existsSync(storeFile)) {
        const stat = fs.statSync(storeFile);
        if (stat.mtimeMs > this.lastDiskLoadTime) {
          const raw = fs.readFileSync(storeFile, 'utf-8');
          if (raw && raw.trim().startsWith('{')) {
            const runtimeData = JSON.parse(raw);
            this.isSyncing = true;
            try {
              const mergeMap = (target: Map<any, any>, entries: [any, any][] | undefined) => {
                if (entries && Array.isArray(entries)) {
                  for (const [k, v] of entries) {
                    target.set(k, v);
                  }
                }
              };
              mergeMap(this.users, runtimeData.users);
              mergeMap(this.profiles, runtimeData.profiles);
              mergeMap(this.universities, runtimeData.universities);
              mergeMap(this.verifications, runtimeData.verifications);
              mergeMap(this.preferences, runtimeData.preferences);
              mergeMap(this.matchQueue, runtimeData.matchQueue);
              mergeMap(this.conversations, runtimeData.conversations);
              mergeMap(this.conversationParticipants, runtimeData.conversationParticipants);
              mergeMap(this.messages, runtimeData.messages);
              mergeMap(this.creditPackages, runtimeData.creditPackages);
              mergeMap(this.creditBalances, runtimeData.creditBalances);
              mergeMap(this.creditLedgers, runtimeData.creditLedgers);
              mergeMap(this.paymentOrders, runtimeData.paymentOrders);
              mergeMap(this.paymentTransactions, runtimeData.paymentTransactions);
              mergeMap(this.blocks, runtimeData.blocks);
              mergeMap(this.abuseReports, runtimeData.abuseReports);
              mergeMap(this.auditLogs, runtimeData.auditLogs);
              mergeMap(this.friendRequests, runtimeData.friendRequests);
              mergeMap(this.signals, runtimeData.signals);
            } finally {
              this.isSyncing = false;
            }
            this.lastDiskLoadTime = Date.now();
          }
        }
      }
    } catch {
      // Ignore transient errors
    }
  }

  seed() {
    if (this.initialized) return;

    // 1. Seed Universities
    const uniIds: Record<string, string> = {};
    APP_CONFIG.initialUniversities.forEach((u, idx) => {
      const id = `uni-${idx + 1}`;
      uniIds[u.code] = id;
      this.universities.set(id, {
        id,
        name: u.name,
        code: u.code,
        city: u.city,
        state: u.state,
        country: u.country,
        approvedDomains: u.approvedDomains,
        isActive: true,
        verificationRequirements: u.verificationRequirements,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    // 2. Seed Credit Packages
    APP_CONFIG.initialCreditPackages.forEach((pkg, idx) => {
      const id = `pkg-${idx + 1}`;
      this.creditPackages.set(id, {
        id,
        name: pkg.name,
        credits: pkg.credits,
        priceInInr: pkg.priceInInr,
        description: pkg.description,
        isPopular: pkg.isPopular,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    // 3. Seed Admin User (respects environment variables)
    const adminEmail = (process.env.ADMIN_INITIAL_EMAIL || 'admin@campusconnect.edu').toLowerCase().trim();
    const adminPassword = process.env.ADMIN_INITIAL_PASSWORD || 'AdminSecurePassword123!';
    const adminPasswordHash = bcrypt.hashSync(adminPassword, 10);
    const adminId = 'user-admin-1';
    if (!this.users.has(adminId)) {
      this.users.set(adminId, {
        id: adminId,
        email: adminEmail,
        passwordHash: adminPasswordHash,
        role: 'ADMIN',
        status: 'ACTIVE',
        isAgeVerified: true,
        dateOfBirth: new Date('1998-01-15'),
        universityId: uniIds['LPU'],
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
    if (!this.profiles.has(adminId)) {
      this.profiles.set(adminId, {
        id: 'profile-admin-1',
        userId: adminId,
        displayName: 'System Admin',
        gender: 'PREFER_NOT_TO_SAY',
        avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
        bio: 'CampusConnect Platform Administrator',
        course: 'Administration',
        branch: 'IT & Security',
        academicYear: 'Staff',
        semester: 'N/A',
        language: 'English',
        interests: ['Security', 'Community', 'Technology'],
        skills: ['Server Administration', 'Moderation', 'WebRTC'],
        isOnline: true,
        isDiscoverable: false,
        lastSeenAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
    if (!this.creditBalances.has(adminId)) {
      this.creditBalances.set(adminId, {
        id: 'bal-admin-1',
        userId: adminId,
        credits: 999,
        updatedAt: new Date(),
      });
    }

    // 4. Seed Real Demo LPU & Other Students
    const studentPasswordHash = bcrypt.hashSync('StudentPass123!', 10);

    const demoStudents = [
      {
        id: 'user-student-1',
        email: 'aarav.sharma@lpu.in',
        name: 'Aarav Sharma',
        gender: 'MALE' as const,
        uniCode: 'LPU',
        course: 'B.Tech Computer Science & Engg',
        branch: 'AI & Data Engineering',
        year: '3rd Year',
        semester: '5th Semester',
        bio: 'Tech enthusiast, competitive coder, exploring distributed systems and hackathons.',
        interests: ['Coding', 'AI / ML', 'Gaming', 'Hackathons'],
        skills: ['Python', 'TypeScript', 'Docker', 'Machine Learning'],
        credits: 5,
        isVerified: true,
        avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=200',
      },
      {
        id: 'user-student-2',
        email: 'priya.patel@lpu.in',
        name: 'Priya Patel',
        gender: 'FEMALE' as const,
        uniCode: 'LPU',
        course: 'MBA Marketing',
        branch: 'Digital Brand Strategy',
        year: '1st Year',
        semester: '2nd Semester',
        bio: 'Passionate about digital branding, product design, and university debates.',
        interests: ['Marketing', 'Design', 'Music', 'Debate'],
        skills: ['Public Speaking', 'UI/UX Design', 'Social Media', 'Debating'],
        credits: 8,
        isVerified: true,
        avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200',
      },
      {
        id: 'user-student-3',
        email: 'rohan.verma@du.ac.in',
        name: 'Rohan Verma',
        gender: 'MALE' as const,
        uniCode: 'DU',
        course: 'BA (Hons) Economics',
        branch: 'Macroeconomics & Finance',
        year: '2nd Year',
        semester: '4th Semester',
        bio: 'Economics enthusiast from St. Stephen’s. Keen on finance, geopolitical trends, and photography.',
        interests: ['Economics', 'Finance', 'Photography', 'Podcasts'],
        skills: ['Financial Modeling', 'Data Analysis', 'Photography'],
        credits: 3,
        isVerified: true,
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200',
      },
      {
        id: 'user-student-4',
        email: 'ananya.iyer@vitstudent.ac.in',
        name: 'Ananya Iyer',
        gender: 'FEMALE' as const,
        uniCode: 'VIT',
        course: 'B.Tech Biotechnology',
        branch: 'Computational Biology',
        year: '4th Year',
        semester: '7th Semester',
        bio: 'Senior research fellow in computational biology. Love indie music and badminton.',
        interests: ['Biotech', 'Research', 'Badminton', 'Indie Music'],
        skills: ['Bioinformatics', 'Genomics', 'Data Science'],
        credits: 4,
        isVerified: true,
        avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200',
      },
      {
        id: 'user-student-krish',
        email: 'krishbarak@lpu.in',
        name: 'Krish Barak',
        gender: 'MALE' as const,
        uniCode: 'LPU',
        course: 'B.Tech Computer Science & Engg',
        branch: 'Full Stack & Cloud Computing',
        year: '3rd Year',
        semester: '6th Semester',
        bio: 'LPU Student | Computer Science & Engineering',
        interests: ['Coding', 'AI / ML', 'Web Development', 'Campus Life'],
        skills: ['Next.js', 'React', 'Node.js', 'PostgreSQL', 'WebRTC'],
        credits: 5,
        isVerified: true,
        avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=200',
      },
    ];

    demoStudents.forEach((st) => {
      if (!this.users.has(st.id)) {
        this.users.set(st.id, {
          id: st.id,
          email: st.email,
          passwordHash: studentPasswordHash,
          role: st.isVerified ? 'VERIFIED_STUDENT' : 'USER',
          status: 'ACTIVE',
          isAgeVerified: true,
          dateOfBirth: new Date('2003-05-10'),
          universityId: uniIds[st.uniCode],
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      if (!this.profiles.has(st.id)) {
        this.profiles.set(st.id, {
          id: `profile-${st.id}`,
          userId: st.id,
          displayName: st.name,
          gender: st.gender,
          avatarUrl: st.avatar,
          bio: st.bio,
          course: st.course,
          branch: st.branch,
          academicYear: st.year,
          semester: st.semester,
          language: 'English',
          interests: st.interests,
          skills: st.skills,
          isOnline: true,
          isDiscoverable: true,
          lastSeenAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      if (!this.creditBalances.has(st.id)) {
        this.creditBalances.set(st.id, {
          id: `bal-${st.id}`,
          userId: st.id,
          credits: st.credits,
          updatedAt: new Date(),
        });
      }

      this.creditLedgers.set(`ledger-${st.id}-init`, {
        id: `ledger-${st.id}-init`,
        userId: st.id,
        change: st.credits,
        balanceAfter: st.credits,
        reason: 'SIGNUP_BONUS',
        referenceId: 'welcome-package',
        metadata: JSON.stringify({ note: 'Complimentary onboarding credits' }),
        createdAt: new Date(),
      });

      if (st.isVerified) {
        this.verifications.set(`ver-${st.id}`, {
          id: `ver-${st.id}`,
          userId: st.id,
          universityId: uniIds[st.uniCode],
          institutionalEmail: st.email,
          documentType: 'INSTITUTION_EMAIL',
          status: 'APPROVED',
          reviewedBy: adminId,
          reviewedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    });

    // 5. Seed Mutual Permanent Friendships & Initial Conversations for Krish Barak & Demo Students
    const seedFriendships = [
      {
        id: 'fr-krish-aarav',
        senderId: 'user-student-1',
        receiverId: 'user-student-krish',
        status: 'ACCEPTED' as const,
        convId: 'conv_user-student-1__user-student-krish__5f26ba590eb70a6f',
        firstMsg: 'Hey Krish! Great connecting on CampusConnect.',
      },
      {
        id: 'fr-krish-priya',
        senderId: 'user-student-2',
        receiverId: 'user-student-krish',
        status: 'ACCEPTED' as const,
        convId: 'conv_user-student-2__user-student-krish__693362988835865e',
        firstMsg: 'Hi Krish! Welcome to CampusConnect. Looking forward to collaborating on campus projects.',
      },
      {
        id: 'fr-aarav-priya',
        senderId: 'user-student-1',
        receiverId: 'user-student-2',
        status: 'ACCEPTED' as const,
        convId: 'conv_user-student-1__user-student-2__2793898ef75c35e1',
        firstMsg: 'Hey Priya, let us discuss the tech symposium next week!',
      },
    ];

    seedFriendships.forEach((f) => {
      if (!this.friendRequests.has(f.id)) {
        this.friendRequests.set(f.id, {
          id: f.id,
          senderId: f.senderId,
          receiverId: f.receiverId,
          status: f.status,
          createdAt: new Date('2026-10-12T10:00:00Z'),
          updatedAt: new Date('2026-10-12T10:05:00Z'),
        });
      }

      if (!this.conversations.has(f.convId)) {
        this.conversations.set(f.convId, {
          id: f.convId,
          status: 'ACTIVE',
          creditDeducted: true,
          startedAt: new Date('2026-10-12T10:05:00Z'),
          endedAt: null,
        });
      }

      const p1Key = `${f.convId}:${f.senderId}`;
      if (!this.conversationParticipants.has(p1Key)) {
        this.conversationParticipants.set(p1Key, {
          id: `part-${f.convId}-${f.senderId}`,
          conversationId: f.convId,
          userId: f.senderId,
          hasUnread: false,
          joinedAt: new Date('2026-10-12T10:05:00Z'),
          clearedAt: null,
          hidden: false,
        });
      }

      const p2Key = `${f.convId}:${f.receiverId}`;
      if (!this.conversationParticipants.has(p2Key)) {
        this.conversationParticipants.set(p2Key, {
          id: `part-${f.convId}-${f.receiverId}`,
          conversationId: f.convId,
          userId: f.receiverId,
          hasUnread: false,
          joinedAt: new Date('2026-10-12T10:05:00Z'),
          clearedAt: null,
          hidden: false,
        });
      }

      const msgId = `msg-${f.id}-init`;
      if (!this.messages.has(msgId)) {
        this.messages.set(msgId, {
          id: msgId,
          conversationId: f.convId,
          senderId: f.senderId,
          content: f.firstMsg,
          isRead: true,
          createdAt: new Date('2026-10-12T10:06:00Z'),
        });
      }
    });

    this.initialized = true;
  }
}

const store: InMemoryStore = (globalThis as any).__campusConnectDb || new InMemoryStore();
(globalThis as any).__campusConnectDb = store;

const isPostgresUrl = Boolean(
  (process.env.DATABASE_URL &&
    (process.env.DATABASE_URL.startsWith('postgres://') ||
      process.env.DATABASE_URL.startsWith('postgresql://'))) ||
  (process.env.DIRECT_URL &&
    (process.env.DIRECT_URL.startsWith('postgres://') ||
      process.env.DIRECT_URL.startsWith('postgresql://')))
);

let prismaInstance: PrismaClient | null = null;
if (isPostgresUrl) {
  try {
    const connectionUrl = process.env.DATABASE_URL || process.env.DIRECT_URL;
    prismaInstance =
      (globalThis as any).__campusConnectPrisma ||
      new PrismaClient({
        datasources: {
          db: {
            url: connectionUrl,
          },
        },
      });
    (globalThis as any).__campusConnectPrisma = prismaInstance;

    // Trigger one-time async background migration from data_store.json to PostgreSQL
    if (!(globalThis as any).__campusConnectPgMigrated) {
      (globalThis as any).__campusConnectPgMigrated = true;
      import('./migrate-to-postgres')
        .then(({ migrateJsonToPostgres }) => {
          if (prismaInstance) migrateJsonToPostgres(prismaInstance);
        })
        .catch((e) => console.warn('Postgres migration notice:', e.message));
    }
  } catch (err) {
    console.warn('Prisma PostgreSQL initialization warning:', err);
    prismaInstance = null;
  }
}

export const prisma = prismaInstance;

export const db = {
  store,
  prisma: prismaInstance,

  user: {
    findUnique: async ({ where }: { where: { id?: string; email?: string } }): Promise<User | null> => {
      if (prismaInstance) {
        try {
          if (where.id) {
            const row = await prismaInstance.user.findUnique({ where: { id: where.id } });
            if (row && !row.deletedAt) return row as unknown as User;
          } else if (where.email) {
            const target = where.email.toLowerCase().trim();
            const row = await prismaInstance.user.findUnique({ where: { email: target } });
            if (row && !row.deletedAt) return row as unknown as User;
          }
        } catch (err: any) {
          console.error('[DATABASE] PostgreSQL user.findUnique error:', err.message);
        }
      }
      const sb = getSupabaseClient();
      if (sb) {
        try {
          let q = sb.from('User').select('*');
          if (where.id) q = q.eq('id', where.id);
          else if (where.email) q = q.eq('email', where.email.toLowerCase().trim());
          const { data: row, error } = await q.maybeSingle();
          if (!error && row && !row.deletedAt) {
            store.users.set(row.id, row as unknown as User);
            return row as unknown as User;
          }
        } catch {}
      }
      store.syncFromDiskIfNeeded();
      if (where.id) return store.users.get(where.id) || null;
      if (where.email) {
        const targetEmail = where.email.toLowerCase().trim();
        return (Array.from(store.users.values()) as User[]).find(
          (u) => u.email.toLowerCase().trim() === targetEmail && !u.deletedAt
        ) || null;
      }
      return null;
    },
    findMany: async (args?: { where?: Partial<User> }): Promise<User[]> => {
      if (prismaInstance) {
        try {
          const rows = await prismaInstance.user.findMany({
            where: {
              deletedAt: null,
              ...(args?.where?.role ? { role: args.where.role } : {}),
              ...(args?.where?.status ? { status: args.where.status } : {}),
              ...(args?.where?.universityId ? { universityId: args.where.universityId } : {}),
            },
          });
          if (rows.length > 0) return rows as unknown as User[];
        } catch (err: any) {
          console.error('[DATABASE] PostgreSQL user.findMany error:', err.message);
        }
      }
      const sb = getSupabaseClient();
      if (sb) {
        try {
          let q = sb.from('User').select('*').is('deletedAt', null);
          if (args?.where?.role) q = q.eq('role', args.where.role);
          if (args?.where?.status) q = q.eq('status', args.where.status);
          if (args?.where?.universityId) q = q.eq('universityId', args.where.universityId);
          const { data: rows, error } = await q;
          if (!error && rows && rows.length > 0) {
            for (const r of rows) store.users.set(r.id, r as unknown as User);
            return rows as unknown as User[];
          }
        } catch {}
      }
      store.syncFromDiskIfNeeded();
      const all = Array.from(store.users.values()).filter((u) => !u.deletedAt);
      if (!args?.where) return all;
      return all.filter((u) => {
        for (const [key, val] of Object.entries(args.where!)) {
          if ((u as any)[key] !== val) return false;
        }
        return true;
      });
    },
    create: async ({ data }: { data: Omit<User, 'id' | 'createdAt' | 'updatedAt'> & { id?: string } }): Promise<User> => {
      const id = data.id || `user-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const normalizedEmail = data.email.toLowerCase().trim();
      const now = new Date();

      if (prismaInstance) {
        try {
          const row = await prismaInstance.user.create({
            data: {
              id,
              email: normalizedEmail,
              passwordHash: data.passwordHash,
              role: data.role || 'USER',
              status: data.status || 'ACTIVE',
              isAgeVerified: data.isAgeVerified ?? true,
              dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
              universityId: data.universityId || null,
              createdAt: now,
              updatedAt: now,
            },
          });
          store.users.set(id, row as unknown as User);
          return row as unknown as User;
        } catch (err: any) {
          console.error('[DATABASE] PostgreSQL user.create error:', err.message);
        }
      }

      const sb = getSupabaseClient();
      if (sb) {
        try {
          const { data: row, error } = await sb
            .from('User')
            .upsert({
              id,
              email: normalizedEmail,
              passwordHash: data.passwordHash,
              role: data.role || 'USER',
              status: data.status || 'ACTIVE',
              isAgeVerified: data.isAgeVerified ?? true,
              dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth).toISOString() : null,
              universityId: data.universityId || null,
              createdAt: now.toISOString(),
              updatedAt: now.toISOString(),
            }, { onConflict: 'email' })
            .select()
            .single();
          if (!error && row) {
            store.users.set(id, row as unknown as User);
            return row as unknown as User;
          }
        } catch {}
      }

      store.syncFromDiskIfNeeded();
      const user: User = {
        id,
        ...data,
        email: normalizedEmail,
        createdAt: now,
        updatedAt: now,
      };
      store.users.set(id, user);
      store.saveToDisk();
      return user;
    },
    update: async ({ where, data }: { where: { id: string }; data: Partial<User> }): Promise<User> => {
      const now = new Date();
      if (prismaInstance) {
        try {
          const row = await prismaInstance.user.update({
            where: { id: where.id },
            data: {
              ...(data.role ? { role: data.role } : {}),
              ...(data.status ? { status: data.status } : {}),
              ...(data.universityId !== undefined ? { universityId: data.universityId } : {}),
              ...(data.passwordHash ? { passwordHash: data.passwordHash } : {}),
              updatedAt: now,
            },
          });
          store.users.set(where.id, row as unknown as User);
          return row as unknown as User;
        } catch (err: any) {
          console.error('[DATABASE] PostgreSQL user.update error:', err.message);
        }
      }

      const sb = getSupabaseClient();
      if (sb) {
        try {
          await sb.from('User').update({
            ...(data.role ? { role: data.role } : {}),
            ...(data.status ? { status: data.status } : {}),
            ...(data.universityId !== undefined ? { universityId: data.universityId } : {}),
            ...(data.passwordHash ? { passwordHash: data.passwordHash } : {}),
            updatedAt: now.toISOString(),
          }).eq('id', where.id);
        } catch {}
      }

      store.syncFromDiskIfNeeded();
      const existing = store.users.get(where.id);
      if (!existing) throw new Error(`User ${where.id} not found`);
      const updated = { ...existing, ...data, updatedAt: now };
      store.users.set(where.id, updated);
      store.saveToDisk();
      return updated;
    },
    count: async () => {
      if (prismaInstance) {
        try {
          return await prismaInstance.user.count({ where: { deletedAt: null } });
        } catch {}
      }
      const sb = getSupabaseClient();
      if (sb) {
        try {
          const { count, error } = await sb.from('User').select('*', { count: 'exact', head: true });
          if (!error && count !== null) return count;
        } catch {}
      }
      store.syncFromDiskIfNeeded();
      return store.users.size;
    },
  },

  profile: {
    findUnique: async ({ where }: { where: { userId: string } }): Promise<Profile | null> => {
      if (prismaInstance) {
        try {
          const row = await prismaInstance.profile.findUnique({ where: { userId: where.userId } });
          if (row) {
            let interests = row.interests;
            try {
              if (typeof interests === 'string') interests = JSON.parse(interests);
            } catch {}
            return { ...row, interests: Array.isArray(interests) ? interests : [] } as unknown as Profile;
          }
        } catch (err: any) {
          console.error('[DATABASE] PostgreSQL profile.findUnique error:', err.message);
        }
      }
      const sb = getSupabaseClient();
      if (sb) {
        try {
          const { data: row, error } = await sb.from('Profile').select('*').eq('userId', where.userId).maybeSingle();
          if (!error && row) {
            let interests = row.interests;
            try {
              if (typeof interests === 'string') interests = JSON.parse(interests);
            } catch {}
            const prof = { ...row, interests: Array.isArray(interests) ? interests : [] } as unknown as Profile;
            store.profiles.set(where.userId, prof);
            return prof;
          }
        } catch {}
      }
      store.syncFromDiskIfNeeded();
      return store.profiles.get(where.userId) || null;
    },
    findMany: async (args?: { where?: { isDiscoverable?: boolean; isOnline?: boolean } }): Promise<Profile[]> => {
      if (prismaInstance) {
        try {
          const rows = await prismaInstance.profile.findMany({
            where: {
              ...(args?.where?.isDiscoverable !== undefined ? { isDiscoverable: args.where.isDiscoverable } : {}),
              ...(args?.where?.isOnline !== undefined ? { isOnline: args.where.isOnline } : {}),
            },
          });
          if (rows.length > 0) {
            return rows.map((r) => {
              let interests = r.interests;
              try {
                if (typeof interests === 'string') interests = JSON.parse(interests);
              } catch {}
              return { ...r, interests: Array.isArray(interests) ? interests : [] };
            }) as unknown as Profile[];
          }
        } catch (err: any) {
          console.error('[DATABASE] PostgreSQL profile.findMany error:', err.message);
        }
      }
      const sb = getSupabaseClient();
      if (sb) {
        try {
          let q = sb.from('Profile').select('*');
          if (args?.where?.isDiscoverable !== undefined) q = q.eq('isDiscoverable', args.where.isDiscoverable);
          if (args?.where?.isOnline !== undefined) q = q.eq('isOnline', args.where.isOnline);
          const { data: rows, error } = await q;
          if (!error && rows && rows.length > 0) {
            return rows.map((r: any) => {
              let interests = r.interests;
              try { if (typeof interests === 'string') interests = JSON.parse(interests); } catch {}
              const p = { ...r, interests: Array.isArray(interests) ? interests : [] } as unknown as Profile;
              store.profiles.set(p.userId, p);
              return p;
            });
          }
        } catch {}
      }
      store.syncFromDiskIfNeeded();
      const all = Array.from(store.profiles.values());
      if (!args?.where) return all;
      return all.filter((p) => {
        if (args.where?.isDiscoverable !== undefined && p.isDiscoverable !== args.where.isDiscoverable) return false;
        if (args.where?.isOnline !== undefined && p.isOnline !== args.where.isOnline) return false;
        return true;
      });
    },
    upsert: async ({
      where,
      create,
      update,
    }: {
      where: { userId: string };
      create: Omit<Profile, 'id' | 'createdAt' | 'updatedAt'>;
      update: Partial<Profile>;
    }) => {
      const createInterests = typeof create.interests === 'string' ? create.interests : JSON.stringify(create.interests || []);
      const updateInterests = update.interests !== undefined ? (typeof update.interests === 'string' ? update.interests : JSON.stringify(update.interests)) : undefined;

      if (prismaInstance) {
        try {
          const row = await prismaInstance.profile.upsert({
            where: { userId: where.userId },
            create: {
              userId: where.userId,
              displayName: create.displayName,
              gender: create.gender || 'PREFER_NOT_TO_SAY',
              avatarUrl: create.avatarUrl || null,
              bio: create.bio || null,
              course: create.course || null,
              academicYear: create.academicYear || null,
              language: create.language || 'English',
              interests: createInterests,
              isOnline: Boolean(create.isOnline),
              isDiscoverable: create.isDiscoverable !== false,
            },
            update: {
              ...(update.displayName ? { displayName: update.displayName } : {}),
              ...(update.gender ? { gender: update.gender } : {}),
              ...(update.avatarUrl !== undefined ? { avatarUrl: update.avatarUrl } : {}),
              ...(update.bio !== undefined ? { bio: update.bio } : {}),
              ...(update.course !== undefined ? { course: update.course } : {}),
              ...(update.academicYear !== undefined ? { academicYear: update.academicYear } : {}),
              ...(update.language ? { language: update.language } : {}),
              ...(updateInterests !== undefined ? { interests: updateInterests } : {}),
              ...(update.isOnline !== undefined ? { isOnline: update.isOnline } : {}),
              ...(update.isDiscoverable !== undefined ? { isDiscoverable: update.isDiscoverable } : {}),
              ...(update.lastSeenAt ? { lastSeenAt: new Date(update.lastSeenAt) } : {}),
            },
          });
          store.profiles.set(where.userId, row as unknown as Profile);
          return row as unknown as Profile;
        } catch (err: any) {
          console.error('[DATABASE] PostgreSQL profile.upsert error:', err.message);
        }
      }

      const sb = getSupabaseClient();
      if (sb) {
        try {
          const { data: row, error } = await sb
            .from('Profile')
            .upsert({
              userId: where.userId,
              displayName: update.displayName || create.displayName,
              gender: update.gender || create.gender || 'PREFER_NOT_TO_SAY',
              avatarUrl: update.avatarUrl !== undefined ? update.avatarUrl : (create.avatarUrl || null),
              bio: update.bio !== undefined ? update.bio : (create.bio || null),
              course: update.course !== undefined ? update.course : (create.course || null),
              academicYear: update.academicYear !== undefined ? update.academicYear : (create.academicYear || null),
              language: update.language || create.language || 'English',
              interests: updateInterests || createInterests,
              isOnline: update.isOnline !== undefined ? Boolean(update.isOnline) : Boolean(create.isOnline),
              isDiscoverable: update.isDiscoverable !== undefined ? Boolean(update.isDiscoverable) : (create.isDiscoverable !== false),
              updatedAt: new Date().toISOString(),
            }, { onConflict: 'userId' })
            .select()
            .single();
          if (!error && row) {
            let interests = row.interests;
            try { if (typeof interests === 'string') interests = JSON.parse(interests); } catch {}
            const prof = { ...row, interests: Array.isArray(interests) ? interests : [] } as unknown as Profile;
            store.profiles.set(where.userId, prof);
            return prof;
          }
        } catch {}
      }

      store.syncFromDiskIfNeeded();
      const existing = store.profiles.get(where.userId);
      if (existing) {
        const updated = { ...existing, ...update, updatedAt: new Date() };
        store.profiles.set(where.userId, updated);
        store.saveToDisk();
        return updated;
      }
      const id = `profile-${Date.now()}`;
      const newProfile: Profile = {
        id,
        ...create,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      store.profiles.set(where.userId, newProfile);
      store.saveToDisk();
      return newProfile;
    },
    update: async ({ where, data }: { where: { userId: string }; data: Partial<Profile> }) => {
      if (prismaInstance) {
        try {
          const updateInterests = data.interests !== undefined ? (typeof data.interests === 'string' ? data.interests : JSON.stringify(data.interests)) : undefined;
          await prismaInstance.profile.update({
            where: { userId: where.userId },
            data: {
              ...(data.displayName ? { displayName: data.displayName } : {}),
              ...(data.avatarUrl !== undefined ? { avatarUrl: data.avatarUrl } : {}),
              ...(data.bio !== undefined ? { bio: data.bio } : {}),
              ...(data.course !== undefined ? { course: data.course } : {}),
              ...(data.academicYear !== undefined ? { academicYear: data.academicYear } : {}),
              ...(updateInterests !== undefined ? { interests: updateInterests } : {}),
              ...(data.isOnline !== undefined ? { isOnline: data.isOnline } : {}),
              ...(data.isDiscoverable !== undefined ? { isDiscoverable: data.isDiscoverable } : {}),
              ...(data.lastSeenAt ? { lastSeenAt: new Date(data.lastSeenAt) } : {}),
            },
          });
        } catch {}
      }

      const sb = getSupabaseClient();
      if (sb) {
        try {
          const payload: any = { ...data, updatedAt: new Date().toISOString() };
          if (payload.interests && typeof payload.interests !== 'string') {
            payload.interests = JSON.stringify(payload.interests);
          }
          await sb.from('Profile').update(payload).eq('userId', where.userId);
        } catch {}
      }

      store.syncFromDiskIfNeeded();
      const existing = store.profiles.get(where.userId);
      if (!existing) throw new Error(`Profile for user ${where.userId} not found`);
      const updated = { ...existing, ...data, updatedAt: new Date() };
      store.profiles.set(where.userId, updated);
      store.saveToDisk();
      return updated;
    },
  },

  university: {
    findMany: async (args?: { where?: { isActive?: boolean } }): Promise<University[]> => {
      const sb = getSupabaseClient();
      if (sb) {
        try {
          let q = sb.from('University').select('*');
          if (args?.where?.isActive !== undefined) q = q.eq('isActive', args.where.isActive);
          const { data: rows, error } = await q;
          if (!error && rows && rows.length > 0) {
            for (const r of rows) store.universities.set(r.id, r as unknown as University);
            return rows as unknown as University[];
          }
        } catch {}
      }
      const all = Array.from(store.universities.values());
      if (args?.where?.isActive !== undefined) {
        return all.filter((u) => u.isActive === args.where!.isActive);
      }
      return all;
    },
    findUnique: async ({ where }: { where: { id?: string; code?: string } }): Promise<University | null> => {
      const sb = getSupabaseClient();
      if (sb) {
        try {
          let q = sb.from('University').select('*');
          if (where.id) q = q.eq('id', where.id);
          else if (where.code) q = q.eq('code', where.code);
          const { data: row, error } = await q.maybeSingle();
          if (!error && row) {
            store.universities.set(row.id, row as unknown as University);
            return row as unknown as University;
          }
        } catch {}
      }
      if (where.id) return store.universities.get(where.id) || null;
      if (where.code) {
        return Array.from(store.universities.values()).find(
          (u) => u.code.toUpperCase() === where.code!.toUpperCase()
        ) || null;
      }
      return null;
    },
    create: async ({ data }: { data: Omit<University, 'id' | 'createdAt' | 'updatedAt'> }) => {
      const id = `uni-${Date.now()}`;
      const uni: University = {
        id,
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      store.universities.set(id, uni);
      return uni;
    },
    update: async ({ where, data }: { where: { id: string }; data: Partial<University> }) => {
      const existing = store.universities.get(where.id);
      if (!existing) throw new Error(`University ${where.id} not found`);
      const updated = { ...existing, ...data, updatedAt: new Date() };
      store.universities.set(where.id, updated);
      return updated;
    },
  },

  verification: {
    findMany: async (args?: { where?: { status?: string; userId?: string } }): Promise<StudentVerification[]> => {
      const all = Array.from(store.verifications.values());
      if (!args?.where) return all;
      return all.filter((v) => {
        if (args.where?.status && v.status !== args.where.status) return false;
        if (args.where?.userId && v.userId !== args.where.userId) return false;
        return true;
      });
    },
    findUnique: async ({ where }: { where: { id: string } }): Promise<StudentVerification | null> => {
      return store.verifications.get(where.id) || null;
    },
    create: async ({ data }: { data: Omit<StudentVerification, 'id' | 'createdAt' | 'updatedAt'> }) => {
      const id = `ver-${Date.now()}`;
      const ver: StudentVerification = {
        id,
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      store.verifications.set(id, ver);
      return ver;
    },
    update: async ({ where, data }: { where: { id: string }; data: Partial<StudentVerification> }) => {
      const existing = store.verifications.get(where.id);
      if (!existing) throw new Error(`Verification ${where.id} not found`);
      const updated = { ...existing, ...data, updatedAt: new Date() };
      store.verifications.set(where.id, updated);
      return updated;
    },
  },

  matchingPreference: {
    findUnique: async ({ where }: { where: { userId: string } }): Promise<MatchingPreference | null> => {
      store.syncFromDiskIfNeeded();
      return store.preferences.get(where.userId) || null;
    },
    upsert: async ({
      where,
      create,
      update,
    }: {
      where: { userId: string };
      create: Omit<MatchingPreference, 'id' | 'updatedAt'>;
      update: Partial<MatchingPreference>;
    }) => {
      store.syncFromDiskIfNeeded();
      const existing = store.preferences.get(where.userId);
      if (existing) {
        const updated = { ...existing, ...update, updatedAt: new Date() };
        store.preferences.set(where.userId, updated);
        store.saveToDisk();
        return updated;
      }
      const newPref: MatchingPreference = {
        id: `pref-${Date.now()}`,
        ...create,
        updatedAt: new Date(),
      };
      store.preferences.set(where.userId, newPref);
      store.saveToDisk();
      return newPref;
    },
  },

  matchQueue: {
    findUnique: async ({ where }: { where: { userId: string } }): Promise<MatchQueueEntry | null> => {
      store.syncFromDiskIfNeeded();
      return store.matchQueue.get(where.userId) || null;
    },
    findMany: async (args?: { where?: { status?: string } }): Promise<MatchQueueEntry[]> => {
      store.syncFromDiskIfNeeded();
      const all = Array.from(store.matchQueue.values());
      if (args?.where?.status) {
        return all.filter((q) => q.status === args.where!.status);
      }
      return all;
    },
    upsert: async ({
      where,
      create,
      update,
    }: {
      where: { userId: string };
      create: Omit<MatchQueueEntry, 'id' | 'joinedAt'>;
      update: Partial<MatchQueueEntry>;
    }) => {
      store.syncFromDiskIfNeeded();
      const existing = store.matchQueue.get(where.userId);
      if (existing) {
        const updated = { ...existing, ...update };
        store.matchQueue.set(where.userId, updated);
        store.saveToDisk();
        return updated;
      }
      const entry: MatchQueueEntry = {
        id: `queue-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        ...create,
        joinedAt: new Date(),
      };
      store.matchQueue.set(where.userId, entry);
      store.saveToDisk();
      return entry;
    },
    delete: async ({ where }: { where: { userId: string } }) => {
      store.syncFromDiskIfNeeded();
      const res = store.matchQueue.delete(where.userId);
      store.saveToDisk();
      return res;
    },
    update: async ({ where, data }: { where: { userId: string }; data: Partial<MatchQueueEntry> }) => {
      store.syncFromDiskIfNeeded();
      const existing = store.matchQueue.get(where.userId);
      if (!existing) return null;
      const updated = { ...existing, ...data };
      store.matchQueue.set(where.userId, updated);
      store.saveToDisk();
      return updated;
    },
  },

  conversation: {
    findUnique: async ({ where }: { where: { id: string } }): Promise<Conversation | null> => {
      if (prismaInstance) {
        try {
          const row = await prismaInstance.conversation.findUnique({ where: { id: where.id } });
          if (row) return row as unknown as Conversation;
        } catch (err: any) {
          console.error('[DATABASE] PostgreSQL conversation.findUnique error:', err.message);
        }
      }
      const sb = getSupabaseClient();
      if (sb) {
        try {
          const { data: row, error } = await sb.from('Conversation').select('*').eq('id', where.id).maybeSingle();
          if (!error && row) return row as unknown as Conversation;
        } catch {}
      }
      store.syncFromDiskIfNeeded();
      return store.conversations.get(where.id) || null;
    },
    findMany: async (args?: { where?: { status?: string } }): Promise<Conversation[]> => {
      if (prismaInstance) {
        try {
          const rows = await prismaInstance.conversation.findMany({
            where: {
              ...(args?.where?.status ? { status: args.where.status } : {}),
            },
          });
          if (rows.length > 0) return rows as unknown as Conversation[];
        } catch (err: any) {
          console.error('[DATABASE] PostgreSQL conversation.findMany error:', err.message);
        }
      }
      const sb = getSupabaseClient();
      if (sb) {
        try {
          let q = sb.from('Conversation').select('*');
          if (args?.where?.status) q = q.eq('status', args.where.status);
          const { data: rows, error } = await q;
          if (!error && rows && rows.length > 0) return rows as unknown as Conversation[];
        } catch {}
      }
      store.syncFromDiskIfNeeded();
      const all = Array.from(store.conversations.values());
      if (args?.where?.status) {
        return all.filter((c) => c.status === args.where!.status);
      }
      return all;
    },
    create: async ({ data }: { data: Omit<Conversation, 'id' | 'startedAt'> & { id?: string } }) => {
      const id = data.id || `conv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const startedAt = new Date();

      if (prismaInstance) {
        try {
          const row = await prismaInstance.conversation.create({
            data: {
              id,
              status: data.status || 'ACTIVE',
              startedAt,
              endedAt: data.endedAt ? new Date(data.endedAt) : null,
              endedByUserId: data.endedByUserId || null,
              endReason: data.endReason || null,
              creditDeducted: Boolean(data.creditDeducted),
            },
          });
          store.conversations.set(id, row as unknown as Conversation);
          return row as unknown as Conversation;
        } catch (err: any) {
          console.error('[DATABASE] PostgreSQL conversation.create error:', err.message);
        }
      }

      const sb = getSupabaseClient();
      if (sb) {
        try {
          const { data: row, error } = await sb
            .from('Conversation')
            .upsert({
              id,
              status: data.status || 'ACTIVE',
              startedAt: startedAt.toISOString(),
              endedAt: data.endedAt ? new Date(data.endedAt).toISOString() : null,
              endedByUserId: data.endedByUserId || null,
              endReason: data.endReason || null,
              creditDeducted: Boolean(data.creditDeducted),
            })
            .select()
            .single();
          if (!error && row) {
            store.conversations.set(id, row as unknown as Conversation);
            return row as unknown as Conversation;
          }
        } catch {}
      }

      store.syncFromDiskIfNeeded();
      const conv: Conversation = {
        id,
        ...data,
        startedAt,
      };
      store.conversations.set(id, conv);
      store.saveToDisk();
      return conv;
    },
    update: async ({ where, data }: { where: { id: string }; data: Partial<Conversation> }) => {
      if (prismaInstance) {
        try {
          const row = await prismaInstance.conversation.update({
            where: { id: where.id },
            data: {
              ...(data.status ? { status: data.status } : {}),
              ...(data.endedAt !== undefined ? { endedAt: data.endedAt ? new Date(data.endedAt) : null } : {}),
              ...(data.endedByUserId !== undefined ? { endedByUserId: data.endedByUserId } : {}),
              ...(data.endReason !== undefined ? { endReason: data.endReason } : {}),
            },
          });
          store.conversations.set(where.id, row as unknown as Conversation);
          return row as unknown as Conversation;
        } catch (err: any) {
          console.error('[DATABASE] PostgreSQL conversation.update error:', err.message);
        }
      }

      const sb = getSupabaseClient();
      if (sb) {
        try {
          await sb.from('Conversation').update({
            ...(data.status ? { status: data.status } : {}),
            ...(data.endedAt !== undefined ? { endedAt: data.endedAt ? new Date(data.endedAt).toISOString() : null } : {}),
            ...(data.endedByUserId !== undefined ? { endedByUserId: data.endedByUserId } : {}),
            ...(data.endReason !== undefined ? { endReason: data.endReason } : {}),
          }).eq('id', where.id);
        } catch {}
      }

      store.syncFromDiskIfNeeded();
      const existing = store.conversations.get(where.id);
      if (!existing) throw new Error(`Conversation ${where.id} not found`);
      const updated = { ...existing, ...data };
      store.conversations.set(where.id, updated);
      store.saveToDisk();
      return updated;
    },
  },

  conversationParticipant: {
    findMany: async (args?: { where?: { userId?: string; conversationId?: string; hidden?: boolean } }): Promise<ConversationParticipant[]> => {
      if (prismaInstance) {
        try {
          const rows = await prismaInstance.conversationParticipant.findMany({
            where: {
              ...(args?.where?.userId ? { userId: args.where.userId } : {}),
              ...(args?.where?.conversationId ? { conversationId: args.where.conversationId } : {}),
            },
          });
          if (rows.length > 0) return rows as unknown as ConversationParticipant[];
        } catch (err: any) {
          console.error('[DATABASE] PostgreSQL conversationParticipant.findMany error:', err.message);
        }
      }

      const sb = getSupabaseClient();
      if (sb) {
        try {
          let q = sb.from('ConversationParticipant').select('*');
          if (args?.where?.userId) q = q.eq('userId', args.where.userId);
          if (args?.where?.conversationId) q = q.eq('conversationId', args.where.conversationId);
          const { data: rows, error } = await q;
          if (!error && rows && rows.length > 0) {
            for (const r of rows) store.conversationParticipants.set(r.id, r as unknown as ConversationParticipant);
            return rows as unknown as ConversationParticipant[];
          }
        } catch {}
      }

      store.syncFromDiskIfNeeded();
      const all = Array.from(store.conversationParticipants.values());
      const where = args?.where;
      if (!where) return all;
      return all.filter((p) => {
        if (where.userId && p.userId !== where.userId) return false;
        if (where.conversationId && p.conversationId !== where.conversationId) return false;
        if (where.hidden !== undefined && Boolean(p.hidden) !== where.hidden) return false;
        return true;
      });
    },
    findFirst: async ({ where }: { where: { userId: string; conversationId: string } }): Promise<ConversationParticipant | null> => {
      if (prismaInstance) {
        try {
          const row = await prismaInstance.conversationParticipant.findFirst({
            where: {
              userId: where.userId,
              conversationId: where.conversationId,
            },
          });
          if (row) return row as unknown as ConversationParticipant;
        } catch (err: any) {
          console.error('[DATABASE] PostgreSQL conversationParticipant.findFirst error:', err.message);
        }
      }

      const sb = getSupabaseClient();
      if (sb) {
        try {
          const { data: row, error } = await sb
            .from('ConversationParticipant')
            .select('*')
            .eq('userId', where.userId)
            .eq('conversationId', where.conversationId)
            .maybeSingle();
          if (!error && row) {
            store.conversationParticipants.set(row.id, row as unknown as ConversationParticipant);
            return row as unknown as ConversationParticipant;
          }
        } catch {}
      }

      store.syncFromDiskIfNeeded();
      return Array.from(store.conversationParticipants.values()).find(
        (p) => p.userId === where.userId && p.conversationId === where.conversationId
      ) || null;
    },
    create: async ({ data }: { data: Omit<ConversationParticipant, 'id' | 'joinedAt'> }) => {
      const id = `part-${data.conversationId}-${data.userId}`;
      const joinedAt = new Date();

      if (prismaInstance) {
        try {
          const row = await prismaInstance.conversationParticipant.upsert({
            where: {
              conversationId_userId: {
                conversationId: data.conversationId,
                userId: data.userId,
              },
            },
            create: {
              id,
              conversationId: data.conversationId,
              userId: data.userId,
              joinedAt,
              hasUnread: Boolean(data.hasUnread),
            },
            update: {
              hasUnread: Boolean(data.hasUnread),
            },
          });
          store.conversationParticipants.set(id, row as unknown as ConversationParticipant);
          return row as unknown as ConversationParticipant;
        } catch (err: any) {
          console.error('[DATABASE] PostgreSQL conversationParticipant.create error:', err.message);
        }
      }

      const sb = getSupabaseClient();
      if (sb) {
        try {
          const { data: row, error } = await sb
            .from('ConversationParticipant')
            .upsert({
              id,
              conversationId: data.conversationId,
              userId: data.userId,
              joinedAt: joinedAt.toISOString(),
              hasUnread: Boolean(data.hasUnread),
            }, { onConflict: 'conversationId,userId' })
            .select()
            .single();
          if (!error && row) {
            store.conversationParticipants.set(id, row as unknown as ConversationParticipant);
            return row as unknown as ConversationParticipant;
          }
        } catch {}
      }

      store.syncFromDiskIfNeeded();
      const part: ConversationParticipant = {
        id,
        ...data,
        joinedAt,
      };
      store.conversationParticipants.set(id, part);
      store.saveToDisk();
      return part;
    },
    update: async ({
      where,
      data,
    }: {
      where: {
        conversationId_userId?: { conversationId: string; userId: string };
        conversationId?: string;
        userId?: string;
        id?: string;
      };
      data: Partial<ConversationParticipant>;
    }) => {
      const convId = where.conversationId_userId?.conversationId || where.conversationId;
      const uId = where.conversationId_userId?.userId || where.userId;

      if (prismaInstance && convId && uId) {
        try {
          await prismaInstance.conversationParticipant.update({
            where: {
              conversationId_userId: {
                conversationId: convId,
                userId: uId,
              },
            },
            data,
          });
        } catch {}
      }

      const sb = getSupabaseClient();
      if (sb) {
        try {
          let q = sb.from('ConversationParticipant').update(data);
          if (convId && uId) {
            q = q.eq('conversationId', convId).eq('userId', uId);
          } else if (where.id) {
            q = q.eq('id', where.id);
          }
          await q;
        } catch {}
      }

      store.syncFromDiskIfNeeded();
      let existing: ConversationParticipant | undefined;
      let id = '';

      if (convId && uId) {
        id = `part-${convId}-${uId}`;
        existing = store.conversationParticipants.get(id) || Array.from(store.conversationParticipants.values()).find(
          (p) => p.conversationId === convId && p.userId === uId
        );
      } else if (where.id) {
        existing = store.conversationParticipants.get(where.id);
        id = where.id;
      }

      if (!existing) return null;
      const updated = { ...existing, ...data };
      store.conversationParticipants.set(existing.id || id, updated);
      store.saveToDisk();
      return updated;
    },
  },

  message: {
    findMany: async ({
      where,
      orderBy,
    }: {
      where: { conversationId: string; afterTimestamp?: Date | string | number };
      orderBy?: { createdAt: 'asc' | 'desc' };
    }): Promise<Message[]> => {
      if (prismaInstance) {
        try {
          const afterDate = where.afterTimestamp ? new Date(where.afterTimestamp) : undefined;
          const rows = await prismaInstance.message.findMany({
            where: {
              conversationId: where.conversationId,
              ...(afterDate ? { createdAt: { gt: afterDate } } : {}),
            },
            orderBy: {
              createdAt: orderBy?.createdAt || 'asc',
            },
          });
          if (rows.length > 0) {
            return rows as unknown as Message[];
          }
        } catch (err: any) {
          console.error('[DATABASE] PostgreSQL message query error:', err.message);
        }
      }

      const sb = getSupabaseClient();
      if (sb) {
        try {
          let q = sb.from('Message').select('*').eq('conversationId', where.conversationId);
          if (where.afterTimestamp) {
            q = q.gt('createdAt', new Date(where.afterTimestamp).toISOString());
          }
          const { data: rows, error } = await q.order('createdAt', { ascending: orderBy?.createdAt !== 'desc' });
          if (!error && rows && rows.length > 0) {
            return rows as unknown as Message[];
          }
        } catch (sbErr: any) {
          console.error('[DATABASE] Supabase REST message query error:', sbErr.message);
        }
      }

      store.syncFromDiskIfNeeded();
      let msgs = Array.from(store.messages.values()).filter((m) => m.conversationId === where.conversationId);
      if (where.afterTimestamp) {
        const afterTime = new Date(where.afterTimestamp).getTime();
        msgs = msgs.filter((m) => new Date(m.createdAt).getTime() > afterTime);
      }
      if (orderBy?.createdAt === 'desc') {
        return msgs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      }
      return msgs.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    },
    create: async ({ data }: { data: Omit<Message, 'id' | 'createdAt'> & { id?: string } }) => {
      const id = data.id || `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const createdAt = new Date();

      if (prismaInstance) {
        try {
          const row = await prismaInstance.message.create({
            data: {
              id,
              conversationId: data.conversationId,
              senderId: data.senderId,
              content: data.content,
              isRead: Boolean(data.isRead),
              createdAt,
            },
          });
          store.messages.set(id, row as unknown as Message);
          return row as unknown as Message;
        } catch (err: any) {
          console.error('[DATABASE] PostgreSQL message insert error:', err.message);
        }
      }

      const sb = getSupabaseClient();
      if (sb) {
        try {
          const { data: row, error } = await sb
            .from('Message')
            .insert({
              id,
              conversationId: data.conversationId,
              senderId: data.senderId,
              content: data.content,
              isRead: Boolean(data.isRead),
              createdAt: createdAt.toISOString(),
            })
            .select()
            .single();

          if (!error && row) {
            store.messages.set(id, row as unknown as Message);
            return row as unknown as Message;
          } else if (error) {
            console.error('[DATABASE] Supabase REST message insert error:', error.message);
          }
        } catch (sbErr: any) {
          console.error('[DATABASE] Supabase REST message insert exception:', sbErr.message);
        }
      }

      if (process.env.NODE_ENV === 'production' && (process.env.DATABASE_URL || process.env.SUPABASE_URL)) {
        throw new Error('Failed to commit message to persistent database: All database engines unreachable.');
      }

      store.syncFromDiskIfNeeded();
      const msg: Message = {
        id,
        ...data,
        createdAt,
      };
      store.messages.set(id, msg);
      store.saveToDisk();
      return msg;
    },
  },

  creditPackage: {
    findMany: async (args?: { where?: { isActive?: boolean } }): Promise<CreditPackage[]> => {
      const all = Array.from(store.creditPackages.values());
      if (args?.where?.isActive !== undefined) {
        return all.filter((p) => p.isActive === args.where!.isActive);
      }
      return all;
    },
    findUnique: async ({ where }: { where: { id: string } }) => {
      return store.creditPackages.get(where.id) || null;
    },
    create: async ({ data }: { data: Omit<CreditPackage, 'id' | 'createdAt' | 'updatedAt'> }) => {
      const id = `pkg-${Date.now()}`;
      const pkg: CreditPackage = {
        id,
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      store.creditPackages.set(id, pkg);
      return pkg;
    },
    update: async ({ where, data }: { where: { id: string }; data: Partial<CreditPackage> }) => {
      const existing = store.creditPackages.get(where.id);
      if (!existing) throw new Error(`Credit package ${where.id} not found`);
      const updated = { ...existing, ...data, updatedAt: new Date() };
      store.creditPackages.set(where.id, updated);
      return updated;
    },
  },

  userCreditBalance: {
    findUnique: async ({ where }: { where: { userId: string } }) => {
      const sb = getSupabaseClient();
      if (sb) {
        try {
          const { data: row, error } = await sb.from('UserCreditBalance').select('*').eq('userId', where.userId).maybeSingle();
          if (!error && row) {
            const bal: UserCreditBalance = {
              id: row.id,
              userId: row.userId,
              credits: row.credits,
              updatedAt: new Date(row.updatedAt),
            };
            store.creditBalances.set(where.userId, bal);
            return bal;
          }
        } catch {}
      }
      store.syncFromDiskIfNeeded();
      return store.creditBalances.get(where.userId) || { id: `bal-${where.userId}`, userId: where.userId, credits: 0, updatedAt: new Date() };
    },
    create: async ({ data }: { data: { userId: string; credits: number } }) => {
      const sb = getSupabaseClient();
      if (sb) {
        try {
          await sb.from('UserCreditBalance').upsert({
            id: `bal-${data.userId}`,
            userId: data.userId,
            credits: Math.max(0, data.credits),
            updatedAt: new Date().toISOString(),
          }, { onConflict: 'userId' });
        } catch {}
      }
      store.syncFromDiskIfNeeded();
      const bal: UserCreditBalance = {
        id: `bal-${data.userId}`,
        userId: data.userId,
        credits: Math.max(0, data.credits),
        updatedAt: new Date(),
      };
      store.creditBalances.set(data.userId, bal);
      store.saveToDisk();
      return bal;
    },
    upsert: async ({
      where,
      create,
      update,
    }: {
      where: { userId: string };
      create: { userId: string; credits: number };
      update: { credits?: number | { increment?: number; decrement?: number; set?: number } };
    }) => {
      store.syncFromDiskIfNeeded();
      const existing = store.creditBalances.get(where.userId);
      let currentCredits = existing ? existing.credits : create.credits;

      if (typeof update.credits === 'number') {
        currentCredits = update.credits;
      } else if (typeof update.credits === 'object' && update.credits !== null) {
        if (update.credits.increment !== undefined) {
          currentCredits += update.credits.increment;
        } else if (update.credits.decrement !== undefined) {
          currentCredits -= update.credits.decrement;
        } else if (update.credits.set !== undefined) {
          currentCredits = update.credits.set;
        }
      }

      const balCredits = Math.max(0, currentCredits);
      const sb = getSupabaseClient();
      if (sb) {
        try {
          await sb.from('UserCreditBalance').upsert({
            id: existing?.id || `bal-${where.userId}`,
            userId: where.userId,
            credits: balCredits,
            updatedAt: new Date().toISOString(),
          }, { onConflict: 'userId' });
        } catch {}
      }

      const bal: UserCreditBalance = {
        id: existing?.id || `bal-${where.userId}`,
        userId: where.userId,
        credits: balCredits,
        updatedAt: new Date(),
      };
      store.creditBalances.set(where.userId, bal);
      store.saveToDisk();
      return bal;
    },
  },

  creditLedger: {
    findMany: async ({ where, orderBy }: { where: { userId: string }; orderBy?: { createdAt: 'desc' } }): Promise<CreditLedgerEntry[]> => {
      store.syncFromDiskIfNeeded();
      const all = Array.from(store.creditLedgers.values()).filter((l) => l.userId === where.userId);
      return all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    },
    create: async ({ data }: { data: Omit<CreditLedgerEntry, 'id' | 'createdAt'> }) => {
      store.syncFromDiskIfNeeded();
      const id = `ledger-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const entry: CreditLedgerEntry = {
        id,
        ...data,
        createdAt: new Date(),
      };
      store.creditLedgers.set(id, entry);
      store.saveToDisk();
      return entry;
    },
  },

  paymentOrder: {
    findUnique: async ({ where }: { where: { id?: string; razorpayOrderId?: string; idempotencyKey?: string } }) => {
      if (where.id) return store.paymentOrders.get(where.id) || null;
      return Array.from(store.paymentOrders.values()).find((o) => {
        if (where.razorpayOrderId && o.razorpayOrderId === where.razorpayOrderId) return true;
        if (where.idempotencyKey && o.idempotencyKey === where.idempotencyKey) return true;
        return false;
      }) || null;
    },
    findMany: async (args?: { where?: { userId?: string } }): Promise<PaymentOrder[]> => {
      const all = Array.from(store.paymentOrders.values());
      if (args?.where?.userId) {
        return all.filter((o) => o.userId === args.where!.userId);
      }
      return all;
    },
    create: async ({ data }: { data: Omit<PaymentOrder, 'id' | 'createdAt' | 'updatedAt'> }) => {
      const id = `order-${Date.now()}`;
      const order: PaymentOrder = {
        id,
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      store.paymentOrders.set(id, order);
      return order;
    },
    update: async ({ where, data }: { where: { id: string }; data: Partial<PaymentOrder> }) => {
      const existing = store.paymentOrders.get(where.id);
      if (!existing) throw new Error(`Order ${where.id} not found`);
      const updated = { ...existing, ...data, updatedAt: new Date() };
      store.paymentOrders.set(where.id, updated);
      return updated;
    },
  },

  paymentTransaction: {
    findUnique: async ({ where }: { where: { razorpayPaymentId?: string; orderId?: string } }): Promise<PaymentTransaction | null> => {
      return Array.from(store.paymentTransactions.values()).find((t) => {
        if (where.razorpayPaymentId && t.razorpayPaymentId === where.razorpayPaymentId) return true;
        if (where.orderId && t.orderId === where.orderId) return true;
        return false;
      }) || null;
    },
    create: async ({ data }: { data: Omit<PaymentTransaction, 'id' | 'verifiedAt'> }) => {
      const id = `txn-${Date.now()}`;
      const txn: PaymentTransaction = {
        id,
        ...data,
        verifiedAt: new Date(),
      };
      store.paymentTransactions.set(id, txn);
      return txn;
    },
  },

  block: {
    findUnique: async ({ where }: { where: { blockerId_blockedId?: { blockerId: string; blockedId: string }; blockerId?: string; blockedId?: string } }): Promise<Block | null> => {
      store.syncFromDiskIfNeeded();
      const bId = where.blockerId_blockedId?.blockerId || where.blockerId;
      const tId = where.blockerId_blockedId?.blockedId || where.blockedId;
      if (!bId || !tId) return null;
      const key = `${bId}_${tId}`;
      return store.blocks.get(key) || null;
    },
    findFirst: async ({ where }: { where: { blockerId?: string; blockedId?: string; blockerId_blockedId?: { blockerId: string; blockedId: string } } }): Promise<Block | null> => {
      store.syncFromDiskIfNeeded();
      if (where.blockerId_blockedId) {
        const key = `${where.blockerId_blockedId.blockerId}_${where.blockerId_blockedId.blockedId}`;
        return store.blocks.get(key) || null;
      }
      const all = Array.from(store.blocks.values());
      return all.find((b) => {
        if (where.blockerId && b.blockerId !== where.blockerId) return false;
        if (where.blockedId && b.blockedId !== where.blockedId) return false;
        return true;
      }) || null;
    },
    findMany: async (args?: { where?: { blockerId?: string; blockedId?: string } }): Promise<Block[]> => {
      store.syncFromDiskIfNeeded();
      const all = Array.from(store.blocks.values());
      if (!args?.where) return all;
      return all.filter((b) => {
        if (args.where?.blockerId && b.blockerId !== args.where.blockerId) return false;
        if (args.where?.blockedId && b.blockedId !== args.where.blockedId) return false;
        return true;
      });
    },
    create: async ({ data }: { data: Omit<Block, 'id' | 'createdAt'> }) => {
      store.syncFromDiskIfNeeded();
      const key = `${data.blockerId}_${data.blockedId}`;
      const block: Block = {
        id: `blk-${Date.now()}`,
        ...data,
        createdAt: new Date(),
      };
      store.blocks.set(key, block);
      store.saveToDisk();
      return block;
    },
    delete: async ({ where }: { where: { blockerId_blockedId?: { blockerId: string; blockedId: string }; blockerId?: string; blockedId?: string } }) => {
      store.syncFromDiskIfNeeded();
      const bId = where.blockerId_blockedId?.blockerId || where.blockerId;
      const tId = where.blockerId_blockedId?.blockedId || where.blockedId;
      if (!bId || !tId) return false;
      const key = `${bId}_${tId}`;
      const res = store.blocks.delete(key);
      store.saveToDisk();
      return res;
    },
  },

  abuseReport: {
    findMany: async (args?: { where?: { status?: string } }): Promise<AbuseReport[]> => {
      const all = Array.from(store.abuseReports.values());
      if (args?.where?.status) {
        return all.filter((r) => r.status === args.where!.status);
      }
      return all;
    },
    create: async ({ data }: { data: Omit<AbuseReport, 'id' | 'createdAt' | 'updatedAt'> }) => {
      const id = `report-${Date.now()}`;
      const report: AbuseReport = {
        id,
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      store.abuseReports.set(id, report);
      return report;
    },
    update: async ({ where, data }: { where: { id: string }; data: Partial<AbuseReport> }) => {
      const existing = store.abuseReports.get(where.id);
      if (!existing) throw new Error(`Report ${where.id} not found`);
      const updated = { ...existing, ...data, updatedAt: new Date() };
      store.abuseReports.set(where.id, updated);
      return updated;
    },
  },

  adminAuditLog: {
    findMany: async (): Promise<AdminAuditLog[]> => {
      return Array.from(store.auditLogs.values()).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    },
    create: async ({ data }: { data: Omit<AdminAuditLog, 'id' | 'createdAt'> }) => {
      const id = `audit-${Date.now()}`;
      const log: AdminAuditLog = {
        id,
        ...data,
        createdAt: new Date(),
      };
      store.auditLogs.set(id, log);
      return log;
    },
  },

  friendRequest: {
    findUnique: async ({ where }: { where: { id: string } }): Promise<FriendRequest | null> => {
      const targetId = where.id.trim();
      if (prismaInstance) {
        try {
          const row = await prismaInstance.friendRequest.findUnique({ where: { id: targetId } });
          if (row) return row as unknown as FriendRequest;
        } catch (err: any) {
          console.error('[DATABASE] PostgreSQL friendRequest.findUnique error:', err.message);
        }
      }
      const sb = getSupabaseClient();
      if (sb) {
        try {
          const { data: row, error } = await sb.from('FriendRequest').select('*').eq('id', targetId).maybeSingle();
          if (!error && row) {
            store.friendRequests.set(row.id, row as unknown as FriendRequest);
            return row as unknown as FriendRequest;
          }
        } catch {}
      }
      store.syncFromDiskIfNeeded();
      return store.friendRequests.get(targetId) || Array.from(store.friendRequests.values()).find((r) => r.id === targetId) || null;
    },
    findFirst: async ({ where }: { where: { senderId?: string; receiverId?: string; status?: FriendRequestStatus } }): Promise<FriendRequest | null> => {
      if (prismaInstance) {
        try {
          const row = await prismaInstance.friendRequest.findFirst({
            where: {
              ...(where.senderId ? { senderId: where.senderId } : {}),
              ...(where.receiverId ? { receiverId: where.receiverId } : {}),
              ...(where.status ? { status: where.status } : {}),
            },
          });
          if (row) return row as unknown as FriendRequest;
        } catch (err: any) {
          console.error('[DATABASE] PostgreSQL friendRequest.findFirst error:', err.message);
        }
      }
      const sb = getSupabaseClient();
      if (sb) {
        try {
          let q = sb.from('FriendRequest').select('*');
          if (where.senderId) q = q.eq('senderId', where.senderId);
          if (where.receiverId) q = q.eq('receiverId', where.receiverId);
          if (where.status) q = q.eq('status', where.status);
          const { data: row, error } = await q.maybeSingle();
          if (!error && row) {
            store.friendRequests.set(row.id, row as unknown as FriendRequest);
            return row as unknown as FriendRequest;
          }
        } catch {}
      }
      store.syncFromDiskIfNeeded();
      const all = Array.from(store.friendRequests.values());
      return all.find((r) => {
        if (where.senderId && r.senderId !== where.senderId) return false;
        if (where.receiverId && r.receiverId !== where.receiverId) return false;
        if (where.status && r.status !== where.status) return false;
        return true;
      }) || null;
    },
    findMany: async (args?: {
      where?: {
        senderId?: string;
        receiverId?: string;
        status?: FriendRequestStatus;
        OR?: Array<{ senderId?: string; receiverId?: string; status?: FriendRequestStatus }>;
      };
    }): Promise<FriendRequest[]> => {
      if (prismaInstance) {
        try {
          const rows = await prismaInstance.friendRequest.findMany({
            where: {
              ...(args?.where?.senderId ? { senderId: args.where.senderId } : {}),
              ...(args?.where?.receiverId ? { receiverId: args.where.receiverId } : {}),
              ...(args?.where?.status ? { status: args.where.status } : {}),
              ...(args?.where?.OR ? { OR: args.where.OR as any } : {}),
            },
          });
          if (rows.length > 0) return rows as unknown as FriendRequest[];
        } catch (err: any) {
          console.error('[DATABASE] PostgreSQL friendRequest.findMany error:', err.message);
        }
      }
      const sb = getSupabaseClient();
      if (sb) {
        try {
          let q = sb.from('FriendRequest').select('*');
          if (args?.where?.senderId) q = q.eq('senderId', args.where.senderId);
          if (args?.where?.receiverId) q = q.eq('receiverId', args.where.receiverId);
          if (args?.where?.status) q = q.eq('status', args.where.status);
          const { data: rows, error } = await q;
          if (!error && rows && rows.length > 0) {
            for (const r of rows) store.friendRequests.set(r.id, r as unknown as FriendRequest);
            return rows as unknown as FriendRequest[];
          }
        } catch {}
      }
      store.syncFromDiskIfNeeded();
      const all = Array.from(store.friendRequests.values());
      if (!args?.where) return all;
      return all.filter((r) => {
        if (args.where?.OR && Array.isArray(args.where.OR)) {
          const matchesAny = args.where.OR.some((clause) => {
            if (clause.senderId && r.senderId !== clause.senderId) return false;
            if (clause.receiverId && r.receiverId !== clause.receiverId) return false;
            if (clause.status && r.status !== clause.status) return false;
            return true;
          });
          if (!matchesAny) return false;
        }
        if (args.where?.senderId && r.senderId !== args.where.senderId) return false;
        if (args.where?.receiverId && r.receiverId !== args.where.receiverId) return false;
        if (args.where?.status && r.status !== args.where.status) return false;
        return true;
      });
    },
    create: async ({ data }: { data: Omit<FriendRequest, 'id' | 'createdAt' | 'updatedAt'> }) => {
      const id = `freq-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const now = new Date();

      if (prismaInstance) {
        try {
          const row = await prismaInstance.friendRequest.create({
            data: {
              id,
              senderId: data.senderId,
              receiverId: data.receiverId,
              status: data.status || 'PENDING',
              createdAt: now,
              updatedAt: now,
            },
          });
          store.friendRequests.set(id, row as unknown as FriendRequest);
          return row as unknown as FriendRequest;
        } catch (err: any) {
          console.error('[DATABASE] PostgreSQL friendRequest.create error:', err.message);
        }
      }

      const sb = getSupabaseClient();
      if (sb) {
        try {
          const { data: row, error } = await sb
            .from('FriendRequest')
            .upsert({
              id,
              senderId: data.senderId,
              receiverId: data.receiverId,
              status: data.status || 'PENDING',
              createdAt: now.toISOString(),
              updatedAt: now.toISOString(),
            }, { onConflict: 'senderId,receiverId' })
            .select()
            .single();
          if (!error && row) {
            store.friendRequests.set(id, row as unknown as FriendRequest);
            return row as unknown as FriendRequest;
          }
        } catch {}
      }

      store.syncFromDiskIfNeeded();
      const req: FriendRequest = {
        id,
        ...data,
        createdAt: now,
        updatedAt: now,
      };
      store.friendRequests.set(id, req);
      store.saveToDisk();
      return req;
    },
    update: async ({ where, data }: { where: { id: string }; data: Partial<FriendRequest> }) => {
      const now = new Date();
      if (prismaInstance) {
        try {
          const row = await prismaInstance.friendRequest.update({
            where: { id: where.id },
            data: {
              ...(data.status ? { status: data.status } : {}),
              updatedAt: now,
            },
          });
          store.friendRequests.set(where.id, row as unknown as FriendRequest);
          return row as unknown as FriendRequest;
        } catch (err: any) {
          console.error('[DATABASE] PostgreSQL friendRequest.update error:', err.message);
        }
      }

      const sb = getSupabaseClient();
      if (sb) {
        try {
          await sb.from('FriendRequest').update({
            ...(data.status ? { status: data.status } : {}),
            updatedAt: now.toISOString(),
          }).eq('id', where.id);
        } catch {}
      }

      store.syncFromDiskIfNeeded();
      const existing = store.friendRequests.get(where.id) || Array.from(store.friendRequests.values()).find((r) => r.id === where.id);
      if (!existing) throw new Error(`Friend request ${where.id} not found`);
      const updated = { ...existing, ...data, updatedAt: now };
      store.friendRequests.set(existing.id, updated);
      store.saveToDisk();
      return updated;
    },
    delete: async ({ where }: { where: { id: string } }) => {
      if (prismaInstance) {
        try {
          await prismaInstance.friendRequest.delete({ where: { id: where.id } });
        } catch (err: any) {
          console.error('[DATABASE] PostgreSQL friendRequest.delete error:', err.message);
        }
      }
      const sb = getSupabaseClient();
      if (sb) {
        try {
          await sb.from('FriendRequest').delete().eq('id', where.id);
        } catch {}
      }
      store.syncFromDiskIfNeeded();
      store.friendRequests.delete(where.id);
      store.saveToDisk();
      return true;
    },
  },
};


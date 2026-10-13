import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { APP_CONFIG } from './config';
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
} from '@/types';

// Global singleton database store with disk persistence across hot reloads & server restarts
declare global {
  // eslint-disable-next-line no-var
  var __campusConnectDb: InMemoryStore | undefined;
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

  initialized = false;
  saveTimeout: NodeJS.Timeout | null = null;

  constructor() {
    this.seed();
    this.loadFromDisk();
  }

  getStoreFilePath() {
    if (process.env.VERCEL) {
      return '/tmp/data_store.json';
    }
    return path.join(process.cwd(), 'prisma', 'data_store.json');
  }

  saveToDisk() {
    try {
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
      };
      fs.writeFileSync(dbFile, JSON.stringify(serialized, null, 2), 'utf-8');
    } catch {
      // Ignore write error on read-only environments
    }
  }

  scheduleSave() {
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
  }

  loadFromDisk() {
    try {
      const dbFile = this.getStoreFilePath();
      if (fs.existsSync(dbFile)) {
        const raw = fs.readFileSync(dbFile, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed.users) this.users = new Map(parsed.users);
        if (parsed.profiles) this.profiles = new Map(parsed.profiles);
        if (parsed.universities) this.universities = new Map(parsed.universities);
        if (parsed.verifications) this.verifications = new Map(parsed.verifications);
        if (parsed.preferences) this.preferences = new Map(parsed.preferences);
        if (parsed.matchQueue) this.matchQueue = new Map(parsed.matchQueue);
        if (parsed.conversations) this.conversations = new Map(parsed.conversations);
        if (parsed.conversationParticipants) this.conversationParticipants = new Map(parsed.conversationParticipants);
        if (parsed.messages) this.messages = new Map(parsed.messages);
        if (parsed.creditPackages) this.creditPackages = new Map(parsed.creditPackages);
        if (parsed.creditBalances) this.creditBalances = new Map(parsed.creditBalances);
        if (parsed.creditLedgers) this.creditLedgers = new Map(parsed.creditLedgers);
        if (parsed.paymentOrders) this.paymentOrders = new Map(parsed.paymentOrders);
        if (parsed.paymentTransactions) this.paymentTransactions = new Map(parsed.paymentTransactions);
        if (parsed.blocks) this.blocks = new Map(parsed.blocks);
        if (parsed.abuseReports) this.abuseReports = new Map(parsed.abuseReports);
        if (parsed.auditLogs) this.auditLogs = new Map(parsed.auditLogs);
      }
    } catch (err) {
      console.error('Error loading data_store from disk:', err);
    }
    this.attachAllHooks();
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

    // 3. Seed Admin User
    const adminPasswordHash = bcrypt.hashSync('AdminSecurePassword123!', 10);
    const adminId = 'user-admin-1';
    this.users.set(adminId, {
      id: adminId,
      email: 'admin@campusconnect.edu',
      passwordHash: adminPasswordHash,
      role: 'ADMIN',
      status: 'ACTIVE',
      isAgeVerified: true,
      dateOfBirth: new Date('1998-01-15'),
      universityId: uniIds['LPU'],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    this.profiles.set(adminId, {
      id: 'profile-admin-1',
      userId: adminId,
      displayName: 'System Admin',
      gender: 'PREFER_NOT_TO_SAY',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      bio: 'CampusConnect Platform Administrator',
      course: 'Administration',
      academicYear: 'Staff',
      language: 'English',
      interests: ['Security', 'Community', 'Technology'],
      isOnline: true,
      isDiscoverable: false,
      lastSeenAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    this.creditBalances.set(adminId, {
      id: 'bal-admin-1',
      userId: adminId,
      credits: 999,
      updatedAt: new Date(),
    });

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
        year: '3rd Year',
        bio: 'Tech enthusiast, competitive coder, exploring distributed systems and hackathons.',
        interests: ['Coding', 'AI / ML', 'Gaming', 'Hackathons'],
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
        year: '1st Year',
        bio: 'Passionate about digital branding, product design, and university debates.',
        interests: ['Marketing', 'Design', 'Music', 'Debate'],
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
        year: '2nd Year',
        bio: 'Economics enthusiast from St. Stephen’s. Keen on finance, geopolitical trends, and photography.',
        interests: ['Economics', 'Finance', 'Photography', 'Podcasts'],
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
        year: '4th Year',
        bio: 'Senior research fellow in computational biology. Love indie music and badminton.',
        interests: ['Biotech', 'Research', 'Badminton', 'Indie Music'],
        credits: 4,
        isVerified: true,
        avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200',
      },
    ];

    demoStudents.forEach((st) => {
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

      this.profiles.set(st.id, {
        id: `profile-${st.id}`,
        userId: st.id,
        displayName: st.name,
        gender: st.gender,
        avatarUrl: st.avatar,
        bio: st.bio,
        course: st.course,
        academicYear: st.year,
        language: 'English',
        interests: st.interests,
        isOnline: true,
        isDiscoverable: true,
        lastSeenAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      this.creditBalances.set(st.id, {
        id: `bal-${st.id}`,
        userId: st.id,
        credits: st.credits,
        updatedAt: new Date(),
      });

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

    this.initialized = true;
  }
}

const store = global.__campusConnectDb || new InMemoryStore();
if (process.env.NODE_ENV !== 'production') {
  global.__campusConnectDb = store;
}

export const db = {
  store,

  user: {
    findUnique: async ({ where }: { where: { id?: string; email?: string } }) => {
      if (where.id) return store.users.get(where.id) || null;
      if (where.email) {
        return Array.from(store.users.values()).find(
          (u) => u.email.toLowerCase() === where.email!.toLowerCase() && !u.deletedAt
        ) || null;
      }
      return null;
    },
    findMany: async (args?: { where?: Partial<User> }) => {
      const all = Array.from(store.users.values()).filter((u) => !u.deletedAt);
      if (!args?.where) return all;
      return all.filter((u) => {
        for (const [key, val] of Object.entries(args.where!)) {
          if ((u as any)[key] !== val) return false;
        }
        return true;
      });
    },
    create: async ({ data }: { data: Omit<User, 'id' | 'createdAt' | 'updatedAt'> & { id?: string } }) => {
      const id = data.id || `user-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const user: User = {
        id,
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      store.users.set(id, user);
      return user;
    },
    update: async ({ where, data }: { where: { id: string }; data: Partial<User> }) => {
      const existing = store.users.get(where.id);
      if (!existing) throw new Error(`User ${where.id} not found`);
      const updated = { ...existing, ...data, updatedAt: new Date() };
      store.users.set(where.id, updated);
      return updated;
    },
    count: async () => store.users.size,
  },

  profile: {
    findUnique: async ({ where }: { where: { userId: string } }) => {
      return store.profiles.get(where.userId) || null;
    },
    findMany: async (args?: { where?: { isDiscoverable?: boolean; isOnline?: boolean } }) => {
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
      const existing = store.profiles.get(where.userId);
      if (existing) {
        const updated = { ...existing, ...update, updatedAt: new Date() };
        store.profiles.set(where.userId, updated);
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
      return newProfile;
    },
    update: async ({ where, data }: { where: { userId: string }; data: Partial<Profile> }) => {
      const existing = store.profiles.get(where.userId);
      if (!existing) throw new Error(`Profile for user ${where.userId} not found`);
      const updated = { ...existing, ...data, updatedAt: new Date() };
      store.profiles.set(where.userId, updated);
      return updated;
    },
  },

  university: {
    findMany: async (args?: { where?: { isActive?: boolean } }) => {
      const all = Array.from(store.universities.values());
      if (args?.where?.isActive !== undefined) {
        return all.filter((u) => u.isActive === args.where!.isActive);
      }
      return all;
    },
    findUnique: async ({ where }: { where: { id?: string; code?: string } }) => {
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
    findMany: async (args?: { where?: { status?: string; userId?: string } }) => {
      const all = Array.from(store.verifications.values());
      if (!args?.where) return all;
      return all.filter((v) => {
        if (args.where?.status && v.status !== args.where.status) return false;
        if (args.where?.userId && v.userId !== args.where.userId) return false;
        return true;
      });
    },
    findUnique: async ({ where }: { where: { id: string } }) => {
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
    findUnique: async ({ where }: { where: { userId: string } }) => {
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
      const existing = store.preferences.get(where.userId);
      if (existing) {
        const updated = { ...existing, ...update, updatedAt: new Date() };
        store.preferences.set(where.userId, updated);
        return updated;
      }
      const newPref: MatchingPreference = {
        id: `pref-${Date.now()}`,
        ...create,
        updatedAt: new Date(),
      };
      store.preferences.set(where.userId, newPref);
      return newPref;
    },
  },

  matchQueue: {
    findUnique: async ({ where }: { where: { userId: string } }) => {
      return store.matchQueue.get(where.userId) || null;
    },
    findMany: async (args?: { where?: { status?: string } }) => {
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
      const existing = store.matchQueue.get(where.userId);
      if (existing) {
        const updated = { ...existing, ...update };
        store.matchQueue.set(where.userId, updated);
        return updated;
      }
      const entry: MatchQueueEntry = {
        id: `queue-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        ...create,
        joinedAt: new Date(),
      };
      store.matchQueue.set(where.userId, entry);
      return entry;
    },
    delete: async ({ where }: { where: { userId: string } }) => {
      return store.matchQueue.delete(where.userId);
    },
    update: async ({ where, data }: { where: { userId: string }; data: Partial<MatchQueueEntry> }) => {
      const existing = store.matchQueue.get(where.userId);
      if (!existing) return null;
      const updated = { ...existing, ...data };
      store.matchQueue.set(where.userId, updated);
      return updated;
    },
  },

  conversation: {
    findUnique: async ({ where }: { where: { id: string } }) => {
      return store.conversations.get(where.id) || null;
    },
    findMany: async (args?: { where?: { status?: string } }) => {
      const all = Array.from(store.conversations.values());
      if (args?.where?.status) {
        return all.filter((c) => c.status === args.where!.status);
      }
      return all;
    },
    create: async ({ data }: { data: Omit<Conversation, 'id' | 'startedAt'> & { id?: string } }) => {
      const id = data.id || `conv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const conv: Conversation = {
        id,
        ...data,
        startedAt: new Date(),
      };
      store.conversations.set(id, conv);
      return conv;
    },
    update: async ({ where, data }: { where: { id: string }; data: Partial<Conversation> }) => {
      const existing = store.conversations.get(where.id);
      if (!existing) throw new Error(`Conversation ${where.id} not found`);
      const updated = { ...existing, ...data };
      store.conversations.set(where.id, updated);
      return updated;
    },
  },

  conversationParticipant: {
    findMany: async ({ where }: { where: { userId?: string; conversationId?: string } }) => {
      const all = Array.from(store.conversationParticipants.values());
      return all.filter((p) => {
        if (where.userId && p.userId !== where.userId) return false;
        if (where.conversationId && p.conversationId !== where.conversationId) return false;
        return true;
      });
    },
    findFirst: async ({ where }: { where: { userId: string; conversationId: string } }) => {
      return Array.from(store.conversationParticipants.values()).find(
        (p) => p.userId === where.userId && p.conversationId === where.conversationId
      ) || null;
    },
    create: async ({ data }: { data: Omit<ConversationParticipant, 'id' | 'joinedAt'> }) => {
      const id = `part-${data.conversationId}-${data.userId}`;
      const part: ConversationParticipant = {
        id,
        ...data,
        joinedAt: new Date(),
      };
      store.conversationParticipants.set(id, part);
      return part;
    },
    update: async ({
      where,
      data,
    }: {
      where: { conversationId_userId: { conversationId: string; userId: string } };
      data: Partial<ConversationParticipant>;
    }) => {
      const id = `part-${where.conversationId_userId.conversationId}-${where.conversationId_userId.userId}`;
      const existing = store.conversationParticipants.get(id);
      if (!existing) return null;
      const updated = { ...existing, ...data };
      store.conversationParticipants.set(id, updated);
      return updated;
    },
  },

  message: {
    findMany: async ({ where, orderBy }: { where: { conversationId: string }; orderBy?: { createdAt: 'asc' | 'desc' } }) => {
      const msgs = Array.from(store.messages.values()).filter((m) => m.conversationId === where.conversationId);
      if (orderBy?.createdAt === 'desc') {
        return msgs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      }
      return msgs.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    },
    create: async ({ data }: { data: Omit<Message, 'id' | 'createdAt'> }) => {
      const id = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const msg: Message = {
        id,
        ...data,
        createdAt: new Date(),
      };
      store.messages.set(id, msg);
      return msg;
    },
  },

  creditPackage: {
    findMany: async (args?: { where?: { isActive?: boolean } }) => {
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
      return store.creditBalances.get(where.userId) || { id: `bal-${where.userId}`, userId: where.userId, credits: 0, updatedAt: new Date() };
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

      const bal: UserCreditBalance = {
        id: existing?.id || `bal-${where.userId}`,
        userId: where.userId,
        credits: Math.max(0, currentCredits),
        updatedAt: new Date(),
      };
      store.creditBalances.set(where.userId, bal);
      return bal;
    },
  },

  creditLedger: {
    findMany: async ({ where, orderBy }: { where: { userId: string }; orderBy?: { createdAt: 'desc' } }) => {
      const all = Array.from(store.creditLedgers.values()).filter((l) => l.userId === where.userId);
      return all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    },
    create: async ({ data }: { data: Omit<CreditLedgerEntry, 'id' | 'createdAt'> }) => {
      const id = `ledger-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const entry: CreditLedgerEntry = {
        id,
        ...data,
        createdAt: new Date(),
      };
      store.creditLedgers.set(id, entry);
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
    findMany: async (args?: { where?: { userId?: string } }) => {
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
    findUnique: async ({ where }: { where: { razorpayPaymentId?: string; orderId?: string } }) => {
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
    findUnique: async ({ where }: { where: { blockerId_blockedId: { blockerId: string; blockedId: string } } }) => {
      const key = `${where.blockerId_blockedId.blockerId}_${where.blockerId_blockedId.blockedId}`;
      return store.blocks.get(key) || null;
    },
    findMany: async ({ where }: { where: { blockerId?: string; blockedId?: string } }) => {
      const all = Array.from(store.blocks.values());
      return all.filter((b) => {
        if (where.blockerId && b.blockerId !== where.blockerId) return false;
        if (where.blockedId && b.blockedId !== where.blockedId) return false;
        return true;
      });
    },
    create: async ({ data }: { data: Omit<Block, 'id' | 'createdAt'> }) => {
      const key = `${data.blockerId}_${data.blockedId}`;
      const block: Block = {
        id: `blk-${Date.now()}`,
        ...data,
        createdAt: new Date(),
      };
      store.blocks.set(key, block);
      return block;
    },
    delete: async ({ where }: { where: { blockerId_blockedId: { blockerId: string; blockedId: string } } }) => {
      const key = `${where.blockerId_blockedId.blockerId}_${where.blockerId_blockedId.blockedId}`;
      return store.blocks.delete(key);
    },
  },

  abuseReport: {
    findMany: async (args?: { where?: { status?: string } }) => {
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
    findMany: async () => {
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
};

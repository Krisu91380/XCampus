export type UserRole = 'USER' | 'VERIFIED_STUDENT' | 'MODERATOR' | 'ADMIN';
export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'BANNED';
export type Gender = 'MALE' | 'FEMALE' | 'NON_BINARY' | 'OTHER' | 'PREFER_NOT_TO_SAY';
export type PartnerPreference = 'BOYS' | 'GIRLS' | 'EVERYONE';
export type VerificationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type MatchStatus = 'WAITING' | 'MATCHED' | 'CANCELLED' | 'EXPIRED';
export type ConversationStatus = 'ACTIVE' | 'ENDED';
export type OrderStatus = 'CREATED' | 'PENDING_VERIFICATION' | 'PAID' | 'FAILED' | 'REJECTED' | 'REFUNDED' | 'CANCELLED';
export type AbuseReportReason =
  | 'HARASSMENT'
  | 'INAPPROPRIATE_CONTENT'
  | 'UNDERAGE'
  | 'SPAM'
  | 'IMPERSONATION'
  | 'OTHER';
export type AbuseReportStatus = 'PENDING' | 'INVESTIGATING' | 'RESOLVED' | 'DISMISSED';

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  status: UserStatus;
  isAgeVerified: boolean;
  dateOfBirth?: string | Date | null;
  universityId?: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  deletedAt?: string | Date | null;
}

export interface Profile {
  id: string;
  userId: string;
  displayName: string;
  gender: Gender;
  avatarUrl?: string | null;
  bio?: string | null;
  course?: string | null;
  branch?: string | null;
  academicYear?: string | null;
  semester?: string | null;
  language: string;
  interests: string[]; // parsed tags
  skills?: string[];
  socialLinks?: {
    github?: string;
    linkedin?: string;
    instagram?: string;
    twitter?: string;
    website?: string;
  };
  isOnline: boolean;
  isDiscoverable: boolean;
  lastSeenAt: string | Date;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface University {
  id: string;
  name: string;
  code: string;
  city: string;
  state: string;
  country: string;
  approvedDomains: string[];
  isActive: boolean;
  logoUrl?: string | null;
  verificationRequirements: string;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface StudentVerification {
  id: string;
  userId: string;
  universityId: string;
  institutionalEmail?: string | null;
  idCardUrl?: string | null;
  documentType: 'INSTITUTION_EMAIL' | 'ID_CARD' | 'ADMISSION_LETTER';
  status: VerificationStatus;
  rejectionReason?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: string | Date | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface MatchingPreference {
  id: string;
  userId: string;
  targetUniversityId?: string | null; // null for any
  preferredPartnerGender: PartnerPreference;
  preferredLanguage?: string | null;
  preferredCourse?: string | null;
  preferredYear?: string | null;
  randomMatch: boolean;
  updatedAt: string | Date;
}

export interface MatchQueueEntry {
  id: string;
  userId: string;
  universityId: string;
  targetUniversityId?: string | null;
  userGender: Gender;
  preferredPartnerGender: PartnerPreference;
  language?: string | null;
  course?: string | null;
  joinedAt: string | Date;
  expiresAt: string | Date;
  status: MatchStatus;
  matchedConversationId?: string | null;
  matchedPartnerId?: string | null;
}

export interface Conversation {
  id: string;
  status: ConversationStatus;
  startedAt: string | Date;
  endedAt?: string | Date | null;
  endedByUserId?: string | null;
  endReason?: string | null;
  creditDeducted: boolean;
}

export interface ConversationParticipant {
  id: string;
  conversationId: string;
  userId: string;
  joinedAt: string | Date;
  leftAt?: string | Date | null;
  hasUnread: boolean;
  hidden?: boolean;
  clearedAt?: string | Date | null;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  isRead: boolean;
  createdAt: string | Date;
}

export interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  priceInInr: number;
  description: string;
  isPopular: boolean;
  isActive: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface UserCreditBalance {
  id: string;
  userId: string;
  credits: number;
  updatedAt: string | Date;
}

export interface CreditLedgerEntry {
  id: string;
  userId: string;
  change: number;
  balanceAfter: number;
  reason: 'PURCHASE' | 'CONVERSATION_DEDUCTION' | 'REFUND' | 'SIGNUP_BONUS' | 'ADMIN_ADJUSTMENT';
  referenceId?: string | null;
  metadata?: string | null;
  createdAt: string | Date;
}

export interface PaymentOrder {
  id: string;
  userId: string;
  packageId: string;
  razorpayOrderId: string;
  amountInPaise: number;
  currency: string;
  status: OrderStatus;
  idempotencyKey: string;
  utrNumber?: string | null;
  receiptUrl?: string | null;
  verifiedBy?: string | null;
  verifiedAt?: string | Date | null;
  rejectionReason?: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface PaymentTransaction {
  id: string;
  orderId: string;
  userId: string;
  razorpayPaymentId: string;
  razorpaySignature?: string | null;
  amountInPaise: number;
  status: 'SUCCESS' | 'FAILED';
  rawResponse?: string | null;
  verifiedAt: string | Date;
}

export interface Block {
  id: string;
  blockerId: string;
  blockedId: string;
  createdAt: string | Date;
}

export interface AbuseReport {
  id: string;
  reporterId: string;
  reportedUserId: string;
  conversationId?: string | null;
  reason: AbuseReportReason;
  details: string;
  status: AbuseReportStatus;
  resolutionNotes?: string | null;
  resolvedBy?: string | null;
  resolvedAt?: string | Date | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface AdminAuditLog {
  id: string;
  adminId: string;
  action: string;
  targetType: string;
  targetId?: string | null;
  details?: string | null;
  ipAddress?: string | null;
  createdAt: string | Date;
}

export interface AuthenticatedUserSession {
  userId: string;
  email: string;
  role: UserRole;
  isAgeVerified: boolean;
  universityId?: string | null;
  displayName: string;
}

export type FriendRequestStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED';

export interface FriendRequest {
  id: string;
  senderId: string;
  receiverId: string;
  status: FriendRequestStatus;
  createdAt: string | Date;
  updatedAt: string | Date;
}

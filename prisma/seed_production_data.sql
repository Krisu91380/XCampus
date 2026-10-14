-- ==============================================================================
-- CAMPUSCONNECT: SEED PRODUCTION DATA INTO SUPABASE POSTGRESQL
-- IDEMPOTENT: Uses ON CONFLICT DO NOTHING so no existing or newer data is replaced
-- ==============================================================================

-- 1. Universities
INSERT INTO "University" ("id", "name", "code", "city", "state", "country", "approvedDomains", "isActive", "logoUrl", "verificationRequirements", "createdAt", "updatedAt")
VALUES ('uni-1', 'Lovely Professional University', 'LPU', 'Phagwara', 'Punjab', 'India', '["lpu.in","lpu.co.in"]', TRUE, NULL, 'Official @lpu.in email address or valid physical Student ID card', '2026-10-13T18:31:18.739Z', '2026-10-13T18:31:18.739Z')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "University" ("id", "name", "code", "city", "state", "country", "approvedDomains", "isActive", "logoUrl", "verificationRequirements", "createdAt", "updatedAt")
VALUES ('uni-2', 'Delhi University', 'DU', 'New Delhi', 'Delhi', 'India', '["du.ac.in"]', TRUE, NULL, 'University Roll Number and official college email or Student ID', '2026-10-13T18:31:18.741Z', '2026-10-13T18:31:18.741Z')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "University" ("id", "name", "code", "city", "state", "country", "approvedDomains", "isActive", "logoUrl", "verificationRequirements", "createdAt", "updatedAt")
VALUES ('uni-3', 'Vellore Institute of Technology', 'VIT', 'Vellore', 'Tamil Nadu', 'India', '["vitstudent.ac.in","vit.ac.in"]', TRUE, NULL, 'Official @vitstudent.ac.in student ID or VTOP profile snapshot', '2026-10-13T18:31:18.744Z', '2026-10-13T18:31:18.744Z')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "University" ("id", "name", "code", "city", "state", "country", "approvedDomains", "isActive", "logoUrl", "verificationRequirements", "createdAt", "updatedAt")
VALUES ('uni-4', 'Birla Institute of Technology and Science', 'BITS', 'Pilani', 'Rajasthan', 'India', '["pilani.bits-pilani.ac.in","hyderabad.bits-pilani.ac.in","goa.bits-pilani.ac.in"]', TRUE, NULL, 'Official BITS email account verification', '2026-10-13T18:31:18.747Z', '2026-10-13T18:31:18.747Z')
ON CONFLICT ("code") DO NOTHING;

-- 2. Users
INSERT INTO "User" ("id", "email", "passwordHash", "role", "status", "isAgeVerified", "dateOfBirth", "universityId", "createdAt", "updatedAt")
VALUES ('user-admin-1', 'admin@campusconnect.edu', '$2a$10$6l4Lpp0kS0C.PDN9IXYVD.6CVluJcGNVT/RUtRUXCnrQYB0ZMy.Mm', 'ADMIN', 'ACTIVE', TRUE, '1998-01-15T00:00:00.000Z', 'uni-1', '2026-10-13T11:51:06.631Z', '2026-10-13T11:51:06.631Z')
ON CONFLICT ("email") DO NOTHING;

INSERT INTO "User" ("id", "email", "passwordHash", "role", "status", "isAgeVerified", "dateOfBirth", "universityId", "createdAt", "updatedAt")
VALUES ('user-student-1', 'aarav.sharma@lpu.in', '$2a$10$xJV0lMh9mPR5Qa2ewqtD9Os6ybFMTnYHnjibbEFwT8Qk5JKb53Vam', 'VERIFIED_STUDENT', 'ACTIVE', TRUE, '2003-05-10T00:00:00.000Z', 'uni-1', '2026-10-13T11:51:06.797Z', '2026-10-13T11:51:06.797Z')
ON CONFLICT ("email") DO NOTHING;

INSERT INTO "User" ("id", "email", "passwordHash", "role", "status", "isAgeVerified", "dateOfBirth", "universityId", "createdAt", "updatedAt")
VALUES ('user-student-2', 'priya.patel@lpu.in', '$2a$10$xJV0lMh9mPR5Qa2ewqtD9Os6ybFMTnYHnjibbEFwT8Qk5JKb53Vam', 'VERIFIED_STUDENT', 'ACTIVE', TRUE, '2003-05-10T00:00:00.000Z', 'uni-1', '2026-10-13T11:51:06.832Z', '2026-10-13T11:51:06.832Z')
ON CONFLICT ("email") DO NOTHING;

INSERT INTO "User" ("id", "email", "passwordHash", "role", "status", "isAgeVerified", "dateOfBirth", "universityId", "createdAt", "updatedAt")
VALUES ('user-student-3', 'rohan.verma@du.ac.in', '$2a$10$xJV0lMh9mPR5Qa2ewqtD9Os6ybFMTnYHnjibbEFwT8Qk5JKb53Vam', 'VERIFIED_STUDENT', 'ACTIVE', TRUE, '2003-05-10T00:00:00.000Z', 'uni-2', '2026-10-13T11:51:06.851Z', '2026-10-13T11:51:06.851Z')
ON CONFLICT ("email") DO NOTHING;

INSERT INTO "User" ("id", "email", "passwordHash", "role", "status", "isAgeVerified", "dateOfBirth", "universityId", "createdAt", "updatedAt")
VALUES ('user-student-4', 'ananya.iyer@vitstudent.ac.in', '$2a$10$xJV0lMh9mPR5Qa2ewqtD9Os6ybFMTnYHnjibbEFwT8Qk5JKb53Vam', 'VERIFIED_STUDENT', 'ACTIVE', TRUE, '2003-05-10T00:00:00.000Z', 'uni-3', '2026-10-13T11:51:06.867Z', '2026-10-13T11:51:06.867Z')
ON CONFLICT ("email") DO NOTHING;

INSERT INTO "User" ("id", "email", "passwordHash", "role", "status", "isAgeVerified", "dateOfBirth", "universityId", "createdAt", "updatedAt")
VALUES ('user-student-krish', 'krishbarak@lpu.in', '$2a$10$xJV0lMh9mPR5Qa2ewqtD9Os6ybFMTnYHnjibbEFwT8Qk5JKb53Vam', 'VERIFIED_STUDENT', 'ACTIVE', TRUE, '2003-05-10T00:00:00.000Z', 'uni-1', '2026-10-13T14:29:50.418Z', '2026-10-13T14:29:50.418Z')
ON CONFLICT ("email") DO NOTHING;

-- 3. Profiles
INSERT INTO "Profile" ("id", "userId", "displayName", "gender", "avatarUrl", "bio", "course", "academicYear", "language", "interests", "isOnline", "isDiscoverable", "lastSeenAt", "createdAt", "updatedAt")
VALUES ('profile-admin-1', 'user-admin-1', 'System Admin', 'PREFER_NOT_TO_SAY', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150', 'CampusConnect Platform Administrator', 'Administration', 'Staff', 'English', '["Security","Community","Technology"]', TRUE, FALSE, '2026-10-13T18:31:36.296Z', '2026-10-13T11:51:06.637Z', '2026-10-13T18:31:36.296Z')
ON CONFLICT ("userId") DO NOTHING;

INSERT INTO "Profile" ("id", "userId", "displayName", "gender", "avatarUrl", "bio", "course", "academicYear", "language", "interests", "isOnline", "isDiscoverable", "lastSeenAt", "createdAt", "updatedAt")
VALUES ('profile-user-student-1', 'user-student-1', 'Aarav Sharma', 'MALE', 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=200', 'Tech enthusiast, competitive coder, exploring distributed systems and hackathons.', 'B.Tech Computer Science & Engg', '3rd Year', 'English', '["Coding","AI / ML","Gaming","Hackathons"]', TRUE, TRUE, '2026-10-13T11:51:06.803Z', '2026-10-13T11:51:06.803Z', '2026-10-13T11:51:06.803Z')
ON CONFLICT ("userId") DO NOTHING;

INSERT INTO "Profile" ("id", "userId", "displayName", "gender", "avatarUrl", "bio", "course", "academicYear", "language", "interests", "isOnline", "isDiscoverable", "lastSeenAt", "createdAt", "updatedAt")
VALUES ('profile-user-student-2', 'user-student-2', 'Priya Patel', 'FEMALE', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200', 'Passionate about digital branding, product design, and university debates.', 'MBA Marketing', '1st Year', 'English', '["Marketing","Design","Music","Debate"]', TRUE, TRUE, '2026-10-13T11:51:06.836Z', '2026-10-13T11:51:06.836Z', '2026-10-13T11:51:06.836Z')
ON CONFLICT ("userId") DO NOTHING;

INSERT INTO "Profile" ("id", "userId", "displayName", "gender", "avatarUrl", "bio", "course", "academicYear", "language", "interests", "isOnline", "isDiscoverable", "lastSeenAt", "createdAt", "updatedAt")
VALUES ('profile-user-student-3', 'user-student-3', 'Rohan Verma', 'MALE', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200', 'Economics enthusiast from St. Stephen’s. Keen on finance, geopolitical trends, and photography.', 'BA (Hons) Economics', '2nd Year', 'English', '["Economics","Finance","Photography","Podcasts"]', TRUE, TRUE, '2026-10-13T11:51:06.854Z', '2026-10-13T11:51:06.854Z', '2026-10-13T11:51:06.854Z')
ON CONFLICT ("userId") DO NOTHING;

INSERT INTO "Profile" ("id", "userId", "displayName", "gender", "avatarUrl", "bio", "course", "academicYear", "language", "interests", "isOnline", "isDiscoverable", "lastSeenAt", "createdAt", "updatedAt")
VALUES ('profile-user-student-4', 'user-student-4', 'Ananya Iyer', 'FEMALE', 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200', 'Senior research fellow in computational biology. Love indie music and badminton.', 'B.Tech Biotechnology', '4th Year', 'English', '["Biotech","Research","Badminton","Indie Music"]', TRUE, TRUE, '2026-10-13T11:51:06.875Z', '2026-10-13T11:51:06.875Z', '2026-10-13T11:51:06.875Z')
ON CONFLICT ("userId") DO NOTHING;

INSERT INTO "Profile" ("id", "userId", "displayName", "gender", "avatarUrl", "bio", "course", "academicYear", "language", "interests", "isOnline", "isDiscoverable", "lastSeenAt", "createdAt", "updatedAt")
VALUES ('profile-user-student-krish', 'user-student-krish', 'Krish Barak', 'MALE', 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=200', 'LPU Student | Computer Science & Engineering', 'B.Tech Computer Science & Engg', '3rd Year', 'English', '["Coding","AI / ML","Web Development","Campus Life"]', TRUE, TRUE, '2026-10-13T14:29:50.418Z', '2026-10-13T14:29:50.418Z', '2026-10-13T14:29:50.418Z')
ON CONFLICT ("userId") DO NOTHING;

-- 4. Credit Packages
INSERT INTO "CreditPackage" ("id", "name", "credits", "priceInInr", "description", "isPopular", "isActive", "createdAt", "updatedAt")
VALUES ('pkg-1', 'Campus Explorer', 5, 29, '5 Conversation credits. Great starter pack for new connections.', FALSE, TRUE, '2026-10-13T18:31:18.749Z', '2026-10-13T18:31:18.749Z')
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "CreditPackage" ("id", "name", "credits", "priceInInr", "description", "isPopular", "isActive", "createdAt", "updatedAt")
VALUES ('pkg-2', 'Semester Connector', 15, 79, '15 Conversation credits. Best value for active students (₹5.2/chat).', TRUE, TRUE, '2026-10-13T18:31:18.751Z', '2026-10-13T18:31:18.751Z')
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "CreditPackage" ("id", "name", "credits", "priceInInr", "description", "isPopular", "isActive", "createdAt", "updatedAt")
VALUES ('pkg-3', 'Campus Ultimate', 35, 149, '35 Conversation credits. Maximum value across campus networks (₹4.2/chat).', FALSE, TRUE, '2026-10-13T18:31:18.753Z', '2026-10-13T18:31:18.753Z')
ON CONFLICT ("id") DO NOTHING;

-- 5. User Credit Balances
INSERT INTO "UserCreditBalance" ("id", "userId", "credits", "updatedAt")
VALUES ('bal-admin-1', 'user-admin-1', 999, '2026-10-13T11:51:06.639Z')
ON CONFLICT ("userId") DO NOTHING;

INSERT INTO "UserCreditBalance" ("id", "userId", "credits", "updatedAt")
VALUES ('bal-user-student-1', 'user-student-1', 5, '2026-10-13T11:51:06.814Z')
ON CONFLICT ("userId") DO NOTHING;

INSERT INTO "UserCreditBalance" ("id", "userId", "credits", "updatedAt")
VALUES ('bal-user-student-2', 'user-student-2', 8, '2026-10-13T11:51:06.840Z')
ON CONFLICT ("userId") DO NOTHING;

INSERT INTO "UserCreditBalance" ("id", "userId", "credits", "updatedAt")
VALUES ('bal-user-student-3', 'user-student-3', 3, '2026-10-13T11:51:06.858Z')
ON CONFLICT ("userId") DO NOTHING;

INSERT INTO "UserCreditBalance" ("id", "userId", "credits", "updatedAt")
VALUES ('bal-user-student-4', 'user-student-4', 4, '2026-10-13T11:51:06.877Z')
ON CONFLICT ("userId") DO NOTHING;

INSERT INTO "UserCreditBalance" ("id", "userId", "credits", "updatedAt")
VALUES ('bal-user-student-krish', 'user-student-krish', 5, '2026-10-13T14:29:50.418Z')
ON CONFLICT ("userId") DO NOTHING;

-- 6. Conversations
INSERT INTO "Conversation" ("id", "status", "startedAt", "endedAt", "endedByUserId", "endReason", "creditDeducted")
VALUES ('conv_user-student-1__user-student-krish__5f26ba590eb70a6f', 'ACTIVE', '2026-10-12T10:05:00.000Z', NULL, NULL, NULL, TRUE)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "Conversation" ("id", "status", "startedAt", "endedAt", "endedByUserId", "endReason", "creditDeducted")
VALUES ('conv_user-student-2__user-student-krish__693362988835865e', 'ACTIVE', '2026-10-12T10:05:00.000Z', NULL, NULL, NULL, TRUE)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "Conversation" ("id", "status", "startedAt", "endedAt", "endedByUserId", "endReason", "creditDeducted")
VALUES ('conv_user-student-1__user-student-2__2793898ef75c35e1', 'ACTIVE', '2026-10-12T10:05:00.000Z', NULL, NULL, NULL, TRUE)
ON CONFLICT ("id") DO NOTHING;

-- 7. Conversation Participants
INSERT INTO "ConversationParticipant" ("id", "conversationId", "userId", "joinedAt", "leftAt", "hasUnread")
VALUES ('part-conv_user-student-1__user-student-krish__5f26ba590eb70a6f-user-student-1', 'conv_user-student-1__user-student-krish__5f26ba590eb70a6f', 'user-student-1', '2026-10-12T10:05:00.000Z', NULL, FALSE)
ON CONFLICT ("conversationId", "userId") DO NOTHING;

INSERT INTO "ConversationParticipant" ("id", "conversationId", "userId", "joinedAt", "leftAt", "hasUnread")
VALUES ('part-conv_user-student-1__user-student-krish__5f26ba590eb70a6f-user-student-krish', 'conv_user-student-1__user-student-krish__5f26ba590eb70a6f', 'user-student-krish', '2026-10-12T10:05:00.000Z', NULL, FALSE)
ON CONFLICT ("conversationId", "userId") DO NOTHING;

INSERT INTO "ConversationParticipant" ("id", "conversationId", "userId", "joinedAt", "leftAt", "hasUnread")
VALUES ('part-conv_user-student-2__user-student-krish__693362988835865e-user-student-2', 'conv_user-student-2__user-student-krish__693362988835865e', 'user-student-2', '2026-10-12T10:05:00.000Z', NULL, FALSE)
ON CONFLICT ("conversationId", "userId") DO NOTHING;

INSERT INTO "ConversationParticipant" ("id", "conversationId", "userId", "joinedAt", "leftAt", "hasUnread")
VALUES ('part-conv_user-student-2__user-student-krish__693362988835865e-user-student-krish', 'conv_user-student-2__user-student-krish__693362988835865e', 'user-student-krish', '2026-10-12T10:05:00.000Z', NULL, FALSE)
ON CONFLICT ("conversationId", "userId") DO NOTHING;

INSERT INTO "ConversationParticipant" ("id", "conversationId", "userId", "joinedAt", "leftAt", "hasUnread")
VALUES ('part-conv_user-student-1__user-student-2__2793898ef75c35e1-user-student-1', 'conv_user-student-1__user-student-2__2793898ef75c35e1', 'user-student-1', '2026-10-12T10:05:00.000Z', NULL, FALSE)
ON CONFLICT ("conversationId", "userId") DO NOTHING;

INSERT INTO "ConversationParticipant" ("id", "conversationId", "userId", "joinedAt", "leftAt", "hasUnread")
VALUES ('part-conv_user-student-1__user-student-2__2793898ef75c35e1-user-student-2', 'conv_user-student-1__user-student-2__2793898ef75c35e1', 'user-student-2', '2026-10-12T10:05:00.000Z', NULL, FALSE)
ON CONFLICT ("conversationId", "userId") DO NOTHING;

-- 8. Messages
INSERT INTO "Message" ("id", "conversationId", "senderId", "content", "isRead", "createdAt")
VALUES ('msg-fr-krish-aarav-init', 'conv_user-student-1__user-student-krish__5f26ba590eb70a6f', 'user-student-1', 'Hey Krish! Great connecting on CampusConnect.', TRUE, '2026-10-12T10:06:00.000Z')
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "Message" ("id", "conversationId", "senderId", "content", "isRead", "createdAt")
VALUES ('msg-fr-krish-priya-init', 'conv_user-student-2__user-student-krish__693362988835865e', 'user-student-2', 'Hi Krish! Welcome to CampusConnect. Looking forward to collaborating on campus projects.', TRUE, '2026-10-12T10:06:00.000Z')
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "Message" ("id", "conversationId", "senderId", "content", "isRead", "createdAt")
VALUES ('msg-fr-aarav-priya-init', 'conv_user-student-1__user-student-2__2793898ef75c35e1', 'user-student-1', 'Hey Priya, let us discuss the tech symposium next week!', TRUE, '2026-10-12T10:06:00.000Z')
ON CONFLICT ("id") DO NOTHING;

-- 9. Friend Requests
INSERT INTO "FriendRequest" ("id", "senderId", "receiverId", "status", "createdAt", "updatedAt")
VALUES ('fr-krish-aarav', 'user-student-1', 'user-student-krish', 'ACCEPTED', '2026-10-12T10:00:00.000Z', '2026-10-12T10:05:00.000Z')
ON CONFLICT ("senderId", "receiverId") DO NOTHING;

INSERT INTO "FriendRequest" ("id", "senderId", "receiverId", "status", "createdAt", "updatedAt")
VALUES ('fr-krish-priya', 'user-student-2', 'user-student-krish', 'ACCEPTED', '2026-10-12T10:00:00.000Z', '2026-10-12T10:05:00.000Z')
ON CONFLICT ("senderId", "receiverId") DO NOTHING;

INSERT INTO "FriendRequest" ("id", "senderId", "receiverId", "status", "createdAt", "updatedAt")
VALUES ('fr-aarav-priya', 'user-student-1', 'user-student-2', 'ACCEPTED', '2026-10-12T10:00:00.000Z', '2026-10-12T10:05:00.000Z')
ON CONFLICT ("senderId", "receiverId") DO NOTHING;


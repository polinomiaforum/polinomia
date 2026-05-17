import { pgTable, text, integer, serial, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  username: text('username').notNull(),
  email: text('email').notNull(),
  passwordHash: text('password_hash'),
  googleId: text('google_id'),
  avatarUrl: text('avatar_url'),
  bio: text('bio'),
  declaredView: text('declared_view'),
  role: text('role').notNull().default('user'),
  suspendedUntil: timestamp('suspended_until', { withTimezone: true }),
  reportsDisabledUntil: timestamp('reports_disabled_until', { withTimezone: true }),
  expelledAt: timestamp('expelled_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  usernameIdx: uniqueIndex('users_username_idx').on(t.username),
  emailIdx: uniqueIndex('users_email_idx').on(t.email),
  googleIdx: uniqueIndex('users_google_id_idx').on(t.googleId),
}));

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
}, (t) => ({
  userIdx: index('sessions_user_idx').on(t.userId),
}));

export const topics = pgTable('topics', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  sortOrder: integer('sort_order').notNull().default(0),
}, (t) => ({
  slugIdx: uniqueIndex('topics_slug_idx').on(t.slug),
}));

export const countries = pgTable('countries', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull(),
  name: text('name').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
}, (t) => ({
  slugIdx: uniqueIndex('countries_slug_idx').on(t.slug),
}));

export const threads = pgTable('threads', {
  id: serial('id').primaryKey(),
  topicId: integer('topic_id').notNull().references(() => topics.id, { onDelete: 'restrict' }),
  countryId: integer('country_id').notNull().references(() => countries.id, { onDelete: 'restrict' }),
  authorId: text('author_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  title: text('title').notNull(),
  slug: text('slug').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  lastActivityAt: timestamp('last_activity_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  topicIdx: index('threads_topic_idx').on(t.topicId),
  countryIdx: index('threads_country_idx').on(t.countryId),
  activityIdx: index('threads_activity_idx').on(sql`${t.lastActivityAt} DESC`),
  slugIdx: index('threads_slug_idx').on(t.slug),
}));

export const posts = pgTable('posts', {
  id: serial('id').primaryKey(),
  threadId: integer('thread_id').notNull().references(() => threads.id, { onDelete: 'cascade' }),
  authorId: text('author_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  body: text('body').notNull(),
  isOpening: integer('is_opening').notNull().default(0),
  hiddenAt: timestamp('hidden_at', { withTimezone: true }),
  hiddenReason: text('hidden_reason'),
  needsReformulation: integer('needs_reformulation').notNull().default(0),
  reformulateDueAt: timestamp('reformulate_due_at', { withTimezone: true }),
  editedAt: timestamp('edited_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  threadIdx: index('posts_thread_idx').on(t.threadId, t.createdAt),
  authorIdx: index('posts_author_idx').on(t.authorId),
}));

export const sources = pgTable('sources', {
  id: serial('id').primaryKey(),
  postId: integer('post_id').notNull().references(() => posts.id, { onDelete: 'cascade' }),
  threadId: integer('thread_id').notNull().references(() => threads.id, { onDelete: 'cascade' }),
  url: text('url'),
  citation: text('citation').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  postIdx: index('sources_post_idx').on(t.postId),
  threadIdx: index('sources_thread_idx').on(t.threadId),
}));

export const reports = pgTable('reports', {
  id: serial('id').primaryKey(),
  postId: integer('post_id').notNull().references(() => posts.id, { onDelete: 'cascade' }),
  threadId: integer('thread_id').notNull().references(() => threads.id, { onDelete: 'cascade' }),
  reporterId: text('reporter_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  reportedUserId: text('reported_user_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  ruleNumber: integer('rule_number').notNull(),
  context: text('context').notNull(),
  status: text('status').notNull().default('pending'),
  resolution: text('resolution'),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  resolvedById: text('resolved_by_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  statusIdx: index('reports_status_idx').on(t.status, t.createdAt),
  postIdx: index('reports_post_idx').on(t.postId),
  reporterIdx: index('reports_reporter_idx').on(t.reporterId, t.createdAt),
  reportedIdx: index('reports_reported_idx').on(t.reportedUserId, t.createdAt),
}));

export const sanctions = pgTable('sanctions', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  reportId: integer('report_id').references(() => reports.id, { onDelete: 'set null' }),
  postId: integer('post_id').references(() => posts.id, { onDelete: 'set null' }),
  type: text('type').notNull(),
  reason: text('reason').notNull(),
  ruleNumber: integer('rule_number'),
  appliedById: text('applied_by_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  appliedAt: timestamp('applied_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
}, (t) => ({
  userIdx: index('sanctions_user_idx').on(t.userId, t.appliedAt),
  typeIdx: index('sanctions_type_idx').on(t.type, t.appliedAt),
}));

export const authTokens = pgTable('auth_tokens', {
  id: text('id').primaryKey(),
  tokenHash: text('token_hash').notNull(),
  email: text('email').notNull(),
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
  purpose: text('purpose').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  hashIdx: uniqueIndex('auth_tokens_hash_idx').on(t.tokenHash),
  emailIdx: index('auth_tokens_email_idx').on(t.email),
}));

export const passkeys = pgTable('passkeys', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  credentialId: text('credential_id').notNull(),
  publicKey: text('public_key').notNull(),
  counter: integer('counter').notNull().default(0),
  transports: text('transports'),
  deviceName: text('device_name'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
}, (t) => ({
  credentialIdx: uniqueIndex('passkeys_credential_id_idx').on(t.credentialId),
  userIdx: index('passkeys_user_idx').on(t.userId),
}));

export const webauthnChallenges = pgTable('webauthn_challenges', {
  id: text('id').primaryKey(),
  challenge: text('challenge').notNull(),
  userId: text('user_id'),
  purpose: text('purpose').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
});

export const verdicts = pgTable('verdicts', {
  id: serial('id').primaryKey(),
  reportId: integer('report_id').notNull().references(() => reports.id, { onDelete: 'cascade' }),
  ruleNumber: integer('rule_number').notNull(),
  decision: text('decision').notNull(),
  rationale: text('rationale').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  createdIdx: index('verdicts_created_idx').on(sql`${t.createdAt} DESC`),
}));

export const usersRelations = relations(users, ({ many }) => ({
  threads: many(threads),
  posts: many(posts),
  sessions: many(sessions),
}));

export const topicsRelations = relations(topics, ({ many }) => ({
  threads: many(threads),
}));

export const countriesRelations = relations(countries, ({ many }) => ({
  threads: many(threads),
}));

export const threadsRelations = relations(threads, ({ one, many }) => ({
  topic: one(topics, { fields: [threads.topicId], references: [topics.id] }),
  country: one(countries, { fields: [threads.countryId], references: [countries.id] }),
  author: one(users, { fields: [threads.authorId], references: [users.id] }),
  posts: many(posts),
  sources: many(sources),
}));

export const postsRelations = relations(posts, ({ one, many }) => ({
  thread: one(threads, { fields: [posts.threadId], references: [threads.id] }),
  author: one(users, { fields: [posts.authorId], references: [users.id] }),
  sources: many(sources),
}));

export const sourcesRelations = relations(sources, ({ one }) => ({
  post: one(posts, { fields: [sources.postId], references: [posts.id] }),
  thread: one(threads, { fields: [sources.threadId], references: [threads.id] }),
}));

export type User = typeof users.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Topic = typeof topics.$inferSelect;
export type Country = typeof countries.$inferSelect;
export type Thread = typeof threads.$inferSelect;
export type Post = typeof posts.$inferSelect;
export type Source = typeof sources.$inferSelect;
export type Report = typeof reports.$inferSelect;
export type Sanction = typeof sanctions.$inferSelect;
export type Verdict = typeof verdicts.$inferSelect;
export type AuthToken = typeof authTokens.$inferSelect;
export type Passkey = typeof passkeys.$inferSelect;

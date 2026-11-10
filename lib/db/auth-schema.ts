// Better Auth tables (sign-in, sessions, the MCP authorization server).
// Keys are the model names Better Auth expects; tables are snake_case plurals
// and columns become snake_case through drizzle's casing option.
import {
  pgTable,
  unique,
  uuid,
  text,
  boolean,
  timestamp,
  index,
  foreignKey,
  jsonb,
  uniqueIndex,
  integer,
} from "drizzle-orm/pg-core"

export const user = pgTable(
  "users",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    name: text().notNull(),
    email: text().notNull(),
    emailVerified: boolean().notNull(),
    image: text(),
    createdAt: timestamp({ withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp({ withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    username: text(),
  },
  (table) => [unique().on(table.email)]
)

export const session = pgTable(
  "sessions",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    expiresAt: timestamp({ withTimezone: true, mode: "date" }).notNull(),
    token: text().notNull(),
    createdAt: timestamp({ withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp({ withTimezone: true, mode: "date" }).notNull(),
    ipAddress: text(),
    userAgent: text(),
    userId: uuid().notNull(),
  },
  (table) => [
    index().using("btree", table.userId),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
    }).onDelete("cascade"),
    unique().on(table.token),
  ]
)

export const account = pgTable(
  "accounts",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    accountId: text().notNull(),
    providerId: text().notNull(),
    userId: uuid().notNull(),
    accessToken: text(),
    refreshToken: text(),
    idToken: text(),
    accessTokenExpiresAt: timestamp({ withTimezone: true, mode: "date" }),
    refreshTokenExpiresAt: timestamp({ withTimezone: true, mode: "date" }),
    scope: text(),
    password: text(),
    createdAt: timestamp({ withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp({ withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [
    index().using("btree", table.userId),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
    }).onDelete("cascade"),
  ]
)

// Text ids here and on oauth_client_assertions: the replay stores for DPoP
// proofs and client assertions use a hash of the proof as the id, and the
// check only works if that id is kept.
export const verification = pgTable(
  "verifications",
  {
    id: text().primaryKey().notNull(),
    identifier: text().notNull(),
    value: text().notNull(),
    expiresAt: timestamp({ withTimezone: true, mode: "date" }).notNull(),
    createdAt: timestamp({ withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp({ withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [index().using("btree", table.identifier)]
)

export const jwks = pgTable("jwks", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  publicKey: text().notNull(),
  privateKey: text().notNull(),
  createdAt: timestamp({ withTimezone: true, mode: "date" }).notNull(),
  expiresAt: timestamp({ withTimezone: true, mode: "date" }),
  alg: text(),
  crv: text(),
})

export const oauthClient = pgTable(
  "oauth_clients",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    clientId: text().notNull(),
    clientSecret: text(),
    clientDiscoveryId: text(),
    disabled: boolean(),
    skipConsent: boolean(),
    enableEndSession: boolean(),
    subjectType: text(),
    scopes: jsonb(),
    clientCredentialsScopes: jsonb(),
    userId: uuid(),
    createdAt: timestamp({ withTimezone: true, mode: "date" }),
    updatedAt: timestamp({ withTimezone: true, mode: "date" }),
    name: text(),
    uri: text(),
    icon: text(),
    contacts: jsonb(),
    tos: text(),
    policy: text(),
    softwareId: text(),
    softwareVersion: text(),
    softwareStatement: text(),
    redirectUris: jsonb().notNull(),
    postLogoutRedirectUris: jsonb(),
    backchannelLogoutUri: text(),
    backchannelLogoutSessionRequired: boolean(),
    tokenEndpointAuthMethod: text(),
    applicationType: text(),
    jwks: text(),
    jwksUri: text(),
    grantTypes: jsonb(),
    responseTypes: jsonb(),
    requirePKCE: boolean("require_pkce"),
    dpopBoundAccessTokens: boolean(),
    referenceId: text(),
    metadata: jsonb(),
  },
  (table) => [
    index().using("btree", table.userId),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
    }).onDelete("cascade"),
    unique().on(table.clientId),
  ]
)

export const oauthClientResource = pgTable(
  "oauth_client_resources",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    clientId: text().notNull(),
    resourceId: text().notNull(),
    metadata: jsonb(),
    createdAt: timestamp({ withTimezone: true, mode: "date" }),
  },
  (table) => [
    index().using("btree", table.clientId),
    uniqueIndex().using("btree", table.clientId, table.resourceId),
    index().using("btree", table.resourceId),
    foreignKey({
      columns: [table.clientId],
      foreignColumns: [oauthClient.clientId],
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.resourceId],
      foreignColumns: [oauthResource.identifier],
    }).onDelete("cascade"),
  ]
)

export const oauthResource = pgTable(
  "oauth_resources",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    identifier: text().notNull(),
    name: text().notNull(),
    accessTokenTtl: integer(),
    refreshTokenTtl: integer(),
    signingAlgorithm: text(),
    signingKeyId: text(),
    allowedScopes: jsonb(),
    customClaims: jsonb(),
    dpopBoundAccessTokensRequired: boolean(),
    disabled: boolean(),
    createdAt: timestamp({ withTimezone: true, mode: "date" }),
    updatedAt: timestamp({ withTimezone: true, mode: "date" }),
    policyVersion: integer(),
    metadata: jsonb(),
  },
  (table) => [unique().on(table.identifier)]
)

export const oauthRefreshToken = pgTable(
  "oauth_refresh_tokens",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    token: text().notNull(),
    clientId: text().notNull(),
    sessionId: uuid(),
    userId: uuid().notNull(),
    referenceId: text(),
    authorizationCodeId: text(),
    resources: jsonb(),
    requestedUserInfoClaims: jsonb(),
    expiresAt: timestamp({ withTimezone: true, mode: "date" }).notNull(),
    createdAt: timestamp({ withTimezone: true, mode: "date" }).notNull(),
    revoked: timestamp({ withTimezone: true, mode: "date" }),
    rotatedAt: timestamp({ withTimezone: true, mode: "date" }),
    rotationReplayResponse: text(),
    rotationReplayExpiresAt: timestamp({ withTimezone: true, mode: "date" }),
    authTime: timestamp({ withTimezone: true, mode: "date" }),
    confirmation: jsonb(),
    scopes: jsonb().notNull(),
  },
  (table) => [
    index().using("btree", table.authorizationCodeId),
    index().using("btree", table.clientId),
    index().using("btree", table.sessionId),
    index().using("btree", table.userId),
    foreignKey({
      columns: [table.clientId],
      foreignColumns: [oauthClient.clientId],
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.sessionId],
      foreignColumns: [session.id],
    }).onDelete("set null"),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
    }).onDelete("cascade"),
    unique().on(table.token),
  ]
)

export const oauthClientAssertion = pgTable("oauth_client_assertions", {
  id: text().primaryKey().notNull(),
  expiresAt: timestamp({ withTimezone: true, mode: "date" }).notNull(),
})

export const oauthAccessToken = pgTable(
  "oauth_access_tokens",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    token: text().notNull(),
    clientId: text().notNull(),
    sessionId: uuid(),
    userId: uuid(),
    referenceId: text(),
    authorizationCodeId: text(),
    resources: jsonb(),
    requestedUserInfoClaims: jsonb(),
    refreshId: uuid(),
    expiresAt: timestamp({ withTimezone: true, mode: "date" }).notNull(),
    createdAt: timestamp({ withTimezone: true, mode: "date" }).notNull(),
    revoked: timestamp({ withTimezone: true, mode: "date" }),
    confirmation: jsonb(),
    scopes: jsonb().notNull(),
  },
  (table) => [
    index().using("btree", table.authorizationCodeId),
    index().using("btree", table.clientId),
    index().using("btree", table.refreshId),
    index().using("btree", table.sessionId),
    index().using("btree", table.userId),
    foreignKey({
      columns: [table.clientId],
      foreignColumns: [oauthClient.clientId],
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.sessionId],
      foreignColumns: [session.id],
    }).onDelete("set null"),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.refreshId],
      foreignColumns: [oauthRefreshToken.id],
    }).onDelete("cascade"),
    unique().on(table.token),
  ]
)

export const oauthConsent = pgTable(
  "oauth_consents",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    clientId: text().notNull(),
    userId: uuid(),
    referenceId: text(),
    resources: jsonb(),
    requestedUserInfoClaims: jsonb(),
    scopes: jsonb().notNull(),
    createdAt: timestamp({ withTimezone: true, mode: "date" }).notNull(),
    updatedAt: timestamp({ withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [
    index().using("btree", table.clientId),
    index().using("btree", table.userId),
    foreignKey({
      columns: [table.clientId],
      foreignColumns: [oauthClient.clientId],
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
    }).onDelete("cascade"),
  ]
)

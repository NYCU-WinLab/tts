import { cimd } from "@better-auth/cimd"
import { fetchClientMetadataResource } from "@better-auth/cimd/node"
import { mcp } from "@better-auth/mcp"
import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { nextCookies } from "better-auth/next-js"
import { genericOAuth, jwt } from "better-auth/plugins"

import { db } from "@/lib/db"
import * as schema from "@/lib/db/schema"

// Required at run time. next build imports this module to collect routes,
// so only that phase gets a placeholder.
const baseURL =
  process.env.BETTER_AUTH_URL ??
  (process.env.NEXT_PHASE === "phase-production-build"
    ? "http://localhost:3000"
    : undefined)
if (!baseURL) throw new Error("BETTER_AUTH_URL is not set")

/** The MCP endpoint, as clients request it and tokens carry it in aud. */
export const mcpResource = new URL("/mcp", baseURL).toString()

// Keycloak (auth.winlab.tw, realm winlab) is the only way in: there are no
// passwords here. TTS is also the OAuth 2.1 authorization server for
// MCP clients, so a lab-wide Keycloak never has to open client registration.
export const auth = betterAuth({
  baseURL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: "pg", schema }),
  // A function, not "uuid": with "uuid" the adapter swaps out ids Better
  // Auth sets on purpose (replay-store keys), and replay checks never fire.
  advanced: { database: { generateId: () => crypto.randomUUID() } },
  emailAndPassword: { enabled: false },
  // Name, email and username come only from Keycloak, on every sign-in.
  disabledPaths: ["/update-user", "/change-email"],
  // Keycloak is the only way in, so a new Keycloak account is a new member
  // even if it reuses an email: never merge it into an existing one.
  account: { accountLinking: { disableImplicitLinking: true } },
  user: {
    additionalFields: {
      // Keycloak preferred_username: the lab account name, e.g. "zyx1121".
      // Not input: false, which also drops it from the mapped profile.
      username: { type: "string", required: false },
    },
  },
  session: { cookieCache: { enabled: true, maxAge: 5 * 60 } },
  plugins: [
    genericOAuth({
      config: [
        {
          providerId: "keycloak",
          clientId: process.env.KEYCLOAK_CLIENT_ID!,
          clientSecret: process.env.KEYCLOAK_CLIENT_SECRET!,
          discoveryUrl: `${process.env.KEYCLOAK_ISSUER}/.well-known/openid-configuration`,
          // Keycloak 22+ rejects more; profile and email come back anyway.
          scopes: ["openid"],
          requireIdTokenVerification: true,
          // Runs on every sign-in, so a name changed in Keycloak follows.
          mapProfileToUser: (profile) => ({
            name:
              String(profile.chinese_name ?? "").trim() ||
              String(profile.name ?? "").trim() ||
              String(profile.preferred_username ?? ""),
            email: profile.email as string,
            emailVerified: Boolean(profile.email_verified),
            username: profile.preferred_username as string | undefined,
          }),
          overrideUserInfo: true,
        },
      ],
    }),
    jwt(),
    mcp({
      resource: mcpResource,
      loginPage: "/sign-in",
      consentPage: "/consent",
      scopes: ["openid", "profile", "email", "offline_access"],
      // CIMD is the 2026-07-28 way; DCR stays for clients that predate it.
      allowDynamicClientRegistration: true,
      allowUnauthenticatedClientRegistration: true,
    }),
    cimd({ fetchClientMetadataResource, metadataProfile: "mcp-2026-07-28" }),
    nextCookies(),
  ],
})

export type Session = typeof auth.$Infer.Session

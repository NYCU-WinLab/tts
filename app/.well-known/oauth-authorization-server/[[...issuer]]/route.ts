import { oauthProviderAuthServerMetadata } from "@better-auth/oauth-provider"

import { auth } from "@/lib/auth"

// RFC 8414 metadata. The issuer is /api/auth, so clients ask for
// /.well-known/oauth-authorization-server/api/auth; the bare path also works.
export const GET = oauthProviderAuthServerMetadata(auth)

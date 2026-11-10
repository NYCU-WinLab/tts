import { oauthProviderClient } from "@better-auth/oauth-provider/client"
import { createAuthClient } from "better-auth/react"

// oauthProviderClient forwards the signed oauth_query of an MCP
// authorization through sign-in and consent, so the flow resumes by itself.
export const authClient = createAuthClient({
  plugins: [oauthProviderClient()],
})

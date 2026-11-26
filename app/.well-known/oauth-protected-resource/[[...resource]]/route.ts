import { mcpResource } from "@/lib/auth"

// RFC 9728 metadata for /mcp. Keycloak (realm winlab) is the authorization
// server: MCP clients sign in there with the public client tts-mcp, which
// the lab plugin presets, and Keycloak's registration stays closed.
// offline_access keeps a client signed in past Keycloak's idle timeout.
export const GET = () =>
  Response.json(
    {
      resource: mcpResource,
      authorization_servers: [process.env.KEYCLOAK_ISSUER],
      scopes_supported: ["openid", "offline_access"],
      bearer_methods_supported: ["header"],
      resource_name: "WinLab TTS",
    },
    { headers: { "cache-control": "public, max-age=300" } }
  )

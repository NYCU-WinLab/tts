import { auth } from "@/lib/auth"

// RFC 9728 metadata for /mcp. The mcp() plugin answers this path itself
// when handed the request; it lives at the site root, outside /api/auth.
export const GET = (request: Request) => auth.handler(request)

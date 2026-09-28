import { UnauthorizedException } from '@nestjs/common'

// Authentication middleware owns this value. The challenge module never trusts a client header or body.
export interface AuthenticatedRequest {
  user?: { id?: unknown }
}

export function requireCurrentUserId(request: AuthenticatedRequest): string {
  const id = request.user?.id
  if (typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    throw new UnauthorizedException('Authentication required')
  }
  return id
}

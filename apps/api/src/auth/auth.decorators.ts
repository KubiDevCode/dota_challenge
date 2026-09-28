import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common'
import type { CurrentUser } from './auth.types'

export const ROLES_KEY = 'required-roles'
export const Roles = (...roles: Array<'USER' | 'ADMIN'>) => SetMetadata(ROLES_KEY, roles)

export const AuthenticatedUser = createParamDecorator((_data: unknown, context: ExecutionContext): CurrentUser => {
  return context.switchToHttp().getRequest<{ currentUser: CurrentUser }>().currentUser
})

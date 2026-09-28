import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { Request } from 'express'
import { ROLES_KEY } from './auth.decorators'
import type { CurrentUser } from './auth.types'
import { toCurrentUser, UsersService } from '../users/users.service'

interface AuthenticatedRequest extends Request { currentUser?: CurrentUser }

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly users: UsersService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>()
    const userId = request.session?.userId
    if (!userId) throw new UnauthorizedException('Authentication required')
    const user = await this.users.findById(userId)
    if (!user) {
      delete request.session.userId
      throw new UnauthorizedException('Authentication required')
    }
    request.currentUser = toCurrentUser(user)
    return true
  }
}

@Injectable()
export class RoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Array<'USER' | 'ADMIN'>>(ROLES_KEY, [
      context.getHandler(), context.getClass(),
    ])
    if (!roles?.length) return true
    const user = context.switchToHttp().getRequest<AuthenticatedRequest>().currentUser
    if (!user) throw new UnauthorizedException('Authentication required')
    if (!roles.includes(user.role)) throw new ForbiddenException('Insufficient role')
    return true
  }
}

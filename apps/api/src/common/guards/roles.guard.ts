import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators';
import { UserRole } from '../constants';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const { user } = context.switchToHttp().getRequest();
    if (!user) throw new ForbiddenException('Authentication required');

    // SUPER_ADMIN can do everything ADMIN can.
    if (user.role === UserRole.SUPER_ADMIN && required.includes(UserRole.ADMIN)) return true;
    if (!required.includes(user.role)) {
      throw new ForbiddenException('Insufficient permissions for this action');
    }
    return true;
  }
}

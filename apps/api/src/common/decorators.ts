import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { UserRole } from './constants';

export const IS_PUBLIC_KEY = 'isPublic';
/** Marks a route as accessible without a JWT (guest browsing, auth endpoints). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const ALLOW_INACTIVE_RIDER_KEY = 'allowInactiveRider';
/** Permit an existing pending rider to read only their own account status. */
export const AllowInactiveRider = () => SetMetadata(ALLOW_INACTIVE_RIDER_KEY, true);

export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

export interface AuthUser {
  userId: string;
  role: UserRole;
  sessionId?: string;
}

/** Injects the decoded JWT payload ({ userId, role }) into a handler param. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser | undefined => {
    const req = ctx.switchToHttp().getRequest();
    return req.user;
  },
);

/** Injects the x-guest-session header value (guest cart/session flows). */
export const GuestToken = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | undefined => {
    const req = ctx.switchToHttp().getRequest();
    return req.headers['x-guest-session'] as string | undefined;
  },
);

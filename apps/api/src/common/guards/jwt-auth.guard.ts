import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { IS_PUBLIC_KEY } from '../decorators';
import { PrismaService } from '../../prisma/prisma.service';
import { UserRole } from '../constants';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const token = this.extractToken(req);

    // Always decode the token when present so @Public routes can personalize.
    if (token) {
      try {
        const payload = await this.jwtService.verifyAsync(token);
        const user = await this.prisma.user.findUnique({
          where: { id: payload.sub },
          select: {
            id: true, role: true, status: true,
            customer: { select: { id: true } },
            merchant: { select: { id: true } },
            staffOf: { where: { status: 'ACTIVE' }, select: { id: true, merchant: { select: { user: { select: { status: true } } } } } },
            rider: { select: { id: true, isActive: true, approvalStatus: true } },
          },
        });
        const session = typeof payload.sid === 'string'
          ? await this.prisma.refreshToken.findFirst({
              where: { id: payload.sid, userId: payload.sub, revokedAt: null, expiresAt: { gt: new Date() } },
              select: { role: true },
            })
          : undefined;
        const role = payload.role as UserRole;
        const member = user?.status === 'ACTIVE' && (
          (role === UserRole.CUSTOMER && !!user.customer) ||
          (role === UserRole.MERCHANT_OWNER && !!user.merchant) ||
          (role === UserRole.MERCHANT_STAFF && user.staffOf.some((staff) => staff.merchant.user.status === 'ACTIVE')) ||
          (role === UserRole.RIDER && !!user.rider && user.rider.isActive) ||
          ([UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.SUPPORT_AGENT, UserRole.FINANCE_ADMIN] as UserRole[]).includes(role) && user.role === role
        );
        if (member && user && (payload.sid === undefined || session?.role === role)) {
          req.user = { userId: user.id, role, sessionId: payload.sid };
        } else {
          req.user = undefined;
        }
      } catch {
        req.user = undefined;
      }
    }

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    if (!req.user) throw new UnauthorizedException('Authentication required');
    return true;
  }

  private extractToken(req: any): string | undefined {
    const header = req.headers['authorization'];
    if (typeof header === 'string' && header.startsWith('Bearer ')) return header.slice(7);
    return undefined;
  }
}

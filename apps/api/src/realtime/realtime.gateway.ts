import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';
import { ADMIN_ROLES, StaffPermission, UserRole } from '../common/constants';
import { audienceAllowed, NotificationAudience } from '../notifications/notification-audience';

/**
 * Socket.IO rooms:
 *   user:<userId>      personal notifications
 *   order:<orderId>    live order status + rider location (customer tracking)
 *   merchant:<id>      new orders / order updates for a shop
 *   rider:<riderId>    assignments for a rider
 *   admin              platform-wide live monitoring
 *
 * Clients authenticate with `auth: { token }` in the Socket.IO handshake.
 */
@WebSocketGateway({ cors: { origin: true, credentials: true } })
export class RealtimeGateway implements OnGatewayConnection {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  handleConnection(client: Socket) {
    // Join messages can arrive while asynchronous JWT verification is running.
    // Every room handler waits for this promise before reading the identity.
    client.data.authReady = this.authenticate(client);
    return client.data.authReady;
  }

  private async authenticate(client: Socket) {
    const token = client.handshake.auth?.token || client.handshake.query?.token;
    if (typeof token === 'string' && token) {
      try {
        const payload = await this.jwtService.verifyAsync(token);
        const user = await this.prisma.user.findUnique({ where: { id: payload.sub }, select: { role: true, status: true, customer: { select: { id: true } }, merchant: { select: { id: true } }, staffOf: { where: { status: 'ACTIVE', merchant: { user: { status: 'ACTIVE' } } }, select: { id: true } }, rider: { select: { id: true, isActive: true, approvalStatus: true } } } });
        if (!user || user.status !== 'ACTIVE') return;
        const role = payload.role as UserRole;
        const member = role === UserRole.CUSTOMER ? !!user.customer
          : role === UserRole.MERCHANT_OWNER ? !!user.merchant
          : role === UserRole.MERCHANT_STAFF ? user.staffOf.length > 0
          : role === UserRole.RIDER ? !!user.rider?.isActive && user.rider.approvalStatus === 'APPROVED'
          : ADMIN_ROLES.includes(role) && user.role === role;
        if (!member) return;
        if (payload.sid) {
          const session = await this.prisma.refreshToken.findFirst({ where: { id: payload.sid, userId: payload.sub, role, revokedAt: null, expiresAt: { gt: new Date() } } });
          if (!session) return;
        }
        client.data.userId = payload.sub;
        client.data.role = role;
        client.data.sessionId = payload.sid;
        client.join(`user:${payload.sub}`);
        if (ADMIN_ROLES.includes(payload.role)) client.join('admin');
      } catch {
        // Unauthenticated sockets stay connected but can only join nothing.
      }
    }
  }

  private async current(client: Socket) {
    const { userId, sessionId, role } = client.data;
    if (!userId) return false;
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: {
      role: true, status: true, customer: { select: { id: true } }, merchant: { select: { id: true } },
      staffOf: { where: { status: 'ACTIVE', merchant: { user: { status: 'ACTIVE' } } }, select: { id: true } }, rider: { select: { id: true, isActive: true, approvalStatus: true } },
    } });
    const member = role === UserRole.CUSTOMER ? !!user?.customer
      : role === UserRole.MERCHANT_OWNER ? !!user?.merchant
      : role === UserRole.MERCHANT_STAFF ? !!user?.staffOf.length
      : role === UserRole.RIDER ? !!user?.rider?.isActive && user.rider.approvalStatus === 'APPROVED'
      : ADMIN_ROLES.includes(role) && user?.role === role;
    if (user?.status !== 'ACTIVE' || !member) {
      client.disconnect(true);
      return false;
    }
    if (sessionId) {
      const session = await this.prisma.refreshToken.findFirst({ where: { id: sessionId, userId, role, revokedAt: null, expiresAt: { gt: new Date() } } });
      if (!session) {
        client.disconnect(true);
        return false;
      }
    }
    return true;
  }

  /** Recheck every subscriber before each emission; joining once is not permanent authorization. */
  async emitAuthorized(room: string, event: string, data: unknown) {
    if (!this.server) return;
    const subscribers = await this.server.in(room).fetchSockets();
    // Bound simultaneous database work for high-fanout order/merchant events.
    for (let index = 0; index < subscribers.length; index += 8) {
      await Promise.all(subscribers.slice(index, index + 8).map(async (client) => {
        try {
          if (!(await this.current(client as unknown as Socket))) return;
          if (!(await this.authorizedForRoom(client as unknown as Socket, room))) {
            client.leave(room);
            return;
          }
          if (event === 'notification') {
            const item = data as { audience?: NotificationAudience; scopeId?: string; type?: string };
            if (!item?.audience || !item.scopeId || !item.type || !(await audienceAllowed(this.prisma, { userId: client.data.userId, role: client.data.role, sessionId: client.data.sessionId }, { audience: item.audience, scopeId: item.scopeId, baseType: item.type }))) return;
          }
          this.server.to(client.id).emit(event, data);
        } catch {
          // A failed authorization query must never turn into a broadcast.
        }
      }));
    }
  }

  private async authorizedForRoom(client: Socket, room: string) {
    const { userId, role } = client.data;
    if (room === 'admin') return ADMIN_ROLES.includes(role);
    if (room.startsWith('user:')) return room.slice(5) === userId;
    if (room.startsWith('merchant:')) {
      const merchantId = room.slice(9);
      if (ADMIN_ROLES.includes(role)) return true;
      if (role === UserRole.MERCHANT_OWNER) return !!(await this.prisma.merchant.findFirst({ where: { id: merchantId, userId }, select: { id: true } }));
      if (role === UserRole.MERCHANT_STAFF) return this.staffCanReadOrders(merchantId, userId);
      return false;
    }
    if (room.startsWith('rider:')) {
      if (ADMIN_ROLES.includes(role)) return true;
      return role === UserRole.RIDER && !!(await this.prisma.rider.findFirst({ where: { id: room.slice(6), userId, isActive: true, approvalStatus: 'APPROVED' }, select: { id: true } }));
    }
    if (room.startsWith('order:')) {
      if (ADMIN_ROLES.includes(role)) return true;
      const order = await this.prisma.order.findUnique({ where: { id: room.slice(6) }, select: {
        customer: { select: { userId: true } }, merchantId: true,
        merchant: { select: { userId: true } }, rider: { select: { userId: true, isActive: true } },
      } });
      if (!order) return false;
      if (role === UserRole.CUSTOMER) return order.customer?.userId === userId;
      if (role === UserRole.MERCHANT_OWNER) return order.merchant?.userId === userId;
      if (role === UserRole.RIDER) return order.rider?.userId === userId && order.rider?.isActive === true;
      if (role === UserRole.MERCHANT_STAFF && order.merchantId) return this.staffCanReadOrders(order.merchantId, userId);
    }
    return false;
  }

  private async staffCanReadOrders(merchantId: string, userId: string) {
    const staff = await this.prisma.merchantStaff.findFirst({
      where: { merchantId, userId, status: 'ACTIVE', merchant: { user: { status: 'ACTIVE' } } },
      select: { permissions: true },
    });
    if (!staff) return false;
    try {
      const permissions: unknown = JSON.parse(staff.permissions);
      return Array.isArray(permissions) && permissions.includes(StaffPermission.ORDERS);
    } catch { return false; }
  }

  @SubscribeMessage('join:order')
  async joinOrder(@ConnectedSocket() client: Socket, @MessageBody() body: { orderId: string }) {
    await client.data.authReady;
    const { userId } = client.data;
    if (!userId || !body?.orderId || !(await this.current(client))) return { ok: false };
    if (!(await this.authorizedForRoom(client, `order:${body.orderId}`))) return { ok: false };

    client.join(`order:${body.orderId}`);
    return { ok: true };
  }

  @SubscribeMessage('join:merchant')
  async joinMerchant(@ConnectedSocket() client: Socket, @MessageBody() body: { merchantId: string }) {
    await client.data.authReady;
    const { userId } = client.data;
    if (!userId || !body?.merchantId || !(await this.current(client))) return { ok: false };
    if (!(await this.authorizedForRoom(client, `merchant:${body.merchantId}`))) return { ok: false };
    client.join(`merchant:${body.merchantId}`);
    return { ok: true };
  }

  @SubscribeMessage('join:rider')
  async joinRider(@ConnectedSocket() client: Socket, @MessageBody() body: { riderId: string }) {
    await client.data.authReady;
    const { userId, role } = client.data;
    if (!userId || !body?.riderId || !(await this.current(client))) return { ok: false };

    if (role !== UserRole.RIDER && !ADMIN_ROLES.includes(role)) return { ok: false };
    if (role === UserRole.RIDER) {
      const rider = await this.prisma.rider.findUnique({
        where: { id: body.riderId },
        select: { userId: true },
      });
      if (rider?.userId !== userId) return { ok: false };
    }
    client.join(`rider:${body.riderId}`);
    return { ok: true };
  }
}

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
import { ADMIN_ROLES, UserRole } from '../common/constants';

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

  async handleConnection(client: Socket) {
    const token = client.handshake.auth?.token || client.handshake.query?.token;
    if (typeof token === 'string' && token) {
      try {
        const payload = await this.jwtService.verifyAsync(token);
        client.data.userId = payload.sub;
        client.data.role = payload.role;
        client.join(`user:${payload.sub}`);
        if (ADMIN_ROLES.includes(payload.role)) client.join('admin');
      } catch {
        // Unauthenticated sockets stay connected but can only join nothing.
      }
    }
  }

  @SubscribeMessage('join:order')
  async joinOrder(@ConnectedSocket() client: Socket, @MessageBody() body: { orderId: string }) {
    const { userId, role } = client.data;
    if (!userId || !body?.orderId) return { ok: false };

    const order = await this.prisma.order.findUnique({
      where: { id: body.orderId },
      select: {
        customerId: true,
        merchantId: true,
        riderId: true,
        customer: { select: { userId: true } },
        merchant: { select: { userId: true } },
        rider: { select: { userId: true } },
      },
    });
    if (!order) return { ok: false };

    const allowed =
      ADMIN_ROLES.includes(role) ||
      order.customer?.userId === userId ||
      order.merchant?.userId === userId ||
      order.rider?.userId === userId;
    if (!allowed) return { ok: false };

    client.join(`order:${body.orderId}`);
    return { ok: true };
  }

  @SubscribeMessage('join:merchant')
  async joinMerchant(@ConnectedSocket() client: Socket, @MessageBody() body: { merchantId: string }) {
    const { userId, role } = client.data;
    if (!userId || !body?.merchantId) return { ok: false };

    if (!ADMIN_ROLES.includes(role)) {
      const merchant = await this.prisma.merchant.findUnique({
        where: { id: body.merchantId },
        select: { userId: true, staff: { select: { userId: true, status: true } } },
      });
      const isOwner = merchant?.userId === userId;
      const isStaff = merchant?.staff.some((s) => s.userId === userId && s.status === 'ACTIVE');
      if (!isOwner && !isStaff) return { ok: false };
    }
    client.join(`merchant:${body.merchantId}`);
    return { ok: true };
  }

  @SubscribeMessage('join:rider')
  async joinRider(@ConnectedSocket() client: Socket, @MessageBody() body: { riderId: string }) {
    const { userId, role } = client.data;
    if (!userId || !body?.riderId) return { ok: false };

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

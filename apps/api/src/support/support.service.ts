import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService } from '../common/access.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RealtimeService } from '../realtime/realtime.service';
import { ADMIN_ROLES, NotificationType, TicketStatus, UserRole } from '../common/constants';
import { parsePage, paged, PageQuery } from '../common/utils/pagination';

@Injectable()
export class SupportService {
  private readonly logger = new Logger(SupportService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly notifications: NotificationsService,
    private readonly realtime: RealtimeService,
  ) {}

  private async participantAudience(ticket: {
    customerId?: string | null; merchantId?: string | null; riderId?: string | null;
    createdByUserId: string; issueCategory: string;
  }) {
    const associations = [ticket.customerId, ticket.merchantId, ticket.riderId].filter(Boolean).length;
    // RiderService creates these mixed-association tickets with a server-owned
    // category. The order's customer/merchant are context, not the recipient.
    if (ticket.issueCategory === 'RIDER_ISSUE' && ticket.riderId) {
      const rider = await this.prisma.rider.findFirst({
        where: { id: ticket.riderId, userId: ticket.createdByUserId }, select: { id: true },
      });
      return rider ? { audience: 'RIDER' as const, scopeId: rider.id } : null;
    }
    // Other mixed-association legacy tickets have no trustworthy creator-role
    // provenance. Do not guess based on customer/merchant/rider column order.
    if (associations > 1) return null;
    if (ticket.customerId) {
      const customer = await this.prisma.customer.findFirst({
        where: { id: ticket.customerId, userId: ticket.createdByUserId }, select: { id: true },
      });
      return customer ? { audience: 'CUSTOMER' as const, scopeId: ticket.createdByUserId } : null;
    }
    if (ticket.merchantId) {
      const [owner, staff] = await Promise.all([
        this.prisma.merchant.findFirst({ where: { id: ticket.merchantId, userId: ticket.createdByUserId }, select: { id: true } }),
        this.prisma.merchantStaff.findFirst({ where: { merchantId: ticket.merchantId, userId: ticket.createdByUserId, status: 'ACTIVE' }, select: { id: true } }),
      ]);
      return owner || staff ? { audience: 'MERCHANT' as const, scopeId: ticket.merchantId } : null;
    }
    if (ticket.riderId) {
      const rider = await this.prisma.rider.findFirst({
        where: { id: ticket.riderId, userId: ticket.createdByUserId }, select: { id: true },
      });
      return rider ? { audience: 'RIDER' as const, scopeId: rider.id } : null;
    }
    // Association-free tickets can only address their creator's account.
    return { audience: 'ACCOUNT' as const, scopeId: ticket.createdByUserId };
  }

  private async safeParticipantAudience(ticket: Parameters<SupportService['participantAudience']>[0]) {
    try { return await this.participantAudience(ticket); }
    catch {
      // The ticket write has already succeeded. Do not turn a notification
      // lookup outage into a failed reply/status response or widen its audience.
      this.logger.warn('Support notification audience could not be resolved');
      return null;
    }
  }

  // ── User-facing ────────────────────────────────────────────────────────────

  async create(
    userId: string,
    role: string,
    input: { orderId?: string; issueCategory: string; title: string; description: string },
  ) {
    let customerId: string | null = null;
    let merchantId: string | null = null;
    let riderId: string | null = null;

    if (role === UserRole.CUSTOMER) {
      customerId = (await this.prisma.customer.findUnique({ where: { userId } }))?.id ?? null;
    } else if (role === UserRole.MERCHANT_OWNER || role === UserRole.MERCHANT_STAFF) {
      merchantId = (await this.access.merchantContext(userId)).merchantId;
    } else if (role === UserRole.RIDER) {
      riderId = (await this.access.riderByUser(userId)).id;
    }

    if (input.orderId) {
      const order = await this.prisma.order.findUnique({ where: { id: input.orderId } });
      if (!order) throw new NotFoundException('Order not found');
      if (role === UserRole.CUSTOMER && (!customerId || order.customerId !== customerId)) throw new ForbiddenException('Not your order');
      if ((role === UserRole.MERCHANT_OWNER || role === UserRole.MERCHANT_STAFF) && (!merchantId || order.merchantId !== merchantId)) throw new ForbiddenException('Not your shop order');
      if (role === UserRole.RIDER && (!riderId || order.riderId !== riderId)) throw new ForbiddenException('Order is not assigned to you');
    }

    const ticket = await this.prisma.supportTicket.create({
      data: {
        orderId: input.orderId ?? null,
        customerId,
        merchantId,
        riderId,
        createdByUserId: userId,
        issueCategory: input.issueCategory,
        title: input.title,
        description: input.description,
      },
    });
    this.realtime.emitToAdmins('support:new', { ticketId: ticket.id, orderId: input.orderId });
    return ticket;
  }

  async listOwn(userId: string) {
    return this.prisma.supportTicket.findMany({
      where: { createdByUserId: userId },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });
  }

  async getForUser(userId: string, role: string, ticketId: string) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        order: { select: { id: true, orderNumber: true, status: true } },
      },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    if (!ADMIN_ROLES.includes(role as any) && ticket.createdByUserId !== userId) {
      throw new ForbiddenException('Not your ticket');
    }
    return ticket;
  }

  async addMessage(userId: string, role: string, ticketId: string, message: string) {
    const ticket = await this.getForUser(userId, role, ticketId);
    const isAdmin = ADMIN_ROLES.includes(role as any);

    const row = await this.prisma.supportTicketMessage.create({
      data: { ticketId: ticket.id, senderUserId: userId, senderRole: role, message },
    });

    if (isAdmin) {
      if (ticket.status === TicketStatus.OPEN) {
        await this.prisma.supportTicket.update({
          where: { id: ticket.id },
          data: { status: TicketStatus.IN_REVIEW },
        });
      }
      const audience = await this.safeParticipantAudience(ticket);
      if (audience) await this.notifications.notify({
        userId: ticket.createdByUserId,
        ...audience,
        title: 'Support replied',
        body: message.slice(0, 140),
        type: NotificationType.SUPPORT_REPLY,
        referenceId: ticket.id,
      });
    } else if (ticket.assignedToAdminId) {
      const admin = await this.prisma.user.findUnique({ where: { id: ticket.assignedToAdminId }, select: { role: true } });
      if (!admin || !ADMIN_ROLES.includes(admin.role as UserRole)) return row;
      await this.notifications.notify({
        userId: ticket.assignedToAdminId,
        audience: 'ADMIN', scopeId: admin.role,
        title: `Ticket update: ${ticket.title}`,
        body: message.slice(0, 140),
        type: NotificationType.SUPPORT_REPLY,
        referenceId: ticket.id,
      });
    }
    return row;
  }

  // ── Admin ──────────────────────────────────────────────────────────────────

  async adminList(query: PageQuery & { status?: string }) {
    const { page, pageSize, skip, take } = parsePage(query);
    const where = query.status ? { status: query.status } : {};
    const [rows, total] = await Promise.all([
      this.prisma.supportTicket.findMany({
        where,
        include: {
          order: { select: { orderNumber: true } },
          customer: { select: { user: { select: { fullName: true, phoneNumber: true } } } },
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.supportTicket.count({ where }),
    ]);
    return paged(rows, total, page, pageSize);
  }

  async adminUpdate(
    adminUserId: string,
    ticketId: string,
    input: { status?: string; priority?: string; assignedToAdminId?: string },
  ) {
    const ticket = await this.prisma.supportTicket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException('Ticket not found');

    const updated = await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        status: input.status ?? undefined,
        priority: input.priority ?? undefined,
        assignedToAdminId: input.assignedToAdminId ?? undefined,
        resolvedAt: input.status === TicketStatus.RESOLVED ? new Date() : undefined,
      },
    });
    if (input.status && input.status !== ticket.status) {
      const audience = await this.safeParticipantAudience(ticket);
      if (audience) await this.notifications.notify({
        userId: ticket.createdByUserId,
        ...audience,
        title: 'Support ticket update',
        body: `Your ticket "${ticket.title}" is now ${input.status.replace(/_/g, ' ').toLowerCase()}.`,
        type: NotificationType.SUPPORT_REPLY,
        referenceId: ticket.id,
      });
    }
    return updated;
  }
}

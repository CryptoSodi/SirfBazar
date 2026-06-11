import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RealtimeService } from '../realtime/realtime.service';
import { ADMIN_ROLES, NotificationType, TicketStatus, UserRole } from '../common/constants';
import { parsePage, paged, PageQuery } from '../common/utils/pagination';

@Injectable()
export class SupportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly realtime: RealtimeService,
  ) {}

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
      merchantId =
        (await this.prisma.merchant.findUnique({ where: { userId } }))?.id ??
        (await this.prisma.merchantStaff.findFirst({ where: { userId } }))?.merchantId ??
        null;
    } else if (role === UserRole.RIDER) {
      riderId = (await this.prisma.rider.findUnique({ where: { userId } }))?.id ?? null;
    }

    if (input.orderId) {
      const order = await this.prisma.order.findUnique({ where: { id: input.orderId } });
      if (!order) throw new NotFoundException('Order not found');
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
      await this.notifications.notify({
        userId: ticket.createdByUserId,
        title: 'Support replied',
        body: message.slice(0, 140),
        type: NotificationType.SUPPORT_REPLY,
        referenceId: ticket.id,
      });
    } else if (ticket.assignedToAdminId) {
      await this.notifications.notify({
        userId: ticket.assignedToAdminId,
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
      await this.notifications.notify({
        userId: ticket.createdByUserId,
        title: 'Support ticket update',
        body: `Your ticket "${ticket.title}" is now ${input.status.replace(/_/g, ' ').toLowerCase()}.`,
        type: NotificationType.SUPPORT_REPLY,
        referenceId: ticket.id,
      });
    }
    return updated;
  }
}

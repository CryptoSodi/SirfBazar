import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType, PaymentStatus, RefundStatus } from '../common/constants';

@Injectable()
export class RefundsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Creates a refund record. Automatic refunds (prepaid order rejected or
   * cancelled) are approved and processed immediately to the customer wallet;
   * manual complaints start at REQUESTED for admin review.
   */
  async create(input: {
    orderId: string;
    customerId: string;
    amountPaisa: number;
    reason: string;
    autoApprove?: boolean;
  }) {
    if (input.amountPaisa <= 0) throw new BadRequestException('Refund amount must be positive');
    const refund = await this.prisma.refund.create({
      data: {
        orderId: input.orderId,
        customerId: input.customerId,
        amountPaisa: input.amountPaisa,
        reason: input.reason,
        status: input.autoApprove ? RefundStatus.APPROVED : RefundStatus.REQUESTED,
      },
    });
    if (input.autoApprove) return this.process(refund.id, 'Auto-refund on cancellation');
    return refund;
  }

  /** Executes an approved refund: credits the customer wallet and closes the loop. */
  async process(refundId: string, adminNotes?: string) {
    const refund = await this.prisma.refund.findUnique({
      where: { id: refundId },
      include: { customer: true, order: { select: { orderNumber: true, paymentMethod: true } } },
    });
    if (!refund) throw new NotFoundException('Refund not found');
    if (![RefundStatus.APPROVED, RefundStatus.PROCESSING].includes(refund.status as any)) {
      throw new BadRequestException(`Refund is ${refund.status}, cannot process`);
    }

    await this.prisma.$transaction([
      this.prisma.refund.update({
        where: { id: refund.id },
        data: {
          status: RefundStatus.COMPLETED,
          completedAt: new Date(),
          adminNotes: adminNotes ?? refund.adminNotes,
          paymentReference: `WALLET-${Date.now()}`,
        },
      }),
      this.prisma.customer.update({
        where: { id: refund.customerId },
        data: { walletBalancePaisa: { increment: refund.amountPaisa } },
      }),
      this.prisma.payment.updateMany({
        where: { orderId: refund.orderId, status: { in: [PaymentStatus.PAID] } },
        data: { status: PaymentStatus.REFUNDED },
      }),
    ]);

    await this.notifications.notify({
      userId: refund.customer.userId,
      title: 'Refund completed',
      body: `Rs ${(refund.amountPaisa / 100).toFixed(0)} for order ${refund.order.orderNumber} was credited to your SirfBazar wallet.`,
      type: NotificationType.REFUND_UPDATE,
      referenceId: refund.orderId,
    });
    return this.prisma.refund.findUnique({ where: { id: refund.id } });
  }
}

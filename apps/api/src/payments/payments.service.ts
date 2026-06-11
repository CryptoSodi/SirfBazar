import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersService } from '../orders/orders.service';
import { AccessService } from '../common/access.service';
import { AuditService } from '../audit/audit.service';
import { OrderStatus, PaymentStatus } from '../common/constants';

/**
 * Payment processing with a development gateway that mimics the redirect /
 * confirm dance of JazzCash, EasyPaisa, and card processors. Real providers
 * plug in behind initiate()/confirm() without changing the order flow:
 * the provider's server-to-server callback should hit confirm().
 */
@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersService,
    private readonly access: AccessService,
    private readonly audit: AuditService,
  ) {}

  async listForOrder(customerUserId: string, orderId: string) {
    const customerId = await this.access.customerId(customerUserId);
    return this.prisma.payment.findMany({
      where: { orderId, customerId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Returns the pending payment + a mock gateway descriptor for the client. */
  async initiate(customerUserId: string, orderId: string) {
    const customerId = await this.access.customerId(customerUserId);
    const payment = await this.prisma.payment.findFirst({
      where: { orderId, customerId, status: PaymentStatus.PENDING },
      include: { order: { select: { orderNumber: true, status: true } } },
    });
    if (!payment) throw new NotFoundException('No pending payment for this order');
    if (payment.order.status !== OrderStatus.PAYMENT_PENDING) {
      throw new BadRequestException('Order is not awaiting payment');
    }
    return {
      paymentId: payment.id,
      amountPaisa: payment.amountPaisa,
      method: payment.paymentMethod,
      provider: payment.paymentProvider,
      // Real gateways return a redirect URL / deeplink here.
      gateway: {
        type: 'mock',
        instructions: 'POST /api/payments/{paymentId}/confirm to simulate a successful payment',
      },
    };
  }

  /** Marks the payment paid and releases the order(s) to the merchant(s). */
  async confirm(customerUserId: string, paymentId: string, providerTransactionId?: string) {
    const customerId = await this.access.customerId(customerUserId);
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, customerId },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status !== PaymentStatus.PENDING) {
      // Idempotency: double confirmations must not double-advance orders.
      throw new BadRequestException(`Payment is already ${payment.status}`);
    }

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.PAID,
        providerTransactionId: providerTransactionId ?? `MOCK-${Date.now()}`,
      },
    });
    await this.orders.onPaymentConfirmed(payment.orderId);
    await this.audit.log({
      userId: customerUserId,
      role: 'CUSTOMER',
      action: 'PAYMENT_CONFIRMED',
      entityType: 'Payment',
      entityId: payment.id,
      newValue: { amountPaisa: payment.amountPaisa, providerTransactionId },
    });
    return { ok: true, status: PaymentStatus.PAID };
  }

  /** Simulates / records a failed gateway payment and unwinds the order. */
  async fail(customerUserId: string, paymentId: string, reason?: string) {
    const customerId = await this.access.customerId(customerUserId);
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, customerId },
      include: { order: { include: { children: true } } },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status !== PaymentStatus.PENDING) {
      throw new BadRequestException(`Payment is already ${payment.status}`);
    }

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { status: PaymentStatus.FAILED },
    });

    const anchor = payment.order;
    const targets = anchor.isParent ? anchor.children : [anchor];
    for (const order of targets) {
      if (order.status === OrderStatus.PAYMENT_PENDING) {
        await this.orders.restoreStock(order.id);
        await this.prisma.order.update({
          where: { id: order.id },
          data: {
            status: OrderStatus.CANCELLED_BY_ADMIN,
            paymentStatus: PaymentStatus.FAILED,
            cancellationReason: reason ?? 'Payment failed',
            cancelledAt: new Date(),
          },
        });
        await this.prisma.orderTimelineEntry.create({
          data: {
            orderId: order.id,
            status: OrderStatus.CANCELLED_BY_ADMIN,
            changedByRole: 'SYSTEM',
            notes: reason ?? 'Payment failed',
          },
        });
      }
    }
    if (anchor.isParent) {
      await this.prisma.order.update({
        where: { id: anchor.id },
        data: {
          status: OrderStatus.CANCELLED_BY_ADMIN,
          paymentStatus: PaymentStatus.FAILED,
          cancellationReason: reason ?? 'Payment failed',
          cancelledAt: new Date(),
        },
      });
    }
    return { ok: true, status: PaymentStatus.FAILED };
  }
}

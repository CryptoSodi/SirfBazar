import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService } from '../common/access.service';

/**
 * Read-only payment records and explicit rejection of customer mock endpoints.
 * A provider callback needs a separate authenticated server-side integration.
 */
@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  async listForOrder(customerUserId: string, orderId: string) {
    const customerId = await this.access.customerId(customerUserId);
    return this.prisma.payment.findMany({
      where: { orderId, customerId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** No provider credentials or callbacks are configured for marketplace payments. */
  async initiate(customerUserId: string, orderId: string) {
    throw new BadRequestException('Digital payments are unavailable. Choose cash on delivery.');
  }

  /** Marks the payment paid and releases the order(s) to the merchant(s). */
  async confirm(customerUserId: string, paymentId: string, providerTransactionId?: string) {
    throw new BadRequestException('Customer payment confirmation is unavailable. Choose cash on delivery.');
  }

  /** Simulates / records a failed gateway payment and unwinds the order. */
  async fail(customerUserId: string, paymentId: string, reason?: string) {
    throw new BadRequestException('Customer payment simulation is unavailable. Choose cash on delivery.');
  }
}

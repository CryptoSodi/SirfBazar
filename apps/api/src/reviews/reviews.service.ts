import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MerchantApprovalStatus } from '../common/constants';
import { paged, parsePage, PageQuery } from '../common/utils/pagination';

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Public listing of a merchant's reviews (reviewType MERCHANT), newest first. */
  async listForMerchant(merchantId: string, query: PageQuery) {
    const merchant = await this.prisma.merchant.findUnique({
      where: { id: merchantId },
      select: { id: true, approvalStatus: true },
    });
    if (!merchant || merchant.approvalStatus !== MerchantApprovalStatus.APPROVED) {
      throw new NotFoundException('Merchant not found');
    }

    const { page, pageSize, skip, take } = parsePage(query);
    // reviewType vocabulary follows orders.service.ts ('MERCHANT' | 'RIDER' | 'PRODUCT' | 'ORDER').
    const where = { merchantId, reviewType: 'MERCHANT' };
    const [rows, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        select: {
          id: true,
          rating: true,
          reviewText: true,
          createdAt: true,
          customer: {
            select: { user: { select: { fullName: true, profileImageUrl: true } } },
          },
        },
      }),
      this.prisma.review.count({ where }),
    ]);

    const items = rows.map((r) => ({
      id: r.id,
      rating: r.rating,
      reviewText: r.reviewText,
      createdAt: r.createdAt,
      customer: {
        fullName: r.customer?.user?.fullName ?? null,
        profileImageUrl: r.customer?.user?.profileImageUrl ?? null,
      },
    }));
    return paged(items, total, page, pageSize);
  }
}

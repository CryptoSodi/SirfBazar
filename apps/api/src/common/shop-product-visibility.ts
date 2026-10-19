import { Prisma } from '@prisma/client';
import { ProductApprovalStatus } from './constants';

/** Pending merchant submissions are sellable only in the submitting shop. */
export function shopProductApprovalWhere(merchantId: string): Prisma.ProductWhereInput {
  return {
    OR: [
      { approvalStatus: ProductApprovalStatus.APPROVED },
      { approvalStatus: ProductApprovalStatus.PENDING, createdByMerchantId: merchantId },
    ],
  };
}

export function canSellShopProduct(
  product: { approvalStatus: string; createdByMerchantId: string | null },
  merchantId: string,
): boolean {
  return product.approvalStatus === ProductApprovalStatus.APPROVED ||
    (product.approvalStatus === ProductApprovalStatus.PENDING && product.createdByMerchantId === merchantId);
}

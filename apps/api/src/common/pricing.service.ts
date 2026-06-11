import { Injectable } from '@nestjs/common';

/**
 * Centralized fee/commission math. All amounts in paisa.
 * Defaults come from env so ops can tune without a deploy.
 */
@Injectable()
export class PricingService {
  private envInt(name: string, fallback: number) {
    const v = Number(process.env[name]);
    return Number.isFinite(v) && v >= 0 ? v : fallback;
  }

  deliveryFeePaisa(distanceKm: number | null): number {
    const base = this.envInt('DEFAULT_DELIVERY_BASE_FEE_PAISA', 5000);
    const perKm = this.envInt('DEFAULT_DELIVERY_PER_KM_FEE_PAISA', 1500);
    if (distanceKm == null) return base;
    return base + Math.round(perKm * distanceKm);
  }

  serviceFeePaisa(): number {
    return this.envInt('DEFAULT_SERVICE_FEE_PAISA', 1000);
  }

  smallOrderFeePaisa(subtotalPaisa: number): number {
    const threshold = this.envInt('SMALL_ORDER_THRESHOLD_PAISA', 30000);
    if (subtotalPaisa >= threshold) return 0;
    return this.envInt('SMALL_ORDER_FEE_PAISA', 3000);
  }

  commissionPaisa(
    merchant: { commissionType: string; commissionValue: number },
    subtotalPaisa: number,
  ): number {
    if (merchant.commissionType === 'FIXED') return Math.round(merchant.commissionValue);
    return Math.floor((subtotalPaisa * merchant.commissionValue) / 100);
  }
}

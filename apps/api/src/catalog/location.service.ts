import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MerchantApprovalStatus } from '../common/constants';
import { haversineKm } from '../common/utils/geo';
import { DetectLocationDto } from './catalog.dto';

@Injectable()
export class LocationService {
  constructor(private readonly prisma: PrismaService) {}

  private approvedMerchantPoints() {
    return this.prisma.merchant.findMany({
      where: { approvalStatus: MerchantApprovalStatus.APPROVED },
      select: {
        id: true,
        city: true,
        area: true,
        latitude: true,
        longitude: true,
        serviceRadiusKm: true,
      },
    });
  }

  /**
   * Locality detection without an external geocoder: the nearest approved
   * merchant's city/area stands in for the user's locality. Without
   * coordinates, falls back to the city with the most merchants.
   */
  async detect(dto: DetectLocationDto) {
    const merchants = await this.approvedMerchantPoints();

    if (dto.latitude != null && dto.longitude != null) {
      if (merchants.length === 0) {
        return {
          city: null,
          area: null,
          latitude: dto.latitude,
          longitude: dto.longitude,
          serviceable: false,
        };
      }
      let nearest = merchants[0];
      let nearestKm = Number.POSITIVE_INFINITY;
      let serviceable = false;
      for (const m of merchants) {
        const km = haversineKm(dto.latitude, dto.longitude, m.latitude, m.longitude);
        if (km < nearestKm) {
          nearestKm = km;
          nearest = m;
        }
        if (km <= m.serviceRadiusKm) serviceable = true;
      }
      return {
        city: nearest.city,
        area: nearest.area,
        latitude: dto.latitude,
        longitude: dto.longitude,
        serviceable,
      };
    }

    // No coordinates (e.g. IP-only): fall back to the busiest city.
    const cityCounts = new Map<string, number>();
    for (const m of merchants) {
      cityCounts.set(m.city, (cityCounts.get(m.city) ?? 0) + 1);
    }
    let topCity: string | null = null;
    let topCount = 0;
    for (const [city, count] of cityCounts) {
      if (count > topCount) {
        topCity = city;
        topCount = count;
      }
    }
    return { city: topCity, area: null, latitude: null, longitude: null, serviceable: false };
  }

  async serviceAvailability(latitude: number, longitude: number) {
    const merchants = await this.approvedMerchantPoints();
    const merchantsInRange = merchants.filter(
      (m) => haversineKm(latitude, longitude, m.latitude, m.longitude) <= m.serviceRadiusKm,
    ).length;
    return { serviceable: merchantsInRange > 0, merchantsInRange };
  }

  async nearbyAreas(city?: string) {
    const groups = await this.prisma.merchant.groupBy({
      by: ['city', 'area'],
      where: {
        approvalStatus: MerchantApprovalStatus.APPROVED,
        // SQLite `contains` is case-insensitive for ASCII — forgiving city match.
        ...(city?.trim() ? { city: { contains: city.trim() } } : {}),
      },
      orderBy: [{ city: 'asc' }, { area: 'asc' }],
    });
    return groups.map((g) => ({ city: g.city, area: g.area ?? null }));
  }
}

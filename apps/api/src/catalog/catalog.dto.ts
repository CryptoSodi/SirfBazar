import { IsIn, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class LocationQuery {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  longitude?: number;
}

export class PagedLocationQuery extends LocationQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number;
}

export class NearbyProductsQuery extends PagedLocationQuery {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  radiusKm?: number;

  @IsOptional()
  @IsString()
  categoryId?: string;
}

export const PRODUCT_SORTS = [
  'relevance',
  'price_asc',
  'price_desc',
  'rating',
  'distance',
] as const;
export type ProductSort = (typeof PRODUCT_SORTS)[number];

export class SearchProductsQuery extends NearbyProductsQuery {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minPricePaisa?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxPricePaisa?: number;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsIn(PRODUCT_SORTS as unknown as string[])
  sort?: ProductSort;
}

export class NearbyMerchantsQuery extends PagedLocationQuery {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  radiusKm?: number;

  @IsOptional()
  @IsString()
  shopType?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;
}

export class MerchantProductsQuery {
  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number;
}

export class PageQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number;
}

export class DetectLocationDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @IsString()
  ip?: string;
}

export class ServiceAvailabilityQuery {
  @Type(() => Number)
  @IsNumber()
  latitude: number;

  @Type(() => Number)
  @IsNumber()
  longitude: number;
}

export class NearbyAreasQuery {
  @IsOptional()
  @IsString()
  city?: string;
}

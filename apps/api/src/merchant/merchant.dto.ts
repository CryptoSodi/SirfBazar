import {
  IsArray,
  ArrayMaxSize,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Max,
  MaxLength,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ShopType, StaffPermission } from '../common/constants';

const PHONE_REGEX = /^\+?[0-9]{10,15}$/;

export class OnboardMerchantDto {
  @IsString()
  @IsNotEmpty()
  shopName: string;

  @IsIn(Object.values(ShopType))
  shopType: string;

  @IsOptional()
  @IsString()
  description?: string;

  @Matches(PHONE_REGEX)
  phoneNumber: string;

  @IsString()
  @IsNotEmpty()
  address: string;

  @IsString()
  @IsNotEmpty()
  city: string;

  @IsOptional()
  @IsString()
  area?: string;

  @Type(() => Number)
  @IsNumber()
  latitude: number;

  @Type(() => Number)
  @IsNumber()
  longitude: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.5)
  serviceRadiusKm?: number;

  @IsOptional()
  @IsString()
  openingTime?: string;

  @IsOptional()
  @IsString()
  closingTime?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minimumOrderValuePaisa?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  averagePreparationMinutes?: number;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsString()
  bannerUrl?: string;
}

export class UpdateMerchantProfileDto {
  @IsOptional() @IsString() shopName?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @Matches(PHONE_REGEX) phoneNumber?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() area?: string;
  @IsOptional() @Type(() => Number) @IsNumber() latitude?: number;
  @IsOptional() @Type(() => Number) @IsNumber() longitude?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0.5) serviceRadiusKm?: number;
  @IsOptional() @IsString() openingTime?: string;
  @IsOptional() @IsString() closingTime?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) minimumOrderValuePaisa?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) averagePreparationMinutes?: number;
  @IsOptional() @IsString() logoUrl?: string;
  @IsOptional() @IsString() bannerUrl?: string;
}

export class NewProductDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  @IsNotEmpty()
  categoryId: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsString()
  @IsNotEmpty()
  unit: string;

  @IsOptional()
  @IsString()
  size?: string;
}

export class AddMerchantProductDto {
  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => NewProductDto)
  newProduct?: NewProductDto;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  pricePaisa: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  discountPricePaisa?: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  stockQuantity: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  lowStockThreshold?: number;

  @IsOptional()
  @IsString()
  merchantSku?: string;
}

export class UpdateMerchantProductDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) pricePaisa?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) discountPricePaisa?: number | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) stockQuantity?: number;
  @IsOptional() @IsBoolean() isAvailable?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) lowStockThreshold?: number;
  @IsOptional() @IsString() merchantSku?: string;
}

export class BulkExpectedDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(2147483647) pricePaisa: number;
  @Type(() => Number) @IsInt() @Min(0) @Max(2147483647) stockQuantity: number;
  @IsString() updatedAt: string;
}

export class BulkItemDto {
  @IsString() @IsNotEmpty() @MaxLength(128) rowId: string;
  @IsOptional() @IsString() productId?: string;
  @IsOptional() @IsString() @MaxLength(240) name?: string;
  @IsOptional() @IsString() categoryId?: string;
  @IsOptional() @IsString() @MaxLength(40) unit?: string;
  @IsOptional() @IsString() @MaxLength(160) merchantSku?: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(2147483647) pricePaisa: number;
  @Type(() => Number) @IsInt() @Min(0) @Max(2147483647) stockQuantity: number;
  @IsOptional() @ValidateNested() @Type(() => BulkExpectedDto) expected?: BulkExpectedDto;
}

export class BulkUploadDto {
  @IsUUID('4') requestId: string;
  @IsOptional() @IsIn(['ADD_MISSING', 'UPDATE_EXISTING']) mode?: 'ADD_MISSING' | 'UPDATE_EXISTING';
  @IsArray() @ArrayMaxSize(1000) @ValidateNested({ each: true }) @Type(() => BulkItemDto) items: BulkItemDto[];
  @IsOptional() @IsString() @MaxLength(4 * 1024 * 1024) previewToken?: string;
}

export class CreateRiderDto {
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @Matches(PHONE_REGEX)
  phoneNumber: string;

  @IsOptional()
  @IsIn(['MOTORBIKE', 'BICYCLE', 'CAR', 'ON_FOOT'])
  vehicleType?: string;

  @IsOptional()
  @IsString()
  vehicleNumber?: string;
}

export class UpdateRiderDto {
  @IsOptional() @IsString() fullName?: string;
  @IsOptional() @IsIn(['MOTORBIKE', 'BICYCLE', 'CAR', 'ON_FOOT']) vehicleType?: string;
  @IsOptional() @IsString() vehicleNumber?: string;
  @IsOptional() @IsString() profileImageUrl?: string;
}

export class CreateStaffDto {
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @Matches(PHONE_REGEX)
  phoneNumber: string;

  @IsString()
  @IsNotEmpty()
  roleName: string;

  @IsArray()
  @IsIn(Object.values(StaffPermission), { each: true })
  permissions: string[];
}

export class UpdateStaffDto {
  @IsOptional() @IsString() roleName?: string;
  @IsOptional() @IsArray() @IsIn(Object.values(StaffPermission), { each: true }) permissions?: string[];
  @IsOptional() @IsIn(['ACTIVE', 'DISABLED']) status?: string;
}

export class AddDocumentDto {
  @IsIn(['BUSINESS_REGISTRATION', 'IDENTITY', 'BANK_DETAILS', 'OTHER'])
  documentType: string;

  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  documentUrl: string;
}

export class UploadDocumentDto {
  @IsIn(['BUSINESS_REGISTRATION', 'IDENTITY', 'BANK_DETAILS', 'OTHER'])
  documentType: string;
}

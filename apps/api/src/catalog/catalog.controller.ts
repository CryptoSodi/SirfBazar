import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CatalogService } from './catalog.service';
import { LocationService } from './location.service';
import { ReviewsService } from '../reviews/reviews.service';
import { AuthUser, CurrentUser, Public } from '../common/decorators';
import {
  DetectLocationDto,
  LocationQuery,
  MerchantProductsQuery,
  NearbyAreasQuery,
  NearbyMerchantsQuery,
  NearbyProductsQuery,
  PageQueryDto,
  SearchProductsQuery,
  ServiceAvailabilityQuery,
} from './catalog.dto';

@ApiTags('catalog')
@Public()
@Controller('products')
export class ProductsController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('categories')
  categories(@Query() query: LocationQuery) {
    return this.catalog.categoriesTree(query);
  }

  @Get('search')
  search(@Query() query: SearchProductsQuery) {
    return this.catalog.search(query);
  }

  /** Full global catalog for browsing/discovery (not merchant- or location-filtered). */
  @Get('catalog')
  catalogBrowse(@Query() query: SearchProductsQuery) {
    return this.catalog.catalogProducts(query);
  }

  @Get('nearby')
  nearby(@Query() query: NearbyProductsQuery) {
    return this.catalog.nearbyProducts(query);
  }

  @Get('popular')
  popular(@Query() query: LocationQuery) {
    return this.catalog.popularProducts(query);
  }

  /** Personalized when a JWT is sent (the guard decodes it even on public routes). */
  @Get('recommended')
  recommended(@Query() query: LocationQuery, @CurrentUser() user?: AuthUser) {
    return this.catalog.recommendedProducts(query, user?.userId);
  }

  @Get(':id')
  detail(@Param('id') id: string, @Query() query: LocationQuery) {
    return this.catalog.productDetail(id, query);
  }
}

@ApiTags('catalog')
@Public()
@Controller('merchants')
export class MerchantsDiscoveryController {
  constructor(
    private readonly catalog: CatalogService,
    private readonly reviews: ReviewsService,
  ) {}

  @Get('nearby')
  nearby(@Query() query: NearbyMerchantsQuery) {
    return this.catalog.nearbyMerchants(query);
  }

  @Get(':id')
  detail(@Param('id') id: string, @Query() query: LocationQuery) {
    return this.catalog.merchantDetail(id, query);
  }

  @Get(':id/products')
  products(@Param('id') id: string, @Query() query: MerchantProductsQuery) {
    return this.catalog.merchantProducts(id, query);
  }

  @Get(':id/reviews')
  merchantReviews(@Param('id') id: string, @Query() query: PageQueryDto) {
    return this.reviews.listForMerchant(id, query);
  }
}

@ApiTags('location')
@Public()
@Controller('location')
export class LocationController {
  constructor(private readonly location: LocationService) {}

  @Post('detect')
  detect(@Body() dto: DetectLocationDto) {
    return this.location.detect(dto);
  }

  @Get('service-availability')
  serviceAvailability(@Query() query: ServiceAvailabilityQuery) {
    return this.location.serviceAvailability(query.latitude, query.longitude);
  }

  @Get('nearby-areas')
  nearbyAreas(@Query() query: NearbyAreasQuery) {
    return this.location.nearbyAreas(query.city);
  }
}

/** Guest product discovery — same shape as GET /products/nearby. */
@ApiTags('guest')
@Public()
@Controller('guest')
export class GuestCatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('location-products')
  locationProducts(@Query() query: NearbyProductsQuery) {
    return this.catalog.nearbyProducts(query);
  }
}

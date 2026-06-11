import { Module } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { LocationService } from './location.service';
import {
  GuestCatalogController,
  LocationController,
  MerchantsDiscoveryController,
  ProductsController,
} from './catalog.controller';
import { ReviewsModule } from '../reviews/reviews.module';

@Module({
  imports: [ReviewsModule],
  controllers: [
    ProductsController,
    MerchantsDiscoveryController,
    LocationController,
    GuestCatalogController,
  ],
  providers: [CatalogService, LocationService],
  exports: [CatalogService, LocationService],
})
export class CatalogModule {}

import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

import { PrismaModule } from './prisma/prisma.module';
import { SharedModule } from './common/shared.module';
import { AuthModule } from './auth/auth.module';
import { RealtimeModule } from './realtime/realtime.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AuditModule } from './audit/audit.module';
import { GuestModule } from './guest/guest.module';
import { CartModule } from './cart/cart.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { RiderModule } from './rider/rider.module';
import { CouponsModule } from './coupons/coupons.module';
import { RefundsModule } from './refunds/refunds.module';
import { CatalogModule } from './catalog/catalog.module';
import { CustomersModule } from './customers/customers.module';
import { ReviewsModule } from './reviews/reviews.module';
import { MerchantModule } from './merchant/merchant.module';
import { AdminModule } from './admin/admin.module';
import { SupportModule } from './support/support.module';
import { SettlementsModule } from './settlements/settlements.module';
import { UploadsModule } from './uploads/uploads.module';
import { PosModule } from './pos/pos.module';

import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET || 'dev-secret-do-not-use-in-production',
      signOptions: { expiresIn: Number(process.env.JWT_ACCESS_TTL_SECONDS || 900) },
    }),
    PrismaModule,
    SharedModule,
    RealtimeModule,
    NotificationsModule,
    AuditModule,
    AuthModule,
    GuestModule,
    CartModule,
    OrdersModule,
    PaymentsModule,
    RiderModule,
    CouponsModule,
    RefundsModule,
    CatalogModule,
    CustomersModule,
    ReviewsModule,
    MerchantModule,
    AdminModule,
    SupportModule,
    SettlementsModule,
    UploadsModule,
    PosModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}

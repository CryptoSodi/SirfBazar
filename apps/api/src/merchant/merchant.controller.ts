import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Put, Query, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { MerchantService } from './merchant.service';
import { MerchantProductsService } from './merchant-products.service';
import { MerchantPeopleService } from './merchant-people.service';
import { AuthUser, CurrentUser, Roles } from '../common/decorators';
import { UserRole } from '../common/constants';
import {
  AddDocumentDto,
  AddMerchantProductDto,
  BulkUploadDto,
  CreateRiderDto,
  CreateStaffDto,
  OnboardMerchantDto,
  UpdateMerchantProductDto,
  UpdateMerchantProfileDto,
  UpdateRiderDto,
  UpdateStaffDto,
  UploadDocumentDto,
} from './merchant.dto';

/** Onboarding is open to any authenticated user (typically a fresh OTP login). */
@ApiTags('merchant')
@Controller('merchant')
export class MerchantOnboardController {
  constructor(private readonly merchant: MerchantService) {}

  @Post('onboard')
  onboard(@CurrentUser() user: AuthUser, @Body() dto: OnboardMerchantDto) {
    return this.merchant.onboard(user.userId, dto);
  }
}

@ApiTags('merchant')
@Roles(UserRole.MERCHANT_OWNER, UserRole.MERCHANT_STAFF)
@Controller('merchant')
export class MerchantController {
  constructor(
    private readonly merchant: MerchantService,
    private readonly products: MerchantProductsService,
    private readonly people: MerchantPeopleService,
  ) {}

  // ── Profile & store state ──────────────────────────────────────────────────

  @Get('profile')
  profile(@CurrentUser() user: AuthUser) {
    return this.merchant.profile(user.userId);
  }

  @Put('profile')
  updateProfile(@CurrentUser() user: AuthUser, @Body() dto: UpdateMerchantProfileDto) {
    return this.merchant.updateProfile(user.userId, dto);
  }

  @Post('documents')
  addDocument(@CurrentUser() user: AuthUser, @Body() dto: AddDocumentDto) {
    return this.merchant.addDocument(user.userId, dto);
  }

  @Post('documents/upload')
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_request, file, callback) => {
      const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype);
      callback(allowed ? null : new BadRequestException('Only PDF, JPG, PNG and WebP documents are allowed'), allowed);
    },
  }))
  uploadDocument(
    @CurrentUser() user: AuthUser,
    @Body() dto: UploadDocumentDto,
    @UploadedFile() file: any,
  ) {
    return this.merchant.uploadDocument(user.userId, dto.documentType, file);
  }

  @Get('documents/:id/file')
  async documentFile(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Res() response: Response,
  ) {
    const file = await this.merchant.documentFile(user.userId, id);
    response.type(file.mimeType);
    response.setHeader('Content-Disposition', `inline; filename="${file.downloadName}"`);
    return response.sendFile(file.path);
  }

  @Post('online')
  online(@CurrentUser() user: AuthUser) {
    return this.merchant.setOnline(user.userId, true);
  }

  @Post('offline')
  offline(@CurrentUser() user: AuthUser) {
    return this.merchant.setOnline(user.userId, false);
  }

  @Post('open')
  open(@CurrentUser() user: AuthUser) {
    return this.merchant.setOpen(user.userId, true);
  }

  @Post('close')
  close(@CurrentUser() user: AuthUser) {
    return this.merchant.setOpen(user.userId, false);
  }

  @Get('dashboard')
  dashboard(@CurrentUser() user: AuthUser) {
    return this.merchant.dashboard(user.userId);
  }

  @Get('earnings')
  earnings(@CurrentUser() user: AuthUser, @Query('from') from?: string, @Query('to') to?: string) {
    return this.merchant.earnings(user.userId, from, to);
  }

  @Get('settlements')
  settlements(@CurrentUser() user: AuthUser) {
    return this.merchant.settlements(user.userId);
  }

  // ── Products & inventory ───────────────────────────────────────────────────

  @Get('products')
  @ApiOperation({ summary: 'List own shop products', description: 'Returns {items,total,page,pageSize,totalPages}.' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number, description: 'Maximum 100.' })
  @ApiQuery({ name: 'q', required: false, type: String })
  @ApiQuery({ name: 'lowStock', required: false, type: Boolean })
  @ApiQuery({ name: 'isAvailable', required: false, type: Boolean })
  @ApiQuery({ name: 'minStock', required: false, type: Number, description: 'Non-negative integer stock quantity.' })
  listProducts(@CurrentUser() user: AuthUser, @Query() query: any) {
    return this.products.list(user.userId, query);
  }

  /** Shared global catalog the merchant can add products from (no image upload needed). */
  @Get('catalog')
  browseCatalog(@CurrentUser() user: AuthUser, @Query() query: any) {
    return this.products.browseCatalog(user.userId, query);
  }

  @Post('products')
  addProduct(@CurrentUser() user: AuthUser, @Body() dto: AddMerchantProductDto) {
    return this.products.add(user.userId, dto);
  }

  @Post('products/bulk-upload')
  bulkUpload(@CurrentUser() user: AuthUser, @Body() dto: BulkUploadDto) {
    return this.products.bulkUpload(user.userId, dto);
  }

  @Post('products/bulk-preview')
  bulkPreview(@CurrentUser() user: AuthUser, @Body() dto: BulkUploadDto) {
    return this.products.bulkPreview(user.userId, dto);
  }

  @Put('products/:id')
  updateProduct(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateMerchantProductDto,
  ) {
    return this.products.update(user.userId, id, dto);
  }

  @Delete('products/:id')
  removeProduct(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.products.remove(user.userId, id);
  }

  // ── Riders ─────────────────────────────────────────────────────────────────

  @Get('riders')
  listRiders(@CurrentUser() user: AuthUser) {
    return this.people.listRiders(user.userId);
  }

  @Post('riders')
  createRider(@CurrentUser() user: AuthUser, @Body() dto: CreateRiderDto) {
    return this.people.createRider(user.userId, dto);
  }

  @Get('riders/:id')
  getRider(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.people.getRider(user.userId, id);
  }

  @Put('riders/:id')
  updateRider(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateRiderDto) {
    return this.people.updateRider(user.userId, id, dto);
  }

  @Delete('riders/:id')
  removeRider(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.people.setRiderActive(user.userId, id, false);
  }

  @Post('riders/:id/activate')
  activateRider(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.people.setRiderActive(user.userId, id, true);
  }

  @Post('riders/:id/deactivate')
  deactivateRider(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.people.setRiderActive(user.userId, id, false);
  }

  @Post('riders/:id/approve')
  approveRider(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.people.approveRider(user.userId, id);
  }

  @Post('riders/:id/reject')
  rejectRider(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.people.rejectRider(user.userId, id);
  }

  @Get('riders/:id/orders')
  riderOrders(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.people.riderOrders(user.userId, id);
  }

  // ── Staff ──────────────────────────────────────────────────────────────────

  @Get('staff')
  listStaff(@CurrentUser() user: AuthUser) {
    return this.people.listStaff(user.userId);
  }

  @Post('staff')
  createStaff(@CurrentUser() user: AuthUser, @Body() dto: CreateStaffDto) {
    return this.people.createStaff(user.userId, dto);
  }

  @Put('staff/:id')
  updateStaff(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateStaffDto) {
    return this.people.updateStaff(user.userId, id, dto);
  }

  @Delete('staff/:id')
  removeStaff(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.people.removeStaff(user.userId, id);
  }
}

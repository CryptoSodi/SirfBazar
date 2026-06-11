import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { AdminMarketplaceService } from './admin-marketplace.service';
import { SettlementsService } from '../settlements/settlements.service';
import { SupportService } from '../support/support.service';
import { AuthUser, CurrentUser, Roles } from '../common/decorators';
import { MerchantApprovalStatus, UserRole } from '../common/constants';

@ApiTags('admin')
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly marketplace: AdminMarketplaceService,
    private readonly settlements: SettlementsService,
    private readonly support: SupportService,
  ) {}

  // ── Dashboard & analytics ─────────────────────────────────────────────────

  @Get('dashboard')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE_ADMIN, UserRole.SUPPORT_AGENT)
  dashboard() {
    return this.admin.dashboard();
  }

  @Get('analytics')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE_ADMIN)
  analytics(@Query('from') from?: string, @Query('to') to?: string) {
    return this.admin.analytics(from, to);
  }

  @Get('audit-logs')
  auditLogs(@Query() query: any) {
    return this.admin.listAuditLogs(query);
  }

  // ── Customers ─────────────────────────────────────────────────────────────

  @Get('customers')
  customers(@Query() query: any) {
    return this.admin.listCustomers(query);
  }

  @Get('customers/:id')
  customerDetail(@Param('id') id: string) {
    return this.admin.customerDetail(id);
  }

  @Post('customers/:id/suspend')
  suspendCustomer(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.admin.setUserStatus(user.userId, id, 'SUSPENDED');
  }

  @Post('customers/:id/activate')
  activateCustomer(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.admin.setUserStatus(user.userId, id, 'ACTIVE');
  }

  // ── Merchants ─────────────────────────────────────────────────────────────

  @Get('merchants')
  merchants(@Query() query: any) {
    return this.marketplace.listMerchants(query);
  }

  @Get('merchants/:id')
  merchantDetail(@Param('id') id: string) {
    return this.marketplace.merchantDetail(id);
  }

  @Post('merchants/:id/approve')
  approveMerchant(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.marketplace.setMerchantApproval(user.userId, id, MerchantApprovalStatus.APPROVED);
  }

  @Post('merchants/:id/reject')
  rejectMerchant(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: { reason?: string }) {
    return this.marketplace.setMerchantApproval(user.userId, id, MerchantApprovalStatus.REJECTED, body?.reason);
  }

  @Post('merchants/:id/suspend')
  suspendMerchant(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: { reason?: string }) {
    return this.marketplace.setMerchantApproval(user.userId, id, MerchantApprovalStatus.SUSPENDED, body?.reason);
  }

  @Post('merchants/:id/reactivate')
  reactivateMerchant(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.marketplace.setMerchantApproval(user.userId, id, MerchantApprovalStatus.APPROVED);
  }

  @Put('merchants/:id')
  updateMerchant(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: any) {
    return this.marketplace.updateMerchant(user.userId, id, body);
  }

  @Get('merchants/:id/riders')
  merchantRiders(@Param('id') id: string) {
    return this.marketplace.merchantRiders(id);
  }

  // ── Riders ────────────────────────────────────────────────────────────────

  @Get('riders')
  riders(@Query() query: any) {
    return this.admin.listRiders(query);
  }

  @Post('riders/:id/suspend')
  suspendRider(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.admin.setRiderSuspended(user.userId, id, true);
  }

  @Post('riders/:id/activate')
  activateRider(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.admin.setRiderSuspended(user.userId, id, false);
  }

  // ── Orders ────────────────────────────────────────────────────────────────

  @Get('orders')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.SUPPORT_AGENT, UserRole.FINANCE_ADMIN)
  orders(@Query() query: any) {
    return this.marketplace.listOrders(query);
  }

  @Get('orders/:id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.SUPPORT_AGENT, UserRole.FINANCE_ADMIN)
  orderDetail(@Param('id') id: string) {
    return this.marketplace.orderDetail(id);
  }

  @Post('orders/:id/cancel')
  cancelOrder(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: { reason: string }) {
    return this.marketplace.cancelOrder(user.userId, id, body?.reason ?? 'Cancelled by admin');
  }

  @Post('orders/:id/refund')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE_ADMIN)
  refundOrder(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: { amountPaisa?: number; reason: string },
  ) {
    return this.marketplace.refundOrder(user.userId, id, body?.amountPaisa, body?.reason ?? 'Admin refund');
  }

  @Post('orders/:id/status')
  overrideStatus(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: { status: string; reason: string },
  ) {
    return this.marketplace.overrideOrderStatus(user.userId, id, body.status, body?.reason ?? '');
  }

  // ── Products & categories ─────────────────────────────────────────────────

  @Get('products')
  products(@Query() query: any) {
    return this.marketplace.listProducts(query);
  }

  @Post('products')
  createProduct(@CurrentUser() user: AuthUser, @Body() body: any) {
    return this.marketplace.createProduct(user.userId, body);
  }

  @Put('products/:id')
  updateProduct(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: any) {
    return this.marketplace.updateProduct(user.userId, id, body);
  }

  @Post('products/:id/approve')
  approveProduct(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.marketplace.setProductApproval(user.userId, id, 'APPROVED');
  }

  @Post('products/:id/reject')
  rejectProduct(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: { reason?: string }) {
    return this.marketplace.setProductApproval(user.userId, id, 'REJECTED', body?.reason);
  }

  @Post('products/:id/disable')
  disableProduct(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.marketplace.setProductApproval(user.userId, id, 'DISABLED');
  }

  @Get('categories')
  categories() {
    return this.marketplace.listCategories();
  }

  @Post('categories')
  createCategory(@CurrentUser() user: AuthUser, @Body() body: any) {
    return this.marketplace.createCategory(user.userId, body);
  }

  @Put('categories/:id')
  updateCategory(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: any) {
    return this.marketplace.updateCategory(user.userId, id, body);
  }

  @Delete('categories/:id')
  deleteCategory(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.marketplace.deleteCategory(user.userId, id);
  }

  // ── Coupons ───────────────────────────────────────────────────────────────

  @Get('coupons')
  coupons() {
    return this.marketplace.listCoupons();
  }

  @Post('coupons')
  createCoupon(@CurrentUser() user: AuthUser, @Body() body: any) {
    return this.marketplace.createCoupon(user.userId, body);
  }

  @Put('coupons/:id')
  updateCoupon(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: any) {
    return this.marketplace.updateCoupon(user.userId, id, body);
  }

  @Delete('coupons/:id')
  deactivateCoupon(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.marketplace.deactivateCoupon(user.userId, id);
  }

  // ── Refunds ───────────────────────────────────────────────────────────────

  @Get('refunds')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE_ADMIN)
  refunds(@Query() query: any) {
    return this.marketplace.listRefunds(query);
  }

  @Post('refunds/:id/approve')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE_ADMIN)
  approveRefund(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.marketplace.setRefundStatus(user.userId, id, 'approve');
  }

  @Post('refunds/:id/reject')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE_ADMIN)
  rejectRefund(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: { notes?: string }) {
    return this.marketplace.setRefundStatus(user.userId, id, 'reject', body?.notes);
  }

  @Post('refunds/:id/process')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE_ADMIN)
  processRefund(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.marketplace.processRefund(user.userId, id);
  }

  // ── Settlements ───────────────────────────────────────────────────────────

  @Get('settlements')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE_ADMIN)
  listSettlements(@Query('merchantId') merchantId?: string, @Query('status') status?: string) {
    return this.settlements.list({ merchantId, status });
  }

  @Post('settlements/generate')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE_ADMIN)
  generateSettlements(
    @CurrentUser() user: AuthUser,
    @Body() body: { merchantId?: string; startDate: string; endDate: string },
  ) {
    return this.settlements.generate(user.userId, body);
  }

  @Post('settlements/:id/mark-paid')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE_ADMIN)
  markSettlementPaid(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: { paymentReference: string },
  ) {
    return this.settlements.markPaid(user.userId, id, body?.paymentReference ?? 'manual');
  }

  @Post('settlements/:id/hold')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE_ADMIN)
  holdSettlement(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: { notes?: string }) {
    return this.settlements.hold(user.userId, id, body?.notes);
  }

  // ── Support tickets ───────────────────────────────────────────────────────

  @Get('support-tickets')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.SUPPORT_AGENT)
  tickets(@Query() query: any) {
    return this.support.adminList(query);
  }

  @Get('support-tickets/:id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.SUPPORT_AGENT)
  ticketDetail(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.support.getForUser(user.userId, user.role, id);
  }

  @Put('support-tickets/:id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.SUPPORT_AGENT)
  updateTicket(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: any) {
    return this.support.adminUpdate(user.userId, id, body);
  }

  @Post('support-tickets/:id/messages')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.SUPPORT_AGENT)
  ticketMessage(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: { message: string }) {
    return this.support.addMessage(user.userId, user.role, id, body.message);
  }
}

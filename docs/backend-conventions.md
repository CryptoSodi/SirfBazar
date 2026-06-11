# SirfBazar API — backend conventions

Read this before writing any module in `apps/api`.

## Stack
- NestJS 10 + Prisma 6 + SQLite (dev). Schema: `apps/api/prisma/schema.prisma` — **do not modify the schema or run `prisma db push`**; if a field seems missing, work around it or leave a `// TODO(schema)` comment.
- Run `npx tsc --noEmit` in `apps/api` to verify your work compiles. Do NOT run `nest build`, `npm run dev`, or start the server (another process may own it).
- Do NOT touch `src/app.module.ts` — all modules are already wired. Fill in your module file(s) instead.

## Money & units
- ALL money fields are integers in **paisa** (100 paisa = 1 PKR). Field names end in `Paisa`.
- Coordinates are floats. Distances use `haversineKm` from `src/common/utils/geo.ts`.

## Status strings
- SQLite has no enums. Every status/role value MUST come from `src/common/constants.ts` (UserRole, OrderStatus, PaymentStatus, MerchantApprovalStatus, ProductApprovalStatus, TicketStatus, …). Never write a bare status string literal.

## Auth & guards
- A global `JwtAuthGuard` + `RolesGuard` protect every route. Decorators from `src/common/decorators.ts`:
  - `@Public()` — no JWT required (guest browsing endpoints).
  - `@Roles(UserRole.X, …)` — restrict by role. `SUPER_ADMIN` automatically passes `ADMIN` checks.
  - `@CurrentUser() user: AuthUser` — `{ userId, role }` from the JWT.
  - `@GuestToken() token?: string` — the `x-guest-session` header.
- Resolve domain identities via `AccessService` (`src/common/access.service.ts`, globally provided):
  - `access.merchantContext(userId)` → `{ merchantId, isOwner, permissions }` (owner or active staff). Enforce staff permissions with `access.requirePermission(ctx, StaffPermission.X)`.
  - `access.customerId(userId)`, `access.riderByUser(userId)`, `access.merchantUserIds(merchantId)`.
- **Multi-tenancy is sacred**: merchants only see their own data; riders only their assigned orders; customers only their own orders.

## Shared services (all globally available — just inject)
- `PrismaService` — DB access.
- `NotificationsService.notify({userId,title,body,type,referenceId})` — persists + emits websocket. Types from `NotificationType` in constants.
- `AuditService.log({userId,role,action,entityType,entityId,oldValue,newValue})` — REQUIRED for all admin and financial mutations.
- `RealtimeService.emitToUser/Order/Merchant/Rider/Admins(event, data)`.
- `PricingService` — delivery/service/small-order fees + commission math.
- From `OrdersModule` (import the module): `OrderStatusService.apply(orderId, status, {userId, role, notes})` — the ONLY way to change order status (writes timeline + realtime). `OrdersService.restoreStock(orderId)`, `refundIfPaid(anchorOrderId, customerId, reason)`.

## Controller conventions
- Global prefix is `api` (do not repeat it in `@Controller()` paths).
- DTO validation with class-validator; `ValidationPipe({ whitelist: true, transform: true })` is global. Use `@Type(() => Number)` on numeric query params.
- Pagination: use `parsePage`/`paged` from `src/common/utils/pagination.ts`; accept `page`/`pageSize` query params.
- List endpoints must use `select`/`include` deliberately — never leak `passwordHash`, `deliveryOtp`, or other users' personal data.
- Swagger: add `@ApiTags('…')` per controller; nothing more is required.

## Error style
- `NotFoundException` for missing/foreign rows, `ForbiddenException` for tenancy violations, `BadRequestException` with a human-readable message for business rule failures.

## File layout per module
`src/<module>/<module>.module.ts`, `<module>.controller.ts`, `<module>.service.ts`, `<module>.dto.ts` (optional split). Look at `src/orders/` and `src/cart/` for the house style.

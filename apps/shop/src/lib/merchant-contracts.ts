import { ApiError } from './api';

type RecordValue = Record<string, unknown>;
const record = (value: unknown): value is RecordValue => !!value && typeof value === 'object' && !Array.isArray(value);
const string = (value: unknown): value is string => typeof value === 'string';
const number = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

function invalid(name: string): never { throw new ApiError('contract', `The merchant service returned an unexpected ${name} response.`); }

export type MerchantProfile = {
  id: string;
  shopName: string;
  isOwner: boolean;
  permissions: string[];
  isOnline: boolean;
  isOpen: boolean;
  approvalStatus: string;
};

export function readProfile(value: unknown): MerchantProfile {
  if (!record(value) || !string(value.id) || !string(value.shopName) || typeof value.isOwner !== 'boolean' ||
      !Array.isArray(value.permissions) || !value.permissions.every(string) || typeof value.isOnline !== 'boolean' ||
      typeof value.isOpen !== 'boolean' || !string(value.approvalStatus)) invalid('profile');
  return value as MerchantProfile;
}

export type DashboardSummary = {
  todayOrders: number;
  pendingOrders: number;
  preparingOrders: number;
  readyOrders: number;
  activeDeliveries: number;
  lowStockProducts: number;
  isOnline: boolean;
  isOpen: boolean;
  approvalStatus: string;
};

export function readDashboard(value: unknown): DashboardSummary {
  if (!record(value) || !number(value.todayOrders) || !number(value.pendingOrders) ||
      !number(value.preparingOrders) || !number(value.readyOrders) || !number(value.activeDeliveries) ||
      !number(value.lowStockProducts) || typeof value.isOnline !== 'boolean' ||
      typeof value.isOpen !== 'boolean' || !string(value.approvalStatus)) invalid('dashboard');
  return value as DashboardSummary;
}

export type MerchantOrder = {
  id: string;
  orderNumber: string;
  status: string;
  createdAt: string;
  totalAmountPaisa: number;
  subtotalPaisa: number;
  deliveryFeePaisa: number;
  items: Array<{ id: string; quantity: number; productNameSnapshot: string; totalPricePaisa: number; itemStatus?: string }>;
  customer?: { user?: { fullName?: string | null; phoneNumber?: string | null } };
  rider?: { id: string; fullName: string; phoneNumber?: string | null } | null;
  deliveryAddress?: { label?: string | null; fullAddress?: string | null; city?: string | null; contactName?: string | null; contactPhone?: string | null; instructions?: string | null } | null;
  customerNote?: string | null;
  timeline?: Array<{ id: string; status: string; createdAt: string; changedByRole?: string | null; notes?: string | null }>;
};

export function readOrder(value: unknown): MerchantOrder {
  if (!record(value) || !string(value.id) || !string(value.orderNumber) || !string(value.status) ||
      !string(value.createdAt) || !number(value.totalAmountPaisa) || !number(value.subtotalPaisa) ||
      !number(value.deliveryFeePaisa) || !Array.isArray(value.items) ||
      !value.items.every((item) => record(item) && string(item.id) && number(item.quantity) && string(item.productNameSnapshot) && number(item.totalPricePaisa))) invalid('order');
  return value as MerchantOrder;
}

export function readOrders(value: unknown): MerchantOrder[] {
  if (!Array.isArray(value)) invalid('order list');
  return value.map(readOrder);
}

export type MerchantRider = {
  id: string;
  fullName: string;
  phoneNumber: string;
  vehicleType: string;
  vehicleNumber?: string | null;
  isOnline: boolean;
  isActive: boolean;
  approvalStatus: string;
  currentStatus?: string | null;
  currentOrderId?: string | null;
};

export function readRider(value: unknown): MerchantRider {
  if (!record(value) || !string(value.id) || !string(value.fullName) || !string(value.phoneNumber) ||
      !string(value.vehicleType) || typeof value.isOnline !== 'boolean' || typeof value.isActive !== 'boolean' ||
      !string(value.approvalStatus)) invalid('rider');
  return value as MerchantRider;
}

export function readRiders(value: unknown): MerchantRider[] {
  if (!Array.isArray(value)) invalid('rider list');
  return value.map(readRider);
}

export type RiderOrder = { id: string; orderNumber: string; status: string; totalAmountPaisa: number; createdAt: string };
export function readRiderOrders(value: unknown): RiderOrder[] {
  if (!Array.isArray(value) || !value.every((order) => record(order) && string(order.id) &&
      string(order.orderNumber) && string(order.status) && number(order.totalAmountPaisa) && string(order.createdAt))) invalid('rider orders');
  return value as RiderOrder[];
}

export function can(profile: MerchantProfile | null, permission: 'ORDERS' | 'RIDERS' | 'STORE'): boolean {
  return !!profile && (profile.isOwner || profile.permissions.includes(permission));
}

export function assignableRider(rider: MerchantRider): boolean {
  return rider.isActive && rider.approvalStatus === 'APPROVED';
}

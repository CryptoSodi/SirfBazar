import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export interface OwnerLockIds {
  customerIds?: string[];
  guestSessionIds?: string[];
}

/** Every cart, address and checkout writer takes owner locks in this order. */
export async function lockOwners(tx: Prisma.TransactionClient, ids: OwnerLockIds) {
  for (const id of [...new Set(ids.customerIds ?? [])].sort()) {
    const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT id FROM "Customer" WHERE id = ${id} FOR UPDATE`);
    if (rows.length !== 1) throw new ConflictException('Customer session changed. Refresh and try again.');
  }
  for (const id of [...new Set(ids.guestSessionIds ?? [])].sort()) {
    const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT id FROM "GuestSession" WHERE id = ${id} FOR UPDATE`);
    if (rows.length !== 1) throw new ConflictException('Guest basket changed. Refresh and try again.');
  }
}

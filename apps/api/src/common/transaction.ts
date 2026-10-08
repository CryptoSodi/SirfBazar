import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** Retry only database serialization/deadlock conflicts, never domain errors. */
export async function serializable<T>(
  prisma: PrismaService,
  work: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(work, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5_000,
        timeout: 15_000,
      });
    } catch (error: any) {
      const retryable = error?.code === 'P2034' || error?.code === '40P01' || error?.code === '40001';
      if (!retryable || attempt >= 2) throw error;
      await new Promise((resolve) => setTimeout(resolve, 25 * (attempt + 1) + Math.floor(Math.random() * 20)));
    }
  }
}

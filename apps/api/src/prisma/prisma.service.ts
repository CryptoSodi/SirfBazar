import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('Prisma');

  /**
   * Retry the initial DB connection instead of crashing the whole API if the
   * database isn't ready yet (e.g. Postgres still starting after a reboot).
   */
  async onModuleInit() {
    const maxAttempts = Number(process.env.DB_CONNECT_RETRIES || 10);
    const delayMs = Number(process.env.DB_CONNECT_RETRY_DELAY_MS || 3000);
    for (let attempt = 1; ; attempt++) {
      try {
        await this.$connect();
        if (attempt > 1) this.logger.log(`Connected to database on attempt ${attempt}`);
        return;
      } catch (err: any) {
        if (attempt >= maxAttempts) {
          this.logger.error(`Could not reach the database after ${maxAttempts} attempts: ${err.message}`);
          throw err;
        }
        this.logger.warn(
          `Database not reachable (attempt ${attempt}/${maxAttempts}) — retrying in ${delayMs}ms…`,
        );
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

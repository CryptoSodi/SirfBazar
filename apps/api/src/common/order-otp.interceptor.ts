import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { OrderStatus, UserRole } from './constants';

const REVEAL = new Set<string>([
  OrderStatus.PICKED_UP,
  OrderStatus.ON_THE_WAY,
  OrderStatus.RIDER_ARRIVED_AT_CUSTOMER,
]);

/** Defense-in-depth for every response containing nested order records. */
@Injectable()
export class OrderOtpInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const customerOrderRoute = request.user?.role === UserRole.CUSTOMER &&
      /^\/api\/orders(?:\/|$)/.test(request.path ?? request.url ?? '');
    const project = (value: any): any => {
      if (Array.isArray(value)) return value.map(project);
      if (!value || typeof value !== 'object' || value instanceof Date || Buffer.isBuffer(value)) return value;
      const result: Record<string, unknown> = {};
      for (const [key, child] of Object.entries(value)) {
        if (key === 'deliveryOtp' && (!customerOrderRoute || !REVEAL.has(value.status))) {
          result[key] = null;
        } else {
          result[key] = project(child);
        }
      }
      return result;
    };
    return next.handle().pipe(map(project));
  }
}

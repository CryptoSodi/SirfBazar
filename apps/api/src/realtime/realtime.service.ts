import { Injectable } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway';

/** Thin emit helpers so feature services never touch Socket.IO directly. */
@Injectable()
export class RealtimeService {
  constructor(private readonly gateway: RealtimeGateway) {}

  private emit(room: string, event: string, data: unknown) {
    this.gateway.server?.to(room).emit(event, data);
  }

  emitToUser(userId: string, event: string, data: unknown) {
    this.emit(`user:${userId}`, event, data);
  }
  emitToOrder(orderId: string, event: string, data: unknown) {
    this.emit(`order:${orderId}`, event, data);
  }
  emitToMerchant(merchantId: string, event: string, data: unknown) {
    this.emit(`merchant:${merchantId}`, event, data);
  }
  emitToRider(riderId: string, event: string, data: unknown) {
    this.emit(`rider:${riderId}`, event, data);
  }
  emitToAdmins(event: string, data: unknown) {
    this.emit('admin', event, data);
  }
}

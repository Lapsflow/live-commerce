import { APIRequestContext } from '@playwright/test';

const BASE_URL = 'https://live-commerce-opal.vercel.app';
const POST_HEADERS = {
  'Origin': BASE_URL,
  'Content-Type': 'application/json',
};

export class OrderApiHelper {
  constructor(private request: APIRequestContext) {}

  async getStats() {
    const response = await this.request.get('/api/orders/stats');
    return { response, data: await response.json() };
  }

  async getOrders(params?: { search?: string; pageIndex?: number; pageSize?: number }) {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.pageIndex !== undefined) query.set('pageIndex', String(params.pageIndex));
    if (params?.pageSize !== undefined) query.set('pageSize', String(params.pageSize));
    const url = `/api/orders${query.toString() ? '?' + query.toString() : ''}`;
    const response = await this.request.get(url);
    return { response, data: await response.json() };
  }

  async getOrder(orderId: string) {
    const response = await this.request.get(`/api/orders/${orderId}`);
    return { response, data: await response.json() };
  }

  async confirmPayment(orderId: string) {
    const response = await this.request.post(`/api/orders/${orderId}/confirm-payment`, {
      headers: POST_HEADERS,
    });
    return { response, data: await response.json() };
  }

  async cancelOrder(orderId: string) {
    const response = await this.request.post(`/api/orders/${orderId}/cancel`, {
      headers: POST_HEADERS,
    });
    return { response, data: await response.json() };
  }

  async exportOrders(type: 'wms' | 'center') {
    const response = await this.request.get(`/api/orders/export?type=${type}`);
    return { response };
  }

  async findOrderByStatus(status: string, paymentStatus?: string): Promise<any | null> {
    const { data } = await this.getOrders({ pageSize: 50 });
    if (!data?.data) return null;
    return data.data.find((o: any) => {
      if (o.status !== status) return false;
      if (paymentStatus && o.paymentStatus !== paymentStatus) return false;
      return true;
    }) ?? null;
  }

  async findPendingUnpaidOrder(): Promise<any | null> {
    return this.findOrderByStatus('PENDING', 'UNPAID');
  }

  async findApprovedPaidOrder(): Promise<any | null> {
    return this.findOrderByStatus('APPROVED', 'PAID');
  }

  async findRejectedOrder(): Promise<any | null> {
    return this.findOrderByStatus('REJECTED');
  }
}

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('jsonwebtoken', () => {
  const jwt = {
    sign: (payload: any, _secret: string, _opts?: any) => {
      const base64 = Buffer.from(JSON.stringify(payload)).toString('base64');
      return `mock.${base64}.sig`;
    },
    verify: (token: string, _secret: string) => {
      const parts = token.split('.');
      if (parts.length !== 3) throw new Error('jwt malformed');
      return JSON.parse(Buffer.from(parts[1], 'base64').toString());
    },
    decode: (token: string) => {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      return JSON.parse(Buffer.from(parts[1], 'base64').toString());
    },
  };
  return { default: jwt, ...jwt };
});

import jwt from 'jsonwebtoken';
import paymentRoutes from '../../routes/payment';
import membershipRoutes from '../../routes/membership';
import { mockPrisma, resetPrismaMocks } from '../../../tests/helpers/prisma-mock';

vi.mock('../../index', async () => {
  const db = await import('../../db');
  return { prisma: db.prisma };
});

vi.mock('../../utils/websocket', () => ({
  wsServer: { notifyUser: vi.fn() },
}));

const authToken = jwt.sign({ userId: 1 }, 'ignored');

function createPaymentApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/payment', paymentRoutes);
  return app;
}

function createMembershipApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/membership', membershipRoutes);
  return app;
}

// ===========================================================================
// H1: discountCode must NOT reduce the price
// ===========================================================================
describe('H1: discount code does not reduce price', () => {
  beforeEach(() => {
    resetPrismaMocks();
    mockPrisma.users.findUnique.mockResolvedValue({ has_used_trial: false });
    mockPrisma.orders.create.mockImplementation(async ({ data }: any) => ({
      id: data.id,
      ...data,
    }));
  });

  describe('POST /api/payment/membership/create', () => {
    const app = createPaymentApp();

    it('ignores discountCode and charges full price', async () => {
      const res = await request(app)
        .post('/api/payment/membership/create')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ tier: 'monthly', discountCode: 'HACK50' });

      expect(res.status).toBe(200);
      expect(res.body.originalPrice).toBe(39);
      expect(res.body.discountAmount).toBe(0);
      expect(res.body.finalPrice).toBe(39);
    });

    it('charges full price even without discountCode', async () => {
      const res = await request(app)
        .post('/api/payment/membership/create')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ tier: 'monthly' });

      expect(res.status).toBe(200);
      expect(res.body.finalPrice).toBe(39);
      expect(res.body.discountAmount).toBe(0);
    });
  });

  describe('POST /api/membership/upgrade/create', () => {
    const app = createMembershipApp();

    it('ignores discountCode and charges full price', async () => {
      const res = await request(app)
        .post('/api/membership/upgrade/create')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ tier: 'monthly', discountCode: 'HACK50' });

      expect(res.status).toBe(200);
      expect(res.body.originalPrice).toBe(39);
      expect(res.body.discountAmount).toBe(0);
      expect(res.body.finalPrice).toBe(39);
    });

    it('charges full price even without discountCode', async () => {
      const res = await request(app)
        .post('/api/membership/upgrade/create')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ tier: 'monthly' });

      expect(res.status).toBe(200);
      expect(res.body.finalPrice).toBe(39);
      expect(res.body.discountAmount).toBe(0);
    });
  });
});

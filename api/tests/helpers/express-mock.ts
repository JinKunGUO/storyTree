import { vi } from 'vitest'
import { Request, Response, NextFunction } from 'express'

export function mockRequest(overrides: Partial<Request> = {}): Request {
  return {
    headers: {},
    params: {},
    query: {},
    body: {},
    ip: '127.0.0.1',
    userId: undefined,
    username: undefined,
    isAdmin: undefined,
    ...overrides,
  } as unknown as Request
}

export function mockResponse(): Response {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
    setHeader: vi.fn(),
  } as unknown as Response
}

export function mockNext(): NextFunction {
  return vi.fn() as unknown as NextFunction
}
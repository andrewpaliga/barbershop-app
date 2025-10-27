import { vi } from 'vitest';

/**
 * Mock API responses for Gadget API calls
 */
export const createMockApi = () => {
  return {
    staff: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findOne: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    shopifyProduct: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findOne: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    shopifyProductVariant: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    booking: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findOne: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    config: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findOne: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    shopifyShop: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findOne: vi.fn(),
    },
    shopifyLocation: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    staffAvailability: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
  };
};

/**
 * Mock Shopify connections
 */
export const createMockConnections = () => {
  return {
    shopify: {
      currentShopId: 'test-shop-id',
      forShopId: vi.fn().mockResolvedValue({
        graphql: vi.fn(),
        rest: vi.fn(),
      }),
    },
  };
};

/**
 * Mock action context
 */
export const createMockActionContext = () => {
  const mockLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };

  return {
    params: {},
    logger: mockLogger,
    api: createMockApi(),
    connections: createMockConnections(),
    trigger: null,
  };
};


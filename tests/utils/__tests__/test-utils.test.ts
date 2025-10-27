import { describe, it, expect } from 'vitest';
import { createMockApi, createMockActionContext, createMockConnections } from '../mock-api';

describe('Test Utilities', () => {
  describe('createMockApi', () => {
    it('should create a mock API object', () => {
      const mockApi = createMockApi();
      
      expect(mockApi).toBeDefined();
      expect(mockApi.staff).toBeDefined();
      expect(mockApi.staff.findMany).toBeDefined();
      expect(mockApi.staff.findFirst).toBeDefined();
      expect(mockApi.staff.create).toBeDefined();
      expect(mockApi.staff.update).toBeDefined();
      expect(mockApi.staff.delete).toBeDefined();
    });

    it('should create mock methods for all models', () => {
      const mockApi = createMockApi();
      
      expect(mockApi.shopifyProduct).toBeDefined();
      expect(mockApi.booking).toBeDefined();
      expect(mockApi.config).toBeDefined();
      expect(mockApi.shopifyShop).toBeDefined();
    });

    it('should create callable mock functions', () => {
      const mockApi = createMockApi();
      
      expect(typeof mockApi.staff.findMany).toBe('function');
      expect(typeof mockApi.staff.create).toBe('function');
      expect(typeof mockApi.staff.update).toBe('function');
    });
  });

  describe('createMockConnections', () => {
    it('should create a mock connections object', () => {
      const mockConnections = createMockConnections();
      
      expect(mockConnections).toBeDefined();
      expect(mockConnections.shopify).toBeDefined();
      expect(mockConnections.shopify.currentShopId).toBe('test-shop-id');
      expect(mockConnections.shopify.forShopId).toBeDefined();
    });

    it('should provide a callable forShopId method', async () => {
      const mockConnections = createMockConnections();
      
      const result = await mockConnections.shopify.forShopId('test-shop');
      
      expect(result).toBeDefined();
      expect(result.graphql).toBeDefined();
      expect(result.rest).toBeDefined();
    });
  });

  describe('createMockActionContext', () => {
    it('should create a mock action context', () => {
      const mockContext = createMockActionContext();
      
      expect(mockContext).toBeDefined();
      expect(mockContext.params).toBeDefined();
      expect(mockContext.logger).toBeDefined();
      expect(mockContext.api).toBeDefined();
      expect(mockContext.connections).toBeDefined();
      expect(mockContext.trigger).toBeDefined();
    });

    it('should provide logger methods', () => {
      const mockContext = createMockActionContext();
      
      expect(mockContext.logger.info).toBeDefined();
      expect(mockContext.logger.warn).toBeDefined();
      expect(mockContext.logger.error).toBeDefined();
      expect(mockContext.logger.debug).toBeDefined();
    });

    it('should provide API methods', () => {
      const mockContext = createMockActionContext();
      
      expect(mockContext.api.staff.findMany).toBeDefined();
      expect(mockContext.api.shopifyProduct.findMany).toBeDefined();
      expect(mockContext.api.booking.findMany).toBeDefined();
    });
  });
});


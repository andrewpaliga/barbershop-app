import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockActionContext } from '../../../tests/utils/mock-api';

describe('createService Action', () => {
  let mockContext: ReturnType<typeof createMockActionContext>;

  beforeEach(() => {
    mockContext = createMockActionContext();
  });

  describe('Single duration mode', () => {
    it('should create a service with single duration', async () => {
      const { run } = await import('../createService');
      
      const mockProductResult = {
        productSet: {
          product: {
            id: 'gid://shopify/Product/123',
            title: 'Haircut',
            handle: 'haircut',
            status: 'ACTIVE',
            options: [
              {
                id: 'opt1',
                name: 'Duration',
                values: ['30 minutes']
              }
            ],
            variants: {
              edges: [
                {
                  node: {
                    id: 'gid://shopify/ProductVariant/123',
                    selectedOptions: [
                      { name: 'Duration', value: '30 minutes' }
                    ],
                    price: '50.00'
                  }
                }
              ]
            }
          },
          userErrors: []
        }
      };

      const mockPublicationsResult = {
        publications: {
          edges: [
            { node: { id: 'gid://shopify/Publication/1', name: 'Online Store' } },
            { node: { id: 'gid://shopify/Publication/2', name: 'Point of Sale' } }
          ]
        }
      };

      mockContext.params = {
        name: 'Haircut',
        description: 'Professional haircut service',
        duration: 30,
        price: 50,
        shopId: 'test-shop-id'
      };

      mockContext.connections.shopify.forShopId = vi.fn().mockResolvedValue({
        graphql: vi.fn()
          .mockResolvedValueOnce(mockProductResult)
          .mockResolvedValueOnce({ product: { variants: { edges: [] } } })
          .mockResolvedValueOnce({ metafieldsSet: { metafields: [], userErrors: [] } })
          .mockResolvedValueOnce(mockPublicationsResult)
          .mockResolvedValueOnce({ publishablePublish: { userErrors: [] } })
      });

      const result = await run(mockContext);

      expect(result.success).toBe(true);
      expect(result.mode).toBe('single');
      expect(result.product.title).toBe('Haircut');
    });

    it('should validate required parameters for single mode', async () => {
      const { run } = await import('../createService');
      
      mockContext.params = {
        name: '',
        duration: 30,
        price: 50
      };

      await expect(run(mockContext)).rejects.toThrow('Service name is required');
    });

    it('should validate duration is positive', async () => {
      const { run } = await import('../createService');
      
      mockContext.params = {
        name: 'Test',
        duration: -10,
        price: 50
      };

      await expect(run(mockContext)).rejects.toThrow('Duration must be a positive number');
    });

    it('should validate price is non-negative', async () => {
      const { run } = await import('../createService');
      
      mockContext.params = {
        name: 'Test',
        duration: 30,
        price: -10
      };

      await expect(run(mockContext)).rejects.toThrow('Price must be a non-negative number');
    });
  });

  describe('Multi duration mode', () => {
    it('should create a service with multiple durations', async () => {
      const { run } = await import('../createService');
      
      const mockProductResult = {
        productSet: {
          product: {
            id: 'gid://shopify/Product/123',
            title: 'Haircut',
            handle: 'haircut',
            status: 'ACTIVE',
            options: [
              {
                id: 'opt1',
                name: 'Duration',
                values: ['30 minutes', '60 minutes']
              }
            ],
            variants: {
              edges: [
                {
                  node: {
                    id: 'gid://shopify/ProductVariant/123',
                    selectedOptions: [
                      { name: 'Duration', value: '30 minutes' }
                    ],
                    price: '50.00'
                  }
                },
                {
                  node: {
                    id: 'gid://shopify/ProductVariant/456',
                    selectedOptions: [
                      { name: 'Duration', value: '60 minutes' }
                    ],
                    price: '80.00'
                  }
                }
              ]
            }
          },
          userErrors: []
        }
      };

      mockContext.params = {
        name: 'Haircut',
        description: 'Professional haircut service',
        durations: [30, 60],
        durationPrices: { 30: 50, 60: 80 },
        shopId: 'test-shop-id'
      };

      mockContext.connections.shopify.forShopId = vi.fn().mockResolvedValue({
        graphql: vi.fn()
          .mockResolvedValueOnce(mockProductResult)
          .mockResolvedValueOnce({ product: { variants: { edges: [] } } })
          .mockResolvedValueOnce({ metafieldsSet: { metafields: [], userErrors: [] } })
      });

      const result = await run(mockContext);

      expect(result.success).toBe(true);
      expect(result.mode).toBe('multi');
      expect(result.product.variants).toHaveLength(2);
    });

    it('should validate durations array is not empty', async () => {
      const { run } = await import('../createService');
      
      mockContext.params = {
        name: 'Test',
        durations: [],
        durationPrices: {}
      };

      await expect(run(mockContext)).rejects.toThrow('At least one duration is required');
    });

    it('should validate all durations have prices', async () => {
      const { run } = await import('../createService');
      
      mockContext.params = {
        name: 'Test',
        durations: [30, 60],
        durationPrices: { 30: 50 }
      };

      await expect(run(mockContext)).rejects.toThrow('Price not provided for duration 60');
    });

    it('should validate duration prices are non-negative', async () => {
      const { run } = await import('../createService');
      
      mockContext.params = {
        name: 'Test',
        durations: [30],
        durationPrices: { 30: -10 }
      };

      await expect(run(mockContext)).rejects.toThrow('Price for duration 30 must be a non-negative number');
    });
  });

  it('should handle missing parameters', async () => {
    const { run } = await import('../createService');
    
    mockContext.params = null;

    await expect(run(mockContext)).rejects.toThrow('No parameters provided');
  });

  it('should handle missing shop ID', async () => {
    const { run } = await import('../createService');
    
    mockContext.params = {
      name: 'Test',
      duration: 30,
      price: 50
    };
    mockContext.connections.shopify.currentShopId = null;

    await expect(run(mockContext)).rejects.toThrow('No shop context available');
  });

  it('should require either single or multi mode parameters', async () => {
    const { run } = await import('../createService');
    
    mockContext.params = {
      name: 'Test'
    };

    await expect(run(mockContext)).rejects.toThrow('Either duration+price (single mode) or durations+durationPrices (multi mode) must be provided');
  });
});


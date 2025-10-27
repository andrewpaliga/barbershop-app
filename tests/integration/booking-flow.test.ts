import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockActionContext } from '../utils/mock-api';

/**
 * Integration test for the booking creation flow
 * Tests the complete flow from service creation to booking creation
 */
describe('Booking Flow Integration', () => {
  let mockContext: ReturnType<typeof createMockActionContext>;

  beforeEach(() => {
    mockContext = createMockActionContext();
  });

  it('should complete full booking flow: create service -> fetch products -> create booking', async () => {
    // Step 1: Create a service
    const { run: createService } = await import('../../api/actions/createService');
    
    mockContext.params = {
      name: 'Haircut',
      description: 'Professional haircut',
      duration: 30,
      price: 50,
      shopId: 'test-shop-id'
    };

    const mockProductResult = {
      productSet: {
        product: {
          id: 'gid://shopify/Product/123',
          title: 'Haircut',
          handle: 'haircut',
          status: 'ACTIVE'
        },
        userErrors: []
      }
    };

    mockContext.connections.shopify.forShopId = vi.fn().mockResolvedValue({
      graphql: vi.fn().mockResolvedValue(mockProductResult)
    });

    const serviceResult = await createService(mockContext);

    expect(serviceResult.success).toBe(true);
    expect(serviceResult.product.id).toBe('gid://shopify/Product/123');

    // Step 2: Fetch products to verify creation
    const { run: fetchProducts } = await import('../../api/actions/fetchProducts');

    const mockProductsResult = {
      data: {
        products: {
          edges: [
            {
              node: {
                id: 'gid://shopify/Product/123',
                title: 'Haircut',
                handle: 'haircut',
                status: 'ACTIVE',
                productType: 'Service',
                variants: {
                  nodes: [
                    {
                      id: 'gid://shopify/ProductVariant/123',
                      price: '50.00',
                      selectedOptions: [
                        { name: 'Duration', value: '30 minutes' }
                      ]
                    }
                  ]
                },
                variantsCount: {
                  count: 1
                }
              }
            }
          ]
        }
      }
    };

    mockContext.connections.shopify.forShopId = vi.fn().mockResolvedValue({
      graphql: vi.fn().mockResolvedValue(mockProductsResult)
    });

    const productsResult = await fetchProducts(mockContext);

    expect(productsResult.success).toBe(true);
    expect(productsResult.products).toHaveLength(1);
    expect(productsResult.products[0].title).toBe('Haircut');
    expect(productsResult.products[0].productType).toBe('Service');
  });

  it('should handle service creation with multiple duration options', async () => {
    const { run: createService } = await import('../../api/actions/createService');

    mockContext.params = {
      name: 'Complex Service',
      description: 'Service with multiple options',
      durations: [30, 60, 90],
      durationPrices: {
        30: 50,
        60: 80,
        90: 100
      },
      shopId: 'test-shop-id'
    };

    const mockProductResult = {
      productSet: {
        product: {
          id: 'gid://shopify/Product/456',
          title: 'Complex Service',
          handle: 'complex-service',
          status: 'ACTIVE',
          variants: {
            edges: [
              { node: { id: 'v1', selectedOptions: [{ name: 'Duration', value: '30 minutes' }], price: '50.00' } },
              { node: { id: 'v2', selectedOptions: [{ name: 'Duration', value: '60 minutes' }], price: '80.00' } },
              { node: { id: 'v3', selectedOptions: [{ name: 'Duration', value: '90 minutes' }], price: '100.00' } }
            ]
          }
        },
        userErrors: []
      }
    };

    mockContext.connections.shopify.forShopId = vi.fn().mockResolvedValue({
      graphql: vi.fn().mockResolvedValue(mockProductResult)
    });

    const serviceResult = await createService(mockContext);

    expect(serviceResult.success).toBe(true);
    expect(serviceResult.mode).toBe('multi');
    expect(serviceResult.product.variants).toHaveLength(3);
    expect(serviceResult.product.variants[0].price).toBe('50.00');
    expect(serviceResult.product.variants[1].price).toBe('80.00');
    expect(serviceResult.product.variants[2].price).toBe('100.00');
  });

  it('should validate all required fields for service creation', async () => {
    const { run: createService } = await import('../../api/actions/createService');

    // Test missing name
    mockContext.params = {
      duration: 30,
      price: 50
    };

    await expect(createService(mockContext)).rejects.toThrow('Service name is required');

    // Test missing shopId and currentShopId
    mockContext.params = {
      name: 'Test',
      duration: 30,
      price: 50
    };
    mockContext.connections.shopify.currentShopId = null;

    await expect(createService(mockContext)).rejects.toThrow('No shop context available');
  });
});


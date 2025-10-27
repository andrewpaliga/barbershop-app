import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockActionContext } from '../../../tests/utils/mock-api';

// Mock the action file
vi.mock('../fetchProducts', async () => {
  const actual = await vi.importActual('../fetchProducts');
  return actual;
});

describe('fetchProducts Action', () => {
  let mockContext: ReturnType<typeof createMockActionContext>;

  beforeEach(() => {
    mockContext = createMockActionContext();
  });

  it('should fetch products from Shopify', async () => {
    const { run } = await import('../fetchProducts');
    
    const mockGraphqlResult = {
      data: {
        products: {
          edges: [
            {
              node: {
                id: 'gid://shopify/Product/1',
                title: 'Haircut',
                handle: 'haircut',
                status: 'ACTIVE',
                productType: 'Service',
                variants: {
                  nodes: [
                    {
                      id: 'gid://shopify/ProductVariant/1',
                      price: '30.00',
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
      graphql: vi.fn().mockResolvedValue(mockGraphqlResult)
    });

    const result = await run(mockContext);

    expect(result.success).toBe(true);
    expect(result.products).toHaveLength(1);
    expect(result.products[0].productType).toBe('Service');
    expect(result.products[0].title).toBe('Haircut');
  });

  it('should filter products to only services', async () => {
    const { run } = await import('../fetchProducts');
    
    const mockGraphqlResult = {
      data: {
        products: {
          edges: [
            {
              node: {
                id: 'gid://shopify/Product/1',
                title: 'Haircut',
                handle: 'haircut',
                status: 'ACTIVE',
                productType: 'Service',
                variants: { nodes: [] },
                variantsCount: { count: 0 }
              }
            },
            {
              node: {
                id: 'gid://shopify/Product/2',
                title: 'Shampoo Product',
                handle: 'shampoo',
                status: 'ACTIVE',
                productType: 'Product',
                variants: { nodes: [] },
                variantsCount: { count: 0 }
              }
            }
          ]
        }
      }
    };

    mockContext.connections.shopify.forShopId = vi.fn().mockResolvedValue({
      graphql: vi.fn().mockResolvedValue(mockGraphqlResult)
    });

    const result = await run(mockContext);

    expect(result.success).toBe(true);
    expect(result.products).toHaveLength(1);
    expect(result.products[0].productType).toBe('Service');
  });

  it('should handle missing shop ID', async () => {
    const { run } = await import('../fetchProducts');
    
    mockContext.connections.shopify.currentShopId = null;

    await expect(run(mockContext)).rejects.toThrow('No shop context available');
  });

  it('should return empty array when no products found', async () => {
    const { run } = await import('../fetchProducts');
    
    const mockGraphqlResult = {
      data: {
        products: {
          edges: []
        }
      }
    };

    mockContext.connections.shopify.forShopId = vi.fn().mockResolvedValue({
      graphql: vi.fn().mockResolvedValue(mockGraphqlResult)
    });

    const result = await run(mockContext);

    expect(result.success).toBe(true);
    expect(result.products).toHaveLength(0);
  });

  it('should handle Shopify API errors', async () => {
    const { run } = await import('../fetchProducts');
    
    mockContext.connections.shopify.forShopId = vi.fn().mockResolvedValue({
      graphql: vi.fn().mockRejectedValue(new Error('GraphQL API Error'))
    });

    await expect(run(mockContext)).rejects.toThrow('Failed to fetch products');
  });

  it('should return all variant information', async () => {
    const { run } = await import('../fetchProducts');
    
    const mockGraphqlResult = {
      data: {
        products: {
          edges: [
            {
              node: {
                id: 'gid://shopify/Product/1',
                title: 'Multi-Duration Service',
                handle: 'multi-duration',
                status: 'ACTIVE',
                productType: 'Service',
                variants: {
                  nodes: [
                    {
                      id: 'gid://shopify/ProductVariant/1',
                      price: '30.00',
                      selectedOptions: [
                        { name: 'Duration', value: '30 minutes' }
                      ]
                    },
                    {
                      id: 'gid://shopify/ProductVariant/2',
                      price: '45.00',
                      selectedOptions: [
                        { name: 'Duration', value: '45 minutes' }
                      ]
                    }
                  ]
                },
                variantsCount: {
                  count: 2
                }
              }
            }
          ]
        }
      }
    };

    mockContext.connections.shopify.forShopId = vi.fn().mockResolvedValue({
      graphql: vi.fn().mockResolvedValue(mockGraphqlResult)
    });

    const result = await run(mockContext);

    expect(result.success).toBe(true);
    expect(result.products[0].variants.nodes).toHaveLength(2);
    expect(result.products[0].variants.nodes[0].price).toBe('30.00');
    expect(result.products[0].variants.nodes[1].price).toBe('45.00');
  });
});


import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockActionContext } from '../../../tests/utils/mock-api';

describe('handleProductUpdate Action', () => {
  let mockContext: ReturnType<typeof createMockActionContext>;
  const mockProductId = 'gid://shopify/Product/123';
  const mockVariantId = 'gid://shopify/ProductVariant/456';
  const mockInventoryItemId = 'gid://shopify/InventoryItem/789';

  beforeEach(() => {
    mockContext = createMockActionContext();
    mockContext.trigger = {
      type: 'shopify',
      payload: {
        id: '123',
        title: 'Test Product',
        images: [
          {
            id: 'image1',
            src: 'https://example.com/image.jpg',
            alt: 'Test image',
            width: 1000,
            height: 1000
          }
        ],
        variants: [
          {
            id: '456',
            image_id: 'image1'
          }
        ]
      }
    } as any;
  });

  it('should update product images when webhook is received', async () => {
    const { run } = await import('../handleProductUpdate');

    const mockProduct = {
      id: mockProductId,
      title: 'Test Product',
      images: [],
      variants: {
        edges: [
          {
            node: {
              id: mockVariantId,
              image: null
            }
          }
        ]
      }
    };

    mockContext.api.shopifyProduct.findFirst = vi.fn().mockResolvedValue(mockProduct);
    mockContext.api.shopifyProduct.update = vi.fn().mockResolvedValue({
      ...mockProduct,
      images: [{ id: 'image1', src: 'https://example.com/image.jpg' }]
    });
    mockContext.api.shopifyProductVariant.findFirst = vi.fn().mockResolvedValue({
      id: mockVariantId,
      image: null
    });
    mockContext.api.internal = {
      shopifyProductVariant: {
        update: vi.fn().mockResolvedValue({ id: mockVariantId })
      }
    } as any;

    const result = await run(mockContext);

    expect(result.success).toBe(true);
    expect(mockContext.api.shopifyProduct.findFirst).toHaveBeenCalled();
    expect(mockContext.api.shopifyProduct.update).toHaveBeenCalled();
  });

  it('should handle missing webhook payload', async () => {
    const { run } = await import('../handleProductUpdate');

    mockContext.trigger = { type: 'shopify', payload: null } as any;

    await expect(run(mockContext)).rejects.toThrow('No webhook payload found');
  });

  it('should handle missing shop ID', async () => {
    const { run } = await import('../handleProductUpdate');

    mockContext.connections.shopify.currentShopId = null;

    await expect(run(mockContext)).rejects.toThrow('No shop ID available');
  });

  it('should handle product not found in database', async () => {
    const { run } = await import('../handleProductUpdate');

    mockContext.api.shopifyProduct.findFirst = vi.fn().mockResolvedValue(null);

    const result = await run(mockContext);

    expect(result.success).toBe(false);
    expect(result.reason).toBe('Product not found');
  });

  it('should update variant images when provided', async () => {
    const { run } = await import('../handleProductUpdate');

    const mockProduct = {
      id: mockProductId,
      title: 'Test Product',
      images: [
        {
          id: 'image1',
          src: 'https://example.com/image.jpg',
          alt: 'Test image',
          width: 1000,
          height: 1000
        }
      ],
      variants: {
        edges: [
          {
            node: {
              id: mockVariantId,
              image: null
            }
          }
        ]
      }
    };

    mockContext.api.shopifyProduct.findFirst = vi.fn().mockResolvedValue(mockProduct);
    mockContext.api.shopifyProduct.update = vi.fn().mockResolvedValue(mockProduct);
    mockContext.api.shopifyProductVariant.findFirst = vi.fn().mockResolvedValue({
      id: mockVariantId,
      image: null
    });
    mockContext.api.internal = {
      shopifyProductVariant: {
        update: vi.fn().mockResolvedValue({ id: mockVariantId })
      }
    } as any;

    const result = await run(mockContext);

    expect(result.success).toBe(true);
    expect(result.variantsProcessed).toBe(1);
    expect(mockContext.api.internal.shopifyProductVariant.update).toHaveBeenCalled();
  });

  it('should clear variant image when image_id is null', async () => {
    const { run } = await import('../handleProductUpdate');

    mockContext.trigger = {
      type: 'shopify',
      payload: {
        id: '123',
        title: 'Test Product',
        images: [],
        variants: [
          {
            id: '456',
            image_id: null
          }
        ]
      }
    } as any;

    const mockProduct = {
      id: mockProductId,
      title: 'Test Product',
      images: [],
      variants: {
        edges: [
          {
            node: {
              id: mockVariantId,
              image: { url: 'https://old-image.jpg' }
            }
          }
        ]
      }
    };

    mockContext.api.shopifyProduct.findFirst = vi.fn().mockResolvedValue(mockProduct);
    mockContext.api.shopifyProduct.update = vi.fn().mockResolvedValue(mockProduct);
    mockContext.api.shopifyProductVariant.findFirst = vi.fn().mockResolvedValue({
      id: mockVariantId,
      image: { url: 'https://old-image.jpg' }
    });
    mockContext.api.internal = {
      shopifyProductVariant: {
        update: vi.fn().mockResolvedValue({ id: mockVariantId })
      }
    } as any;

    const result = await run(mockContext);

    expect(result.success).toBe(true);
    expect(mockContext.api.internal.shopifyProductVariant.update).toHaveBeenCalledWith(
      mockVariantId,
      { image: null }
    );
  });

  it('should handle multiple variants correctly', async () => {
    const { run } = await import('../handleProductUpdate');

    mockContext.trigger = {
      type: 'shopify',
      payload: {
        id: '123',
        title: 'Test Product',
        images: [
          {
            id: 'image1',
            src: 'https://example.com/image1.jpg'
          },
          {
            id: 'image2',
            src: 'https://example.com/image2.jpg'
          }
        ],
        variants: [
          {
            id: '456',
            image_id: 'image1'
          },
          {
            id: '789',
            image_id: 'image2'
          }
        ]
      }
    } as any;

    const mockProduct = {
      id: mockProductId,
      title: 'Test Product',
      images: [],
      variants: {
        edges: [
          { node: { id: 'gid://shopify/ProductVariant/456', image: null } },
          { node: { id: 'gid://shopify/ProductVariant/789', image: null } }
        ]
      }
    };

    mockContext.api.shopifyProduct.findFirst = vi.fn().mockResolvedValue(mockProduct);
    mockContext.api.shopifyProduct.update = vi.fn().mockResolvedValue(mockProduct);
    mockContext.api.shopifyProductVariant.findFirst = vi.fn()
      .mockResolvedValueOnce({ id: 'gid://shopify/ProductVariant/456', image: null })
      .mockResolvedValueOnce({ id: 'gid://shopify/ProductVariant/789', image: null });
    mockContext.api.internal = {
      shopifyProductVariant: {
        update: vi.fn().mockResolvedValue({ id: 'updated' })
      }
    } as any;

    const result = await run(mockContext);

    expect(result.success).toBe(true);
    expect(result.variantsProcessed).toBe(2);
    expect(mockContext.api.internal.shopifyProductVariant.update).toHaveBeenCalledTimes(2);
  });

  it('should handle variant not found gracefully', async () => {
    const { run } = await import('../handleProductUpdate');

    const mockProduct = {
      id: mockProductId,
      title: 'Test Product',
      images: [{ id: 'image1', src: 'https://example.com/image.jpg' }],
      variants: {
        edges: [
          {
            node: {
              id: mockVariantId,
              image: null
            }
          }
        ]
      }
    };

    mockContext.api.shopifyProduct.findFirst = vi.fn().mockResolvedValue(mockProduct);
    mockContext.api.shopifyProduct.update = vi.fn().mockResolvedValue(mockProduct);
    mockContext.api.shopifyProductVariant.findFirst = vi.fn().mockResolvedValue(null);

    const result = await run(mockContext);

    expect(result.success).toBe(true);
  });
});


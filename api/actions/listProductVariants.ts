export const run: ActionRun = async ({ params, logger, api, connections }) => {
  const shopId = connections.shopify.currentShopId;
  
  // Find all product variants for the current shop, limited to first 50
  const variants = await api.shopifyProductVariant.findMany({
    first: 50,
    filter: {
      shopId: { equals: shopId }
    },
    select: {
      id: true,
      title: true,
      price: true,
      sku: true,
      barcode: true,
      inventoryQuantity: true,
      product: {
        id: true,
        title: true
      }
    }
  });

  logger.info(`Found ${variants.length} product variants for shop ${shopId}`);
  
  // Log each variant with key details
  variants.forEach((variant, index) => {
    logger.info(`Variant ${index + 1}:`, {
      id: variant.id,
      title: variant.title,
      productTitle: variant.product?.title,
      price: variant.price,
      sku: variant.sku,
      barcode: variant.barcode,
      inventoryQuantity: variant.inventoryQuantity
    });
  });

  return variants;
};

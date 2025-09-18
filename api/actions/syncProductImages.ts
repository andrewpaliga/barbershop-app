export const run: ActionRun = async ({ params, logger, api, connections }) => {
  try {
    const { shopId } = params;
    
    logger.info("Starting product images sync", { shopId });

    // Get the shop record to get the domain
    const shop = await api.shopifyShop.findOne(shopId);
    if (!shop) {
      throw new Error(`Shop with ID ${shopId} not found`);
    }

    // Get authenticated Shopify client for this specific shop
    const shopify = await connections.shopify.forShopId(shopId);
    
    // GraphQL query to fetch products with images
    const query = `
      query($first: Int!) {
        products(first: $first) {
          nodes {
            id
            title
            productType
            images(first: 10) {
              nodes {
                id
                url
                altText
                width
                height
              }
            }
          }
        }
      }
    `;

    const results = [];
    let updatedCount = 0;
    let errorCount = 0;

    // Fetch products from Shopify
    const response = await shopify.graphql(query, { first: 250 });
    const products = response.products.nodes;

    logger.info(`Found ${products.length} products to process`);

    // Process each product
    for (const shopifyProduct of products) {
      try {
        // Extract Shopify product ID (remove gid prefix)
        const productId = shopifyProduct.id.replace('gid://shopify/Product/', '');
        
        // Find the corresponding product in Gadget
        const gadgetProduct = await api.shopifyProduct.maybeFindFirst({
          filter: {
            AND: [
              { id: { equals: productId } },
              { shopId: { equals: shopId } }
            ]
          }
        });

        if (gadgetProduct) {
          // Update the product's images field
          await api.shopifyProduct.update(productId, {
            images: shopifyProduct.images.nodes
          });

          updatedCount++;
          
          results.push({
            productId,
            title: shopifyProduct.title,
            imageCount: shopifyProduct.images.nodes.length,
            status: 'updated'
          });

          logger.info(`Updated images for product: ${shopifyProduct.title}`, {
            productId,
            imageCount: shopifyProduct.images.nodes.length
          });
        } else {
          logger.warn(`Product not found in Gadget database`, { productId });
          results.push({
            productId,
            title: shopifyProduct.title,
            status: 'not_found'
          });
        }

      } catch (error) {
        errorCount++;
        logger.error(`Failed to update product images`, {
          productId: shopifyProduct.id,
          error: error.message
        });

        results.push({
          productId: shopifyProduct.id,
          title: shopifyProduct.title,
          status: 'error',
          error: error.message
        });
      }
    }

    logger.info("Product images sync completed", {
      totalProducts: products.length,
      updated: updatedCount,
      errors: errorCount
    });

    return {
      success: true,
      message: `Updated images for ${updatedCount} products, ${errorCount} errors`,
      totalProducts: products.length,
      updatedCount,
      errorCount,
      results
    };

export const params = {
  shopId: { type: "string" }
};
  } catch (error) {
    logger.error("Failed to run product images sync", { error: error.message });
    throw error;
  }
};

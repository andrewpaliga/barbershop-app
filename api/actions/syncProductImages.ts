export const run: ActionRun = async ({ params, logger, api, connections }) => {
  const { shopDomain } = params;
  
  try {
    logger.info("Starting product images sync", { shopDomain });

    // Find shops to sync
    let shopsToSync;
    if (shopDomain) {
      // Sync specific shop by domain
      shopsToSync = await api.shopifyShop.findMany({
        filter: {
          OR: [
            { domain: { equals: shopDomain } },
            { myshopifyDomain: { equals: shopDomain } }
          ]
        },
        select: {
          id: true,
          name: true,
          domain: true,
          myshopifyDomain: true
        }
      });

      if (shopsToSync.length === 0) {
        logger.warn("No shop found with the provided domain", { shopDomain });
        return { success: false, message: `No shop found with domain: ${shopDomain}` };
      }
    } else {
      // Sync all shops
      shopsToSync = await api.shopifyShop.findMany({
        select: {
          id: true,
          name: true,
          domain: true,
          myshopifyDomain: true
        }
      });
    }

    logger.info(`Found ${shopsToSync.length} shop(s) to sync`);

    const results = [];

    // Process each shop
    for (const shop of shopsToSync) {
      try {
        logger.info(`Starting sync for shop: ${shop.name} (${shop.domain})`, { shopId: shop.id });

        // Create and run sync for products and variants
        const syncResult = await api.shopifySync.run({
          shop: { _link: shop.id },
          domain: shop.domain || shop.myshopifyDomain,
          models: ["shopifyProduct", "shopifyProductVariant"],
          force: false
        });

        logger.info(`Sync initiated for shop: ${shop.name}`, { 
          shopId: shop.id, 
          syncId: syncResult.id 
        });

        results.push({
          shopId: shop.id,
          shopName: shop.name,
          shopDomain: shop.domain,
          syncId: syncResult.id,
          status: 'initiated'
        });

      } catch (error) {
        logger.error(`Failed to sync shop: ${shop.name}`, { 
          shopId: shop.id, 
          error: error.message 
        });

        results.push({
          shopId: shop.id,
          shopName: shop.name,
          shopDomain: shop.domain,
          status: 'failed',
          error: error.message
        });
      }
    }

    const successCount = results.filter(r => r.status === 'initiated').length;
    const failureCount = results.filter(r => r.status === 'failed').length;

    logger.info("Product images sync completed", {
      totalShops: shopsToSync.length,
      successful: successCount,
      failed: failureCount
    });

    return {
      success: true,
      message: `Sync initiated for ${successCount} shop(s), ${failureCount} failed`,
      results
    };

  } catch (error) {
    logger.error("Failed to run product images sync", { error: error.message });
    throw error;
  }
};

export const params = {
  shopDomain: {
    type: "string"
  }
};

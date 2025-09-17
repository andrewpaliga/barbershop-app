import { ActionOptions } from "gadget-server";

export const run: ActionRun = async ({ params, logger, api, connections }) => {
  logger.info("Starting cleanup of deleted products");

  try {
    const shopId = connections.shopify.currentShopId;
    if (!shopId) {
      throw new Error("No shop context available");
    }

    // Step 1: Fetch all products from Shopify using GraphQL
    logger.info("Fetching products from Shopify");
    const shopifyProductIds = new Set<string>();
    let hasNextPage = true;
    let cursor: string | null = null;

    while (hasNextPage) {
      const query = `
        query GetProducts($first: Int!, $after: String) {
          products(first: $first, after: $after) {
            edges {
              node {
                id
              }
              cursor
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
      `;

      const variables: { first: number; after?: string } = { first: 250 };
      if (cursor) {
        variables.after = cursor;
      }

      const response = await connections.shopify.graphql(query, variables);
      
      if (response.errors) {
        logger.error("Error fetching products from Shopify", { errors: response.errors });
        throw new Error(`Shopify GraphQL error: ${response.errors.map(e => e.message).join(', ')}`);
      }

      const products = response.data?.products;
      if (!products) {
        logger.warn("No products data returned from Shopify");
        break;
      }

      // Extract product IDs (removing gid://shopify/Product/ prefix)
      for (const edge of products.edges) {
        const shopifyGid = edge.node.id;
        const productId = shopifyGid.replace('gid://shopify/Product/', '');
        shopifyProductIds.add(productId);
      }

      hasNextPage = products.pageInfo.hasNextPage;
      cursor = products.pageInfo.endCursor;
      
      logger.info(`Fetched ${products.edges.length} products from Shopify (total so far: ${shopifyProductIds.size})`);
    }

    logger.info(`Total products found in Shopify: ${shopifyProductIds.size}`);

    // Step 2: Get all shopifyProduct records from Gadget where productType is 'Service'
    logger.info("Fetching Service products from Gadget database");
    const gadgetServiceProducts = [];
    let gadgetHasNextPage = true;
    let gadgetCursor: string | undefined;

    while (gadgetHasNextPage) {
      const gadgetResponse = await api.shopifyProduct.findMany({
        filter: {
          AND: [
            { shopId: { equals: shopId } },
            { productType: { equals: "Service" } }
          ]
        },
        select: {
          id: true,
          title: true,
          handle: true,
          productType: true
        },
        first: 250,
        ...(gadgetCursor && { after: gadgetCursor })
      });

      gadgetServiceProducts.push(...gadgetResponse);
      gadgetHasNextPage = gadgetResponse.hasNextPage;
      if (gadgetResponse.hasNextPage) {
        gadgetCursor = gadgetResponse.endCursor;
      }

      logger.info(`Fetched ${gadgetResponse.length} Service products from Gadget (total so far: ${gadgetServiceProducts.length})`);
    }

    logger.info(`Total Service products found in Gadget: ${gadgetServiceProducts.length}`);

    // Step 3: Find orphaned products (exist in Gadget but not in Shopify)
    const orphanedProducts = gadgetServiceProducts.filter(product => {
      return !shopifyProductIds.has(product.id);
    });

    logger.info(`Found ${orphanedProducts.length} orphaned products to delete`);

    if (orphanedProducts.length > 0) {
      // Log details of what will be deleted
      logger.info("Orphaned products to be deleted:", {
        products: orphanedProducts.map(p => ({
          id: p.id,
          title: p.title,
          handle: p.handle
        }))
      });

      // Step 4: Delete orphaned products using bulk delete
      const orphanedIds = orphanedProducts.map(p => p.id);
      
      // Process deletions in batches to avoid overwhelming the system
      const batchSize = 50;
      let deletedCount = 0;

      for (let i = 0; i < orphanedIds.length; i += batchSize) {
        const batch = orphanedIds.slice(i, i + batchSize);
        logger.info(`Deleting batch ${Math.floor(i / batchSize) + 1}: ${batch.length} products`);
        
        await api.shopifyProduct.bulkDelete(batch);
        deletedCount += batch.length;
        
        logger.info(`Successfully deleted ${batch.length} products in this batch (total deleted: ${deletedCount})`);
      }

      logger.info(`Cleanup completed successfully. Deleted ${deletedCount} orphaned Service products`);
    } else {
      logger.info("No orphaned products found. Database is clean.");
    }

    // Step 5: Return summary
    const summary = {
      success: true,
      shopifyProductsFound: shopifyProductIds.size,
      gadgetServiceProductsFound: gadgetServiceProducts.length,
      orphanedProductsFound: orphanedProducts.length,
      orphanedProductsDeleted: orphanedProducts.length,
      orphanedProducts: orphanedProducts.map(p => ({
        id: p.id,
        title: p.title,
        handle: p.handle
      }))
    };

    logger.info("Cleanup summary", summary);
    return summary;

  } catch (error) {
    logger.error("Error during cleanup process", { error: error.message, stack: error.stack });
    
    return {
      success: false,
      error: error.message,
      shopifyProductsFound: 0,
      gadgetServiceProductsFound: 0,
      orphanedProductsFound: 0,
      orphanedProductsDeleted: 0,
      orphanedProducts: []
    };
  }
};

export const options: ActionOptions = {
  timeoutMS: 300000, // 5 minutes timeout for potentially large cleanup operations
  returnType: true
};

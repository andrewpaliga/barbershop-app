import { ActionRun } from "gadget-server";

export const run: ActionRun = async ({ params, logger, api, connections }) => {
  const { shopDomain } = params;
  
  logger.info("Starting variant image population process", { shopDomain });

  try {
    // Determine which shops to process
    let shopsToProcess = [];
    
    if (shopDomain) {
      // Find specific shop by domain
      const shop = await api.shopifyShop.findFirst({
        filter: {
          OR: [
            { domain: { equals: shopDomain } },
            { myshopifyDomain: { equals: shopDomain } }
          ]
        },
        select: { id: true, domain: true, myshopifyDomain: true }
      });
      
      if (!shop) {
        logger.error("Shop not found", { shopDomain });
        return { success: false, error: "Shop not found" };
      }
      
      shopsToProcess = [shop];
      logger.info("Processing specific shop", { shopId: shop.id, domain: shop.domain });
    } else {
      // Get all shops
      shopsToProcess = await api.shopifyShop.findMany({
        select: { id: true, domain: true, myshopifyDomain: true }
      });
      logger.info("Processing all shops", { count: shopsToProcess.length });
    }

    let totalVariantsProcessed = 0;
    let totalVariantsUpdated = 0;
    let totalErrors = 0;

    for (const shop of shopsToProcess) {
      logger.info("Processing shop", { shopId: shop.id, domain: shop.domain });

      // First, let's see what variants exist and what their image status is
      const allVariants = await api.shopifyProductVariant.findMany({
        filter: {
          shopId: { equals: shop.id }
        },
        select: {
          id: true,
          image: true,
          productId: true,
          shopId: true,
          title: true,
          sku: true
        }
      });

      logger.info("Found all variants for shop", { 
        shopId: shop.id, 
        count: allVariants.length 
      });

      // Log a few variants to see their current image status
      allVariants.slice(0, 3).forEach((variant, index) => {
        logger.info(`Sample variant ${index + 1}:`, {
          id: variant.id,
          title: variant.title,
          image: variant.image,
          hasImage: !!variant.image
        });
      });

      // Process ALL variants to ensure fresh images (replace existing ones too)
      const variants = allVariants;

      logger.info("Processing all variants for fresh images", { 
        shopId: shop.id, 
        count: variants.length,
        totalVariants: allVariants.length
      });

      for (const variant of variants) {
        totalVariantsProcessed++;
        
        try {
          logger.info("Processing variant", { 
            variantId: variant.id, 
            productId: variant.productId,
            title: variant.title
          });

          // Get the product to access its images
          const product = await api.shopifyProduct.findFirst({
            filter: { id: { equals: variant.productId } },
            select: { id: true, handle: true, title: true, shopifyId: true }
          });

          if (!product) {
            logger.warn("Product not found", { productId: variant.productId });
            continue;
          }

          // Get the Shopify client for this shop
          const shopify = await connections.shopify.forShopId(shop.id);
          
          if (!shopify) {
            logger.error("Could not get Shopify client for shop", { shopId: shop.id });
            continue;
          }

          // Get product details from Shopify REST API using the actual Shopify product ID
          try {
            const shopifyProductId = product.shopifyId || product.id;
            const productResponse = await shopify.rest.get({
              path: `products/${shopifyProductId}`,
            });
            
            if (!productResponse?.body?.product) {
              logger.warn("Product not found in Shopify", { 
                databaseId: product.id, 
                shopifyId: shopifyProductId,
                title: product.title 
              });
              continue;
            }

            const shopifyProduct = productResponse.body.product;
            const imageUrl = shopifyProduct.image?.src || shopifyProduct.images?.[0]?.src;
            
            if (!imageUrl) {
              logger.info("No image found for product", { 
                databaseId: product.id, 
                shopifyId: shopifyProductId,
                title: product.title 
              });
              continue;
            }

            // Prepare image data
            const imageData = {
              id: variant.id,
              url: imageUrl,
              altText: product.title || '',
              width: 300,
              height: 300
            };

            // Update the variant with image data using the internal API to avoid triggers
            await api.internal.shopifyProductVariant.update(variant.id, {
              image: imageData
            });

            totalVariantsUpdated++;
            
            logger.info("Successfully updated variant with image", {
              variantId: variant.id,
              imageData: imageData
            });

          } catch (apiError) {
            logger.error("Error fetching product from Shopify API", {
              productId: product.id,
              error: apiError instanceof Error ? apiError.message : String(apiError)
            });
            continue;
          }

        } catch (error) {
          totalErrors++;
          logger.error("Error processing variant", {
            variantId: variant.id,
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
          });
        }
      }
    }

    const result = {
      success: true,
      shopsProcessed: shopsToProcess.length,
      totalVariantsProcessed,
      totalVariantsUpdated,
      totalErrors
    };

    logger.info("Variant image population completed", result);
    return result;

  } catch (error) {
    logger.error("Fatal error in variant image population", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
};

export const params = {
  shopDomain: {
    type: "string"
  }
};
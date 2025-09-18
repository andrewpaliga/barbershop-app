export const run: ActionRun = async ({ params, logger, api, connections }) => {
  logger.info("Starting variant image URL fixing process");
  
  let totalUpdated = 0;
  const shopResults: Array<{shopId: string, domain: string, variantsUpdated: number, errors?: string[]}> = [];
  
  try {
    // Get all shops
    const shops = await api.shopifyShop.findMany({
      select: {
        id: true,
        myshopifyDomain: true
      }
    });
    
    logger.info(`Processing ${shops.length} shops`);
    
    for (const shop of shops) {
      const shopErrors: string[] = [];
      let shopUpdated = 0;
      
      try {
        if (!shop.myshopifyDomain) {
          const error = `Shop ${shop.id} has no myshopifyDomain`;
          logger.warn(error);
          shopErrors.push(error);
          shopResults.push({
            shopId: shop.id,
            domain: 'unknown',
            variantsUpdated: 0,
            errors: shopErrors
          });
          continue;
        }
        
        // Extract numeric parts from domain like 'store-name-123-456.myshopify.com'
        const domainMatch = shop.myshopifyDomain.match(/(\d+)-(\d+)/);
        if (!domainMatch) {
          const error = `Could not extract numeric IDs from domain: ${shop.myshopifyDomain}`;
          logger.warn(error);
          shopErrors.push(error);
          shopResults.push({
            shopId: shop.id,
            domain: shop.myshopifyDomain,
            variantsUpdated: 0,
            errors: shopErrors
          });
          continue;
        }
        
        const [, firstId, secondId] = domainMatch;
        const correctPath = `/s/files/1/${firstId}/${secondId}/`;
        
        logger.info(`Shop ${shop.id} (${shop.myshopifyDomain}) - correct path: ${correctPath}`);
        
        // Get all variants for this shop that have image data, with pagination
        let allVariants: any[] = [];
        let hasMore = true;
        let cursor: string | undefined = undefined;

        while (hasMore) {
          const variantsPage = await api.shopifyProductVariant.findMany({
            filter: {
              shopId: { equals: shop.id },
              image: { isSet: true }
            },
            select: {
              id: true,
              image: true
            },
            first: 250,
            after: cursor
          });
          
          allVariants = allVariants.concat(variantsPage);
          
          if (variantsPage.hasNextPage) {
            cursor = variantsPage.endCursor;
          } else {
            hasMore = false;
          }
        }
        
        logger.info(`Found ${allVariants.length} variants with images for shop ${shop.id}`);
        
        // Process each variant
        for (const variant of allVariants) {
          if (!variant.image || typeof variant.image !== 'object') {
            continue;
          }
          
          const imageObj = variant.image as any;
          if (!imageObj.url || typeof imageObj.url !== 'string') {
            continue;
          }
          
          const currentUrl = imageObj.url;
          if (currentUrl.includes('/s/files/1/0000/0000/')) {
            try {
              const newUrl = currentUrl.replace('/s/files/1/0000/0000/', correctPath);
              
              // Update the variant
              await api.shopifyProductVariant.update(variant.id, {
                image: {
                  ...imageObj,
                  url: newUrl
                }
              });
              
              shopUpdated++;
              logger.info(`Updated variant ${variant.id}: ${currentUrl} -> ${newUrl}`);
            } catch (updateError) {
              const error = `Failed to update variant ${variant.id}: ${updateError}`;
              logger.error(error);
              shopErrors.push(error);
            }
          }
        }
        
      } catch (shopError) {
        const error = `Error processing shop ${shop.id}: ${shopError}`;
        logger.error(error);
        shopErrors.push(error);
      }
      
      shopResults.push({
        shopId: shop.id,
        domain: shop.myshopifyDomain || 'unknown',
        variantsUpdated: shopUpdated,
        ...(shopErrors.length > 0 && { errors: shopErrors })
      });
      
      totalUpdated += shopUpdated;
      logger.info(`Shop ${shop.id} completed: ${shopUpdated} variants updated`);
    }
    
    logger.info(`Image URL fixing completed. Total variants updated: ${totalUpdated}`);
    
    return {
      success: true,
      totalVariantsUpdated: totalUpdated,
      shopsProcessed: shops.length,
      shopResults
    };
    
  } catch (error) {
    logger.error(`Error in fixVariantImageUrls: ${error}`);
    return {
      success: false,
      error: String(error),
      totalVariantsUpdated: totalUpdated,
      shopResults
    };
  }
};

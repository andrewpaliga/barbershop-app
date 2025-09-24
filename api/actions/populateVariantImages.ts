import { ActionRun, ActionOptions } from "gadget-server";

export const run: ActionRun = async ({ params, logger, api, connections }) => {
  try {
    logger.info("Starting to populate variant images...");
    
    // Get all variants that don't have images populated
    const variants = await api.shopifyProductVariant.findMany({
      filter: {
        OR: [
          { image: { equals: null } },
          { images: { equals: null } }
        ]
      },
      select: {
        id: true,
        productId: true,
        shopId: true,
        image: true,
        images: true
      }
    });
    
    logger.info(`Found ${variants.length} variants to process`);
    
    for (const variant of variants) {
      try {
        if (!variant.productId || !variant.shopId) {
          logger.warn(`Skipping variant ${variant.id} - missing productId or shopId`);
          continue;
        }
        
        const shopify = await connections.shopify.forShopId(variant.shopId);
        if (!shopify) {
          logger.warn(`No Shopify connection for shop ${variant.shopId}`);
          continue;
        }
        
        // Get variant details to find specific image_id
        const variantResponse = await shopify.rest.get({
          path: `variants/${variant.id}`,
        });
        
        const variantData = variantResponse.body.variant;
        const imageId = variantData?.image_id;
        const productId = variantData?.product_id;
        
        if (!productId) {
          logger.warn(`No product_id for variant ${variant.id}`);
          continue;
        }
        
        // Fetch all product images
        const productImagesResponse = await shopify.rest.get({
          path: `products/${productId}/images`,
        });
        
        const allImages = productImagesResponse.body.images || [];
        const variantImages = [];
        let primaryImage = null;
        
        // Process all images
        for (const imageData of allImages) {
          if (imageData?.src) {
            const imageInfo = {
              id: imageData.id?.toString(),
              url: imageData.src,
              altText: imageData.alt || '',
              width: imageData.width || null,
              height: imageData.height || null
            };
            
            variantImages.push(imageInfo);
            
            // Set as primary image if it matches the variant's image_id or if no primary image set yet
            if (imageId && imageData.id?.toString() === imageId.toString()) {
              primaryImage = imageInfo;
            } else if (!primaryImage) {
              primaryImage = imageInfo;
            }
          }
        }
        
        if (variantImages.length > 0) {
          logger.info(`Updating variant ${variant.id} with ${variantImages.length} images`);
          
          // Update the record with both single image and images array
          await api.shopifyProductVariant.update(variant.id, {
            image: primaryImage,
            images: variantImages
          });
          
          logger.info(`Successfully updated images for variant ${variant.id}`);
        } else {
          logger.info(`No images found for product ${productId}`);
        }
        
      } catch (error) {
        logger.error(`Error processing variant ${variant.id}:`, error);
      }
    }
    
    logger.info("Finished populating variant images");
    
  } catch (error) {
    logger.error("Error in populateVariantImages:", error);
    throw error;
  }
};

export const options: ActionOptions = {
  actionType: "custom",
};
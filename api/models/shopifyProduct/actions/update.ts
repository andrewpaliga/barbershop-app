import { applyParams, save, ActionOptions } from "gadget-server";
import { preventCrossShopDataAccess } from "gadget-server/shopify";

export const run: ActionRun = async ({ params, record, logger, api }) => {
  applyParams(params, record);
  
  await preventCrossShopDataAccess(params, record);
  await save(record);
};

export const onSuccess: ActionOnSuccess = async ({ params, record, logger, api }) => {
  try {
    // Extract images and variants from the webhook payload
    const images = params.images || [];
    const variants = params.variants || [];
    
    logger.info(`Processing ${images.length} images and ${variants.length} variants from product update`);
    
    if (images.length === 0 || variants.length === 0) {
      logger.info("No images or variants to process");
      return;
    }
    
    // Build variant -> image mapping from the payload
    const variantToImage: Record<string, any> = {};
    
    for (const image of images) {
      if (image.variant_ids && Array.isArray(image.variant_ids) && image.variant_ids.length > 0) {
        for (const variantId of image.variant_ids) {
          variantToImage[String(variantId)] = {
            id: String(image.id),
            url: String(image.src),
            altText: image.alt || '',
            width: image.width || null,
            height: image.height || null
          };
          logger.info(`Mapped variant ${variantId} to image ${image.id}: ${image.src}`);
        }
      }
    }
    
    // Update each variant with its corresponding image
    for (const variant of variants) {
      const variantId = String(variant.id);
      const imageData = variantToImage[variantId];
      
      if (imageData) {
        try {
          logger.info(`Updating variant ${variantId} with image data`);
          await (api as any).internal.shopifyProductVariant.update(variantId, { image: imageData });
          logger.info(`Successfully updated variant ${variantId} image`);
        } catch (error) {
          logger.error(`Failed to update variant ${variantId}:`, error);
        }
      } else {
        logger.info(`No image found for variant ${variantId}`);
      }
    }
    
  } catch (error) {
    logger.error("Error in product update onSuccess:", error);
  }
};

export const options: ActionOptions = {
  actionType: "update",
  triggers: {
    api: true,
    shopify: {
      webhooks: ["products/update"],
      hasSync: true
    }
  }
};

import { applyParams, save, ActionOptions } from "gadget-server";
import { preventCrossShopDataAccess } from "gadget-server/shopify";

export const run: ActionRun = async ({ params, record, logger, api, connections }) => {
  applyParams(params, record);
  await preventCrossShopDataAccess(params, record);
  await save(record);
};

export const onSuccess: ActionOnSuccess = async ({ params, record, logger, api, connections }) => {
  try {
    // Only fetch image if we don't already have one
    if (!record.image && record.id && record.productId) {
      logger.info(`Fetching image for variant ${record.id} (product: ${record.productId}) using REST API`);
      
      // Get the shop's Shopify client
      const shopify = await connections.shopify.forShopId(record.shopId);
      
      if (shopify) {
        try {
          // First, get the variant details via REST API to find image_id
          logger.info(`Fetching variant ${record.id} via REST API`);
          const variantResponse = await shopify.rest.get({
            path: `variants/${record.id}`,
          });
          
          logger.info(`REST variant response for ${record.id}:`, JSON.stringify(variantResponse.body, null, 2));
          
          const variant = variantResponse.body.variant;
          const imageId = variant?.image_id;
          const productId = variant?.product_id;
          
          if (imageId && productId) {
            logger.info(`Found image_id ${imageId} for variant ${record.id}, fetching image from product ${productId}`);
            
            // Fetch the image details from the product
            const imageResponse = await shopify.rest.get({
              path: `products/${productId}/images/${imageId}`,
            });
            
            logger.info(`REST image response for image ${imageId}:`, JSON.stringify(imageResponse.body, null, 2));
            
            const imageData = imageResponse.body.image;
            
            if (imageData?.src) {
              const imageInfo = {
                id: imageData.id?.toString(),
                url: imageData.src,
                altText: imageData.alt || '',
                width: imageData.width || null,
                height: imageData.height || null
              };
              
              logger.info(`Successfully fetched image data for variant ${record.id}:`, imageInfo);
              
              // Update the record with the image data
              await api.shopifyProductVariant.update(record.id, {
                image: imageInfo
              });
              
              logger.info(`Successfully updated image for variant ${record.id}`);
            } else {
              logger.warn(`Image response missing src for variant ${record.id}`);
            }
          } else if (productId) {
            logger.info(`No image_id for variant ${record.id}, trying product ${productId} first image`);
            
            // Fall back to product's first image if variant has no specific image
            const productImagesResponse = await shopify.rest.get({
              path: `products/${productId}/images`,
            });
            
            logger.info(`Product images response for ${productId}:`, JSON.stringify(productImagesResponse.body, null, 2));
            
            const images = productImagesResponse.body.images;
            if (images && images.length > 0) {
              const firstImage = images[0];
              const imageInfo = {
                id: firstImage.id?.toString(),
                url: firstImage.src,
                altText: firstImage.alt || '',
                width: firstImage.width || null,
                height: firstImage.height || null
              };
              
              logger.info(`Using product first image for variant ${record.id}:`, imageInfo);
              
              // Update the record with the image data
              await api.shopifyProductVariant.update(record.id, {
                image: imageInfo
              });
              
              logger.info(`Successfully updated variant ${record.id} with product image`);
            } else {
              logger.info(`No images found for product ${productId}`);
            }
          } else {
            logger.info(`No product_id found for variant ${record.id}`);
          }
          
        } catch (error) {
          logger.error(`Error fetching image for variant ${record.id}:`, error);
        }
      }
    } else if (record.image) {
      logger.info(`Variant ${record.id} already has image data`);
    }
  } catch (error) {
    logger.error(`Error in onSuccess for variant ${record.id}:`, error);
  }
};

export const options: ActionOptions = { 
  actionType: "update",
  triggers: [
    { type: "shopify", webhooks: ["products/update"], hasSync: true },
    { type: "api" }
  ]
};
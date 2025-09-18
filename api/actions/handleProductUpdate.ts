import { ActionOptions } from "gadget-server";

export const run: ActionRun = async ({ params, logger, api, connections, trigger }) => {
  logger.info("Starting handleProductUpdate action");
  
  // Log the incoming webhook payload structure for debugging
  logger.info({ trigger }, "Webhook trigger structure");
  
  if (!trigger?.payload) {
    logger.error("No webhook payload found in trigger");
    throw new Error("No webhook payload found");
  }

  const webhookPayload = trigger.payload;
  logger.info({ 
    productId: webhookPayload.id,
    title: webhookPayload.title,
    hasImages: !!webhookPayload.images 
  }, "Processing product update webhook");

  // Get the current shop ID for tenancy
  const shopId = connections.shopify.currentShopId;
  if (!shopId) {
    logger.error("No shop ID found in connections");
    throw new Error("No shop ID available");
  }

  try {
    // Find the corresponding shopifyProduct record in the database
    const product = await api.shopifyProduct.findFirst({
      filter: {
        AND: [
          { id: { equals: webhookPayload.id.toString() } },
          { shopId: { equals: shopId } }
        ]
      },
      select: {
        id: true,
        title: true,
        images: true,
        variants: {
          edges: {
            node: {
              id: true,
              image: true
            }
          }
        }
      }
    });

    if (!product) {
      logger.warn({ 
        productId: webhookPayload.id,
        shopId 
      }, "Product not found in database");
      return { success: false, reason: "Product not found" };
    }

    logger.info({ 
      productId: product.id,
      title: product.title 
    }, "Found product in database");

    // Update the product's images field with the webhook data
    const updatedProduct = await api.shopifyProduct.update(product.id, {
      images: webhookPayload.images || null
    });

    logger.info({ 
      productId: updatedProduct.id,
      imagesCount: webhookPayload.images?.length || 0 
    }, "Updated product images");

    // Process variants with images
    if (webhookPayload.variants && Array.isArray(webhookPayload.variants)) {
      logger.info({ 
        variantCount: webhookPayload.variants.length 
      }, "Processing product variants");

      const variantUpdatePromises = webhookPayload.variants.map(async (webhookVariant: any) => {
        try {
          // Find the variant in our database
          const existingVariant = await api.shopifyProductVariant.findFirst({
            filter: {
              AND: [
                { id: { equals: webhookVariant.id.toString() } },
                { shopId: { equals: shopId } }
              ]
            },
            select: {
              id: true,
              image: true
            }
          });

          if (!existingVariant) {
            logger.warn({ 
              variantId: webhookVariant.id 
            }, "Variant not found in database");
            return { success: false, reason: "Variant not found", variantId: webhookVariant.id };
          }

          // Update variant image if it has an image_id
          if (webhookVariant.image_id && webhookPayload.images) {
            logger.info({ 
              variantId: webhookVariant.id,
              imageId: webhookVariant.image_id,
              availableImages: webhookPayload.images.length 
            }, "Processing variant image");

            // Find the matching image from the product images array
            const matchingImage = webhookPayload.images.find((img: any) => 
              img.id === webhookVariant.image_id
            );

            if (matchingImage) {
              logger.info({ 
                variantId: webhookVariant.id,
                foundImageId: matchingImage.id,
                imageUrl: matchingImage.src 
              }, "Found matching image for variant");

              // Transform the image data into the proper format for our database
              const transformedImageData = {
                id: matchingImage.id.toString(),
                url: matchingImage.src,
                altText: matchingImage.alt || null,
                width: matchingImage.width || null,
                height: matchingImage.height || null
              };

              await api.internal.shopifyProductVariant.update(existingVariant.id, {
                image: transformedImageData
              });

              logger.info({ 
                variantId: existingVariant.id,
                imageData: transformedImageData 
              }, "Successfully updated variant image");
            } else {
              logger.warn({ 
                variantId: webhookVariant.id,
                imageId: webhookVariant.image_id,
                productImageIds: webhookPayload.images.map((img: any) => img.id) 
              }, "No matching image found for variant image_id");
            }
          } else if (webhookVariant.image_id === null) {
            // Variant image was removed - clear the image
            logger.info({ 
              variantId: webhookVariant.id 
            }, "Clearing variant image (image_id is null)");

            await api.internal.shopifyProductVariant.update(existingVariant.id, {
              image: null
            });

            logger.info({ 
              variantId: existingVariant.id 
            }, "Successfully cleared variant image");
          } else {
            logger.info({ 
              variantId: webhookVariant.id,
              hasImageId: !!webhookVariant.image_id,
              hasProductImages: !!webhookPayload.images 
            }, "Variant has no image or no product images available");
          }

          return { success: true, variantId: existingVariant.id };
        } catch (error) {
          logger.error({ 
            error: error.message,
            variantId: webhookVariant.id 
          }, "Error updating variant");
          return { success: false, reason: error.message, variantId: webhookVariant.id };
        }
      });

      // Wait for all variant updates with proper error handling
      const variantResults = await Promise.allSettled(variantUpdatePromises);
      
      const successCount = variantResults.filter(result => 
        result.status === 'fulfilled' && result.value.success
      ).length;
      
      const errorCount = variantResults.length - successCount;

      logger.info({ 
        totalVariants: variantResults.length,
        successCount,
        errorCount 
      }, "Completed variant processing");

      if (errorCount > 0) {
        const errors = variantResults
          .filter(result => result.status === 'rejected' || !result.value.success)
          .map(result => {
            if (result.status === 'rejected') {
              return { error: result.reason };
            } else {
              return { error: result.value.reason, variantId: result.value.variantId };
            }
          });
        
        logger.warn({ errors }, "Some variant updates failed");
      }
    }

    logger.info({ 
      productId: product.id,
      shopId 
    }, "Successfully completed handleProductUpdate");

    return { 
      success: true, 
      productId: product.id,
      imagesUpdated: !!webhookPayload.images,
      variantsProcessed: webhookPayload.variants?.length || 0
    };

  } catch (error) {
    logger.error({ 
      error: error.message,
      stack: error.stack,
      productId: webhookPayload.id,
      shopId 
    }, "Error in handleProductUpdate");
    
    throw error;
  }
};

export const options: ActionOptions = {
  triggers: {
    shopify: {
      webhooks: ["products/update"]
    }
  }
};

import { applyParams, save, ActionOptions } from "gadget-server";
import { preventCrossShopDataAccess } from "gadget-server/shopify";

export const run: ActionRun = async ({ params, record, logger }) => {
  applyParams(params, record);
  
  // Debug: Log webhook payload structure
  logger.info(`Webhook params keys: ${Object.keys(params).join(', ')}`);
  
  // Check if images are in the shopifyProduct object
  if (params.shopifyProduct && typeof params.shopifyProduct === 'object') {
    logger.info(`shopifyProduct keys: ${Object.keys(params.shopifyProduct).join(', ')}`);
    
    if (params.shopifyProduct.images) {
      logger.info(`Found images in shopifyProduct: ${JSON.stringify(params.shopifyProduct.images)}`);
      // Set images field from nested shopifyProduct data
      record.images = params.shopifyProduct.images;
      logger.info(`Set images field on record from shopifyProduct`);
    } else {
      logger.info('No images field in shopifyProduct object');
    }
  }
  
  // Also check top-level images (original check)
  if (params.images) {
    logger.info(`Images in webhook payload: ${JSON.stringify(params.images)}`);
    record.images = params.images;
    logger.info(`Set images field on record from top-level`);
  }
  
  if (!params.images && (!params.shopifyProduct || !params.shopifyProduct.images)) {
    logger.info('No images field found anywhere in webhook payload');
  }
  
  await preventCrossShopDataAccess(params, record);
  await save(record);
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

import { applyParams, save, ActionOptions } from "gadget-server";
import { preventCrossShopDataAccess } from "gadget-server/shopify";

export const run: ActionRun = async ({ params, record, logger, api, connections }) => {
  applyParams(params, record);
  await preventCrossShopDataAccess(params, record);
  
  logger.info({ 
    orderId: record.id, 
    orderName: record.name,
    shopId: record.shopId 
  }, "Creating Shopify order");
  
  await save(record);
};

export const onSuccess: ActionOnSuccess = async ({ params, record, logger, api, connections }) => {
  logger.info({ 
    orderId: record.id, 
    orderName: record.name,
    shopId: record.shopId 
  }, "Enqueueing processBookings action for order");
  
  // Enqueue the processBookings action to run in the background
  await api.enqueue(api.shopifyOrder.processBookings, { id: record.id });
  
  logger.info({ 
    orderId: record.id 
  }, "Successfully enqueued processBookings action");
};

export const options: ActionOptions = { actionType: "create" };

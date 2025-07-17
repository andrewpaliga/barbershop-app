import { applyParams, save, ActionOptions } from "gadget-server";
import { preventCrossShopDataAccess } from "gadget-server/shopify";

export const run: ActionRun = async ({ params, record, logger, api, connections }) => {
  logger.info({ orderId: record.id, orderName: record.name }, "Processing Shopify order update");
  applyParams(params, record);
  await preventCrossShopDataAccess(params, record);
  await save(record);
};

export const onSuccess: ActionOnSuccess = async ({ params, record, logger, api, connections }) => {
  // Process bookings in the background after order update
  logger.info({ orderId: record.id, orderName: record.name }, "Enqueueing processBookings action for updated order");
  await api.enqueue(api.shopifyOrder.processBookings, record.id);
};

export const options: ActionOptions = { actionType: "update" };

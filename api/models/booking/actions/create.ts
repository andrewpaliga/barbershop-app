import { applyParams, save, ActionOptions } from "gadget-server";
import { preventCrossShopDataAccess } from "gadget-server/shopify";

export const run: ActionRun = async ({ params, record, logger, api, connections }) => {
  applyParams(params, record);
  
  // Always set status to 'not_paid' for new bookings
  record.status = 'not_paid';
  
  await preventCrossShopDataAccess(params, record);
  await save(record);
};

export const options: ActionOptions = {
  actionType: "create",
};

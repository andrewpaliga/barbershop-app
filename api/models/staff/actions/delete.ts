import { deleteRecord, ActionOptions } from "gadget-server";
import { preventCrossShopDataAccess } from "gadget-server/shopify";

export const run: ActionRun = async ({ params, record, logger, api, connections }) => {
  await preventCrossShopDataAccess(params, record);
  await deleteRecord(record);
};

export const options: ActionOptions = {
  actionType: "delete",
};

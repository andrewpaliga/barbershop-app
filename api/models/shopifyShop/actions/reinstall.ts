import { applyParams, save, ActionOptions } from "gadget-server";
import { preventCrossShopDataAccess } from "gadget-server/shopify";

export const run: ActionRun = async ({ params, record, logger, api, connections }) => {
  applyParams(params, record);
  await preventCrossShopDataAccess(params, record);
  await save(record);
};

export const onSuccess: ActionOnSuccess = async ({ params, record, logger, api, connections }) => {
  // Add a models array and syncSince in the future if you want to restrict what data is synced
  await api.shopifySync.run({
    domain: record.domain,
    shop: {
      _link: record.id
    }
  })
};

export const options: ActionOptions = { actionType: "update" };

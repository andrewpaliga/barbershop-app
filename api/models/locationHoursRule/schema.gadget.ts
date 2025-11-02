import type { GadgetModel } from "gadget-server";

// This file describes the schema for the "locationHoursRule" model, go to https://simplybook.gadget.app/edit to view/edit your model in Gadget
// For more information on how to update this file http://docs.gadget.dev

export const schema: GadgetModel = {
  type: "gadget/model-schema/v1",
  storageKey: "locationHoursRule",
  comment:
    "Weekly recurring operating hours for Shopify locations by weekday.",
  fields: {
    closeTime: {
      type: "string",
      validations: { required: true },
      storageKey: "ruleCloseTime",
    },
    location: {
      type: "belongsTo",
      validations: { required: true },
      parent: { model: "shopifyLocation" },
      storageKey: "ruleLocationId",
    },
    openTime: {
      type: "string",
      validations: { required: true },
      storageKey: "ruleOpenTime",
    },
    shop: {
      type: "belongsTo",
      validations: { required: true },
      parent: { model: "shopifyShop" },
      storageKey: "ruleShopId",
    },
    validFrom: {
      type: "dateTime",
      includeTime: true,
      validations: { required: true },
      storageKey: "ruleValidFrom",
    },
    validTo: {
      type: "dateTime",
      includeTime: true,
      storageKey: "ruleValidTo",
    },
    weekday: {
      type: "number",
      validations: {
        required: true,
        numberRange: { min: 0, max: 6 },
      },
      storageKey: "weekday",
    },
  },
};

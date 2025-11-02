import type { GadgetModel } from "gadget-server";

// This file describes the schema for the "locationHoursException" model, go to https://simplybook.gadget.app/edit to view/edit your model in Gadget
// For more information on how to update this file http://docs.gadget.dev

export const schema: GadgetModel = {
  type: "gadget/model-schema/v1",
  storageKey: "locationHoursException",
  comment:
    "One-off or date-range overrides for holiday closures and special operating hours for Shopify locations.",
  fields: {
    closeTime: { type: "string", storageKey: "exceptionCloseTime" },
    closedAllDay: {
      type: "boolean",
      default: false,
      validations: { required: true },
      storageKey: "closedAllDay",
    },
    endDate: {
      type: "dateTime",
      includeTime: true,
      validations: { required: true },
      storageKey: "endDate",
    },
    location: {
      type: "belongsTo",
      validations: { required: true },
      parent: { model: "shopifyLocation" },
      storageKey: "exceptionLocationId",
    },
    openTime: { type: "string", storageKey: "exceptionOpenTime" },
    reason: { type: "string", storageKey: "reason" },
    shop: {
      type: "belongsTo",
      validations: { required: true },
      parent: { model: "shopifyShop" },
      storageKey: "exceptionShopId",
    },
    startDate: {
      type: "dateTime",
      includeTime: true,
      validations: { required: true },
      storageKey: "startDate",
    },
    validFrom: {
      type: "dateTime",
      includeTime: true,
      validations: { required: true },
      storageKey: "exceptionValidFrom",
    },
    validTo: {
      type: "dateTime",
      includeTime: true,
      storageKey: "exceptionValidTo",
    },
  },
};

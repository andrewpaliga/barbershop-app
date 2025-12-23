import type { GadgetModel } from "gadget-server";

// This file describes the schema for the "reminderHistory" model, go to https://simplybook.gadget.app/edit to view/edit your model in Gadget
// For more information on how to update this file http://docs.gadget.dev

export const schema: GadgetModel = {
  type: "gadget/model-schema/v1",
  storageKey: "reminderHistory",
  comment:
    "Tracks email reminders sent to customers for appointments, including confirmations and reminders.",
  fields: {
    booking: {
      type: "belongsTo",
      validations: { required: true },
      parent: { model: "booking" },
      storageKey: "booking",
    },
    customerEmail: {
      type: "email",
      validations: { required: true },
      storageKey: "customerEmail",
    },
    errorMessage: { type: "string", storageKey: "errorMessage" },
    reminderType: {
      type: "enum",
      acceptMultipleSelections: false,
      acceptUnlistedOptions: false,
      options: ["confirmation", "24_hour", "1_hour"],
      validations: { required: true },
      storageKey: "reminderType",
    },
    sentAt: {
      type: "dateTime",
      includeTime: true,
      validations: { required: true },
      storageKey: "sentAt",
    },
    shop: {
      type: "belongsTo",
      validations: { required: true },
      parent: { model: "shopifyShop" },
      storageKey: "shop",
    },
    status: {
      type: "enum",
      acceptMultipleSelections: false,
      acceptUnlistedOptions: false,
      options: ["sent", "failed"],
      validations: { required: true },
      storageKey: "status",
    },
  },
};

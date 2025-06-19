import type { GadgetModel } from "gadget-server";

// This file describes the schema for the "staffAvailability" model, go to https://barbershop.gadget.app/edit to view/edit your model in Gadget
// For more information on how to update this file http://docs.gadget.dev

export const schema: GadgetModel = {
  type: "gadget/model-schema/v1",
  storageKey: "vBMS9k2EoWmh",
  comment:
    "Represents the availability of staff members for appointments, including the day and time of availability, and the shop and location they belong to.",
  fields: {
    dayOfWeek: {
      type: "enum",
      acceptMultipleSelections: false,
      acceptUnlistedOptions: false,
      options: [
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
        "sunday",
      ],
      validations: { required: true },
      storageKey: "wLj8kpCoI6du",
    },
    endTime: {
      type: "string",
      validations: { required: true },
      storageKey: "yO2DPLqADcmc",
    },
    isAvailable: { type: "boolean", storageKey: "DbIiRBRZnuNG" },
    location: {
      type: "belongsTo",
      parent: { model: "shopifyLocation" },
      storageKey: "FCGhH7iwnbgj",
    },
    shop: {
      type: "belongsTo",
      validations: { required: true },
      parent: { model: "shopifyShop" },
      storageKey: "sJZL8rh7SNUm",
    },
    staff: {
      type: "belongsTo",
      validations: { required: true },
      parent: { model: "staff" },
      storageKey: "mtJ4Ss2heYNj",
    },
    startTime: {
      type: "string",
      validations: { required: true },
      storageKey: "Mf7voOQgA2bd",
    },
  },
};

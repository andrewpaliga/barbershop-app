import type { GadgetModel } from "gadget-server";

// This file describes the schema for the "locationHours" model, go to https://barbershop.gadget.app/edit to view/edit your model in Gadget
// For more information on how to update this file http://docs.gadget.dev

export const schema: GadgetModel = {
  type: "gadget/model-schema/v1",
  storageKey: "wsvW9g3VBTRU",
  comment:
    "Custom operating hours and holiday closures for Shopify locations, allowing shops to manage their schedules independently.",
  fields: {
    holidayClosures: {
      type: "json",
      validations: { required: true },
      storageKey: "S728IO19w4Mi",
    },
    location: {
      type: "belongsTo",
      validations: { required: true },
      parent: { model: "shopifyLocation" },
      storageKey: "09AxolctU_Th",
    },
    operatingHours: {
      type: "json",
      validations: { required: true },
      storageKey: "HDqXOyG1MoZY",
    },
    shop: {
      type: "belongsTo",
      validations: { required: true },
      parent: { model: "shopifyShop" },
      storageKey: "2aBml5llikD_",
    },
  },
};

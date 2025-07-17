import type { GadgetModel } from "gadget-server";

// This file describes the schema for the "staffDateAvailability" model, go to https://barbershop.gadget.app/edit to view/edit your model in Gadget
// For more information on how to update this file http://docs.gadget.dev

export const schema: GadgetModel = {
  type: "gadget/model-schema/v1",
  storageKey: "oScAlDpVT0sW",
  comment:
    "This model represents a staff member's availability on a specific date, allowing for overrides to their regular weekly schedule.",
  fields: {
    date: {
      type: "dateTime",
      includeTime: false,
      validations: { required: true },
      storageKey: "MnMUOW5Uu9Wy",
    },
    endTime: {
      type: "string",
      validations: { required: true },
      storageKey: "av4GvjHc8u0r",
    },
    isAvailable: { type: "boolean", storageKey: "fTBhK_80xooG" },
    location: {
      type: "belongsTo",
      parent: { model: "shopifyLocation" },
      storageKey: "4BsecxzFcPOq",
    },
    notes: { type: "string", storageKey: "sxpuiMVHdPhD" },
    shop: {
      type: "belongsTo",
      validations: { required: true },
      parent: { model: "shopifyShop" },
      storageKey: "EWrBltMsNI4_",
    },
    staff: {
      type: "belongsTo",
      validations: { required: true },
      parent: { model: "staff" },
      storageKey: "o0BCiIzYm0P1",
    },
    startTime: {
      type: "string",
      validations: { required: true },
      storageKey: "JGSoKHp2vUOt",
    },
  },
};

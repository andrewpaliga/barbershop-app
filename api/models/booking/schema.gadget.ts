import type { GadgetModel } from "gadget-server";

// This file describes the schema for the "booking" model, go to https://simplybook.gadget.app/edit to view/edit your model in Gadget
// For more information on how to update this file http://docs.gadget.dev

export const schema: GadgetModel = {
  type: "gadget/model-schema/v1",
  storageKey: "piVGGHYvnYQQ",
  comment:
    "Represents a scheduled appointment or booking, including the customer, staff member, product, location, and appointment details.",
  fields: {
    arrived: {
      type: "boolean",
      default: false,
      storageKey: "ux_CVwHTPDlG",
    },
    customer: {
      type: "belongsTo",
      parent: { model: "shopifyCustomer" },
      storageKey: "EkzSkc9e868w",
    },
    customerEmail: { type: "email", storageKey: "itXoUi2N9siK" },
    customerName: { type: "string", storageKey: "pX5AfSxtff-5" },
    duration: {
      type: "number",
      decimals: 0,
      validations: { required: true },
      storageKey: "XL4acUiBmJG7",
    },
    location: {
      type: "belongsTo",
      validations: { required: true },
      parent: { model: "shopifyLocation" },
      storageKey: "xo9fHwJgCM3z",
    },
    locationTimeZone: {
      type: "string",
      storageKey: "locationTimeZone",
    },
    notes: { type: "string", storageKey: "LQmRZvstTbws" },
    order: {
      type: "belongsTo",
      parent: { model: "shopifyOrder" },
      storageKey: "IZuv6f4Kqr-w",
    },
    scheduledAt: {
      type: "dateTime",
      includeTime: true,
      validations: { required: true },
      storageKey: "54CBuwCBpKEV",
    },
    shop: {
      type: "belongsTo",
      validations: { required: true },
      parent: { model: "shopifyShop" },
      storageKey: "sbYv-1em1jSK",
    },
    staff: {
      type: "belongsTo",
      validations: { required: true },
      parent: { model: "staff" },
      storageKey: "WPY57ToWTgFz",
    },
    status: {
      type: "enum",
      acceptMultipleSelections: false,
      acceptUnlistedOptions: false,
      options: [
        "pending",
        "paid",
        "not_paid",
        "no_show",
        "cancelled",
        "completed",
      ],
      validations: { required: true },
      storageKey: "X_FjDZyJHB9r",
    },
    totalPrice: {
      type: "number",
      decimals: 0,
      validations: {
        required: true,
        numberRange: { min: 0, max: null },
      },
      storageKey: "CafzbQI1EA_z",
    },
    variant: {
      type: "belongsTo",
      parent: { model: "shopifyProductVariant" },
      storageKey: "wLJ11BLKqpPg",
    },
  },
};

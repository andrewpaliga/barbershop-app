import type { GadgetModel } from "gadget-server";

// This file describes the schema for the "staff" model, go to https://barbershop.gadget.app/edit to view/edit your model in Gadget
// For more information on how to update this file http://docs.gadget.dev

export const schema: GadgetModel = {
  type: "gadget/model-schema/v1",
  storageKey: "OZOc-vqzSpl0",
  comment:
    "Represents an employee who can perform services, with details on their identity, contact information, and work association.",
  fields: {
    avatar: {
      type: "file",
      allowPublicAccess: true,
      storageKey: "B4ShB6T5sccW",
    },
    email: { type: "email", storageKey: "v9T5V49rMcOL" },
    isActive: { type: "boolean", storageKey: "B_HsH1sA5mjB" },
    name: {
      type: "string",
      validations: { required: true },
      storageKey: "6bfzStB9awGO",
    },
    phone: { type: "string", storageKey: "eWbmr3czXH-f" },
    shop: {
      type: "belongsTo",
      validations: { required: true },
      parent: { model: "shopifyShop" },
      storageKey: "FX4rfFQxz7Nj",
    },
    title: { type: "string", storageKey: "iL32ZGQ0oxIH" },
  },
};

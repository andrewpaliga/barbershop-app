import type { GadgetModel } from "gadget-server";

// This file describes the schema for the "staffProduct" model, go to https://barbershop.gadget.app/edit to view/edit your model in Gadget
// For more information on how to update this file http://docs.gadget.dev

export const schema: GadgetModel = {
  type: "gadget/model-schema/v1",
  storageKey: "Mrg1p6GtIPyq",
  comment:
    "Represents the many-to-many relationship between staff members and products (services) in a specific shop, enabling tracking of services each staff member can perform.",
  fields: {
    product: {
      type: "belongsTo",
      validations: { required: true },
      parent: { model: "shopifyProduct" },
      storageKey: "OntilF6pQYtz",
    },
    shop: {
      type: "belongsTo",
      validations: { required: true },
      parent: { model: "shopifyShop" },
      storageKey: "1-E_0w5DuyPD",
    },
    staff: {
      type: "belongsTo",
      validations: { required: true },
      parent: { model: "staff" },
      storageKey: "Cory6knLwwVI",
    },
  },
};

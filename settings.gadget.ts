import type { GadgetSettings } from "gadget-server";

export const settings: GadgetSettings = {
  type: "gadget/settings/v1",
  frameworkVersion: "v1.4.0",
  plugins: {
    connections: {
      shopify: {
        apiVersion: "2025-04",
        enabledModels: [
          "shopifyLocation",
          "shopifyOrder",
          "shopifyOrderLineItem",
          "shopifyProduct",
          "shopifyProductVariant",
        ],
        type: "partner",
        scopes: [
          "read_locations",
          "write_inventory",
          "write_orders",
          "write_products",
          "read_inventory",
          "read_orders",
          "read_products",
        ],
      },
    },
  },
};

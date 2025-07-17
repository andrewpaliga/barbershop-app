import type { GadgetPermissions } from "gadget-server";

/**
 * This metadata describes the access control configuration available in your application.
 * Grants that are not defined here are set to false by default.
 *
 * View and edit your roles and permissions in the Gadget editor at https://barbershop.gadget.app/edit/settings/permissions
 */
export const permissions: GadgetPermissions = {
  type: "gadget/permissions/v1",
  roles: {
    "shopify-app-users": {
      storageKey: "Role-Shopify-App",
      models: {
        booking: {
          read: {
            filter: "accessControl/filters/shopify/booking.gelly",
          },
          actions: {
            create: true,
            delete: true,
            update: true,
          },
        },
        config: {
          read: {
            filter: "accessControl/filters/shopify/config.gelly",
          },
          actions: {
            create: true,
            delete: true,
            update: true,
          },
        },
        locationHours: {
          read: {
            filter:
              "accessControl/filters/shopify/locationHours.gelly",
          },
          actions: {
            create: true,
            delete: true,
            update: true,
          },
        },
        shopifyCustomer: {
          read: {
            filter:
              "accessControl/filters/shopify/shopifyCustomer.gelly",
          },
          actions: {
            create: true,
            delete: true,
            update: true,
          },
        },
        shopifyGdprRequest: {
          read: {
            filter:
              "accessControl/filters/shopify/shopifyGdprRequest.gelly",
          },
          actions: {
            create: true,
            update: true,
          },
        },
        shopifyLocation: {
          read: {
            filter:
              "accessControl/filters/shopify/shopifyLocation.gelly",
          },
          actions: {
            create: true,
            delete: true,
            update: true,
          },
        },
        shopifyOrder: {
          read: {
            filter:
              "accessControl/filters/shopify/shopifyOrder.gelly",
          },
          actions: {
            create: true,
            delete: true,
            update: true,
          },
        },
        shopifyOrderLineItem: {
          read: {
            filter:
              "accessControl/filters/shopify/shopifyOrderLineItem.gelly",
          },
          actions: {
            create: true,
            delete: true,
            update: true,
          },
        },
        shopifyProduct: {
          read: {
            filter:
              "accessControl/filters/shopify/shopifyProduct.gelly",
          },
          actions: {
            create: true,
            delete: true,
            update: {
              filter:
                "accessControl/filters/shopify/shopifyProduct.gelly",
            },
          },
        },
        shopifyProductVariant: {
          read: {
            filter:
              "accessControl/filters/shopify/shopifyProductVariant.gelly",
          },
        },
        shopifyShop: {
          read: {
            filter: "accessControl/filters/shopify/shopifyShop.gelly",
          },
          actions: {
            install: true,
            reinstall: true,
            uninstall: true,
            update: true,
          },
        },
        shopifySync: {
          read: {
            filter: "accessControl/filters/shopify/shopifySync.gelly",
          },
          actions: {
            abort: true,
            complete: true,
            error: true,
            run: true,
          },
        },
        staff: {
          read: {
            filter: "accessControl/filters/shopify/staff.gelly",
          },
          actions: {
            create: true,
            delete: true,
            update: true,
          },
        },
        staffAvailability: {
          read: {
            filter:
              "accessControl/filters/shopify/staffAvailability.gelly",
          },
          actions: {
            create: true,
            delete: true,
            update: true,
          },
        },
        staffDateAvailability: {
          read: {
            filter:
              "accessControl/filters/shopify/staffDateAvailability.gelly",
          },
          actions: {
            create: true,
            delete: true,
            update: true,
          },
        },
        staffProduct: {
          read: {
            filter:
              "accessControl/filters/shopify/staffProduct.gelly",
          },
          actions: {
            create: true,
            delete: true,
            update: true,
          },
        },
      },
      actions: {
        saveLocationHours: true,
      },
    },
    unauthenticated: {
      storageKey: "unauthenticated",
    },
    "Role A": {
      storageKey: "soF1nJ0ZmZiV",
    },
  },
};

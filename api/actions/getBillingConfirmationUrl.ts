import { ActionRun, ActionOptions } from "gadget-server";

export const run: ActionRun = async ({ params, logger, api, connections }) => {
  // Get shopId from params or use currentShopId from connection context
  const shopId = params.shopId || connections.shopify.currentShopId;

  if (!shopId) {
    throw new Error('shopId parameter is required or shop context must be available');
  }

  try {
    // Get the shop record
    const shop = await api.shopifyShop.findOne(shopId, {
      select: {
        id: true,
        billingStatus: true,
      },
    });

    // If billing is already active, no confirmation needed
    if (shop.billingStatus === "active") {
      return {
        requiresConfirmation: false,
        message: "Billing is already active",
      };
    }

    // Get Shopify API client for this shop
    const shopify = await connections.shopify.forShopId(shopId);

    // Query for pending subscriptions - we need to create a new one if none exists
    const query = `
      query {
        currentAppInstallation {
          activeSubscriptions {
            id
            status
            trialDays
            test
          }
        }
      }
    `;

    const response = await shopify.graphql(query);
    const activeSubscriptions = response.currentAppInstallation?.activeSubscriptions || [];

    // If there's no active subscription, check if billing status is pending
    // If pending, a subscription was created but not approved - create a new one
    // If no_billing, create a new subscription
    const hasActiveSubscription = activeSubscriptions.some((sub: any) => sub.status === "ACTIVE");
    
    if (!hasActiveSubscription) {
      // Create a new billing charge to get the confirmation URL
      // This will either create a new subscription or return an error if one already exists
      logger.info({ shopId, billingStatus: shop.billingStatus, hasActiveSubscription }, "No active subscription found, creating billing charge");
      try {
        const billingResult = await api.createBillingCharge({
          shopId,
          planName: 'basic',
          amount: 9,
          interval: 'EVERY_30_DAYS',
          trialDays: 7
        });

        logger.info({ shopId, confirmationUrl: billingResult.confirmationUrl }, "Billing charge created successfully");
        return {
          requiresConfirmation: true,
          confirmationUrl: billingResult.confirmationUrl,
        };
      } catch (error: any) {
        // If billing charge already exists, the error might indicate that
        // In this case, we can't get the confirmation URL, so return a message
        logger.error({ shopId, error: error.message, errorStack: error.stack }, "Could not create billing charge");
        
        // If the error suggests a subscription already exists, we need to query Shopify differently
        // For now, return an error that the frontend can handle
        throw new Error(`Failed to create billing charge: ${error.message}. Please check Gadget logs for details.`);
      }
    }

    return {
      requiresConfirmation: false,
      message: "Billing subscription exists",
    };
  } catch (error) {
    logger.error({ shopId, error }, "Error getting billing confirmation URL");
    throw error;
  }
};

export const params = {
  shopId: { type: "string" },
};

export const options: ActionOptions = {
  transactional: false,
};


import { ActionOptions } from "gadget-server";

export const run: ActionRun = async ({ params, logger, api, connections }) => {
  const shopId = params.shopId || connections.shopify.currentShopId;
  
  if (!shopId) {
    throw new Error("shopId is required");
  }

  // Detect environment
  const isDevelopment = process.env.NODE_ENV === "development";
  
  if (isDevelopment) {
    logger.info({ shopId }, "Checking subscription status for shop");
  }
  
  try {
    // Query Shopify's Billing API for active subscriptions
    const query = `
      query {
        currentAppInstallation {
          activeSubscriptions {
            id
            name
            status
            test
            trialDays
            currentPeriodEnd
          }
        }
      }
    `;

    const response = await connections.shopify.current.graphql(query);
    
    const subscriptions = response.currentAppInstallation?.activeSubscriptions || [];

    // Initialize return data
    let hasActiveSubscription = false;
    let isInTrial = false;
    let isTestCharge = false;
    let trialEndsAt: Date | null = null;
    let subscriptionStatus: 'ACTIVE' | 'TRIAL' | 'EXPIRED' | 'NONE' = 'NONE';
    let subscriptionName: string | null = null;

    if (subscriptions.length > 0) {
      // Get the first active subscription (merchants typically have one)
      const subscription = subscriptions[0];
      
      isTestCharge = subscription.test === true;
      subscriptionName = subscription.name;

      // Check if subscription is in trial period
      if (subscription.trialDays && subscription.trialDays > 0) {
        isInTrial = true;
        if (subscription.currentPeriodEnd) {
          trialEndsAt = new Date(subscription.currentPeriodEnd);
        }
        subscriptionStatus = 'TRIAL';
      }

      // Check if subscription is active
      if (subscription.status === 'ACTIVE') {
        hasActiveSubscription = true;
        
        // In development, test charges should be treated as valid
        if (isTestCharge && isDevelopment) {
          subscriptionStatus = isInTrial ? 'TRIAL' : 'ACTIVE';
        } else if (isTestCharge && !isDevelopment) {
          logger.warn("Test charge detected in production environment - this should not happen");
          subscriptionStatus = isInTrial ? 'TRIAL' : 'ACTIVE';
        } else {
          // Production charge
          subscriptionStatus = isInTrial ? 'TRIAL' : 'ACTIVE';
        }
      } else {
        // Subscription exists but is not active
        logger.warn({ status: subscription.status }, "Subscription exists but status is not ACTIVE");
        subscriptionStatus = 'EXPIRED';
      }
    } else {
      subscriptionStatus = 'NONE';
    }

    const result = {
      hasActiveSubscription,
      isInTrial,
      isTestCharge,
      trialEndsAt,
      subscriptionStatus,
      subscriptionName,
      environment: isDevelopment ? 'development' as const : 'production' as const
    };

    logger.info(result, "Subscription status check complete");

    return result;
  } catch (error) {
    logger.error({ error, shopId }, "Failed to check subscription status");
    throw error;
  }
};

export const params = {
  shopId: { type: "string" }
};

export const options: ActionOptions = {
  triggers: { api: true }
};

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
        appSubscriptionId: true,
        billingStatus: true,
        isTrialActive: true,
      },
    });

    // Get Shopify API client for this shop
    const shopify = await connections.shopify.forShopId(shopId);

    // Query the current app subscription status
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
    
    // Log the full response to see what Shopify returned
    const activeSubscriptions = response.currentAppInstallation?.activeSubscriptions || [];
    
    logger.info({ 
      shopId, 
      query: query,
      rawResponse: JSON.stringify(response, null, 2),
      responseStructure: {
        hasCurrentAppInstallation: !!response.currentAppInstallation,
        currentAppInstallationType: typeof response.currentAppInstallation,
        hasActiveSubscriptions: !!response.currentAppInstallation?.activeSubscriptions,
        activeSubscriptionsType: Array.isArray(response.currentAppInstallation?.activeSubscriptions) ? 'array' : typeof response.currentAppInstallation?.activeSubscriptions,
        subscriptionCount: activeSubscriptions.length,
      },
      currentAppInstallation: response.currentAppInstallation,
      activeSubscriptions: activeSubscriptions,
      subscriptionDetails: activeSubscriptions.map((sub: any) => ({
        id: sub.id,
        status: sub.status,
        trialDays: sub.trialDays,
        test: sub.test,
        fullObject: sub
      })),
      shopAppSubscriptionId: shop.appSubscriptionId,
      receivedSubscriptionIds: activeSubscriptions.map((s: any) => s.id),
      didReceiveSubscriptionId: activeSubscriptions.length > 0 && !!activeSubscriptions[0]?.id
    }, "Full GraphQL response from Shopify - checking for subscription ID");

    logger.info({ 
      shopId, 
      subscriptions: activeSubscriptions, 
      subscriptionIds: activeSubscriptions.map((s: any) => s.id),
      shopAppSubscriptionId: shop.appSubscriptionId 
    }, "Retrieved app subscriptions");

    // Determine the status based on subscriptions
    let status = "no_billing";
    let isActive = false;
    let inTrial = false;
    let requiresCharge = true;
    let subscriptionId: string | null = null;

    if (activeSubscriptions.length > 0) {
      const subscription = activeSubscriptions[0];
      subscriptionId = subscription.id;
      status = subscription.status.toLowerCase();
      isActive = subscription.status === "ACTIVE";
      inTrial = subscription.trialDays > 0;
      requiresCharge = false;

      logger.info({ 
        shopId,
        subscriptionId,
        subscriptionStatus: subscription.status,
        subscriptionTrialDays: subscription.trialDays,
        subscriptionTest: subscription.test,
        receivedSubscriptionId: !!subscriptionId,
        subscriptionIdFormat: subscriptionId ? subscriptionId.substring(0, 20) + '...' : 'null',
        shopAppSubscriptionId: shop.appSubscriptionId,
        needsUpdate: !shop.appSubscriptionId || shop.appSubscriptionId !== subscriptionId
      }, "Found active subscription - checking if we need to update local record");

      // Update the shop record based on subscription status
      const updateData: any = {};

      if (subscription.status === "ACTIVE") {
        updateData.billingStatus = "active";
        updateData.isTrialActive = inTrial;
      } else if (subscription.status === "CANCELLED") {
        updateData.billingStatus = "cancelled";
        updateData.isTrialActive = false;
      } else if (subscription.status === "EXPIRED") {
        updateData.billingStatus = "expired";
        updateData.isTrialActive = false;
      } else if (subscription.status === "PENDING") {
        updateData.billingStatus = "pending";
        updateData.isTrialActive = inTrial;
      }

      // Update appSubscriptionId if we found it and it's not set or different
      if (subscriptionId && (!shop.appSubscriptionId || shop.appSubscriptionId !== subscriptionId)) {
        updateData.appSubscriptionId = subscriptionId; // Store the full GID string
        logger.info({ 
          shopId, 
          appSubscriptionId: subscriptionId,
          previousAppSubscriptionId: shop.appSubscriptionId,
          updating: true
        }, "Updating appSubscriptionId with full GID from Shopify");
      }

      if (Object.keys(updateData).length > 0) {
        await api.shopifyShop.update(shopId, updateData);
        logger.info({ shopId, updates: updateData }, "Updated shop billing status");
      }
    } else {
      // No active subscriptions found
      requiresCharge = true;
      logger.warn({ 
        shopId, 
        shopBillingStatus: shop.billingStatus,
        shopAppSubscriptionId: shop.appSubscriptionId,
        responseFromShopify: {
          currentAppInstallation: response.currentAppInstallation,
          activeSubscriptions: response.currentAppInstallation?.activeSubscriptions,
          subscriptionCount: activeSubscriptions.length,
          rawResponse: JSON.stringify(response, null, 2)
        },
        interpretation: "Shopify returned no active subscriptions. This means either: 1) No subscription was created, 2) Subscription was created but is not yet active, or 3) Subscription was cancelled/expired."
      }, "No active subscriptions found for shop - Shopify returned empty array");
    }

    return {
      status,
      isActive,
      inTrial,
      requiresCharge,
    };
  } catch (error) {
    logger.error({ shopId, error }, "Error verifying billing status");
    throw error;
  }
};

export const params = {
  shopId: { type: "string" },
};

export const options: ActionOptions = {
  transactional: false,
};

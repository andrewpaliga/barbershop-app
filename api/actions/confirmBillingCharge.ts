import { ActionRun, ActionOptions } from "gadget-server";

export const run: ActionRun = async ({ params, logger, api, connections }) => {
  // Get shopId from params or use currentShopId from connection context
  const shopId = params.shopId || connections.shopify.currentShopId;
  const { chargeId } = params;

  if (!shopId) {
    throw new Error("shopId parameter is required or shop context must be available");
  }

  // ============================================
  // STEP 4: AFTER APPROVAL - Confirm subscription from callback
  // ============================================
  logger.info({ 
    step: "4_CALLBACK_RECEIVED",
    shopId, 
    chargeId,
    note: "Merchant approved subscription, confirming and storing subscription ID"
  }, "=== BILLING CALLBACK: Confirming subscription after merchant approval ===");

  const shop = await api.shopifyShop.findOne(shopId, {
    select: {
      id: true,
      appSubscriptionId: true,
      billingStatus: true,
      trialEndsAt: true,
    }
  });
  
  if (!shop) {
    throw new Error(`Shop with id ${shopId} not found`);
  }

  const shopify = await connections.shopify.forShopId(shopId);

  // Query for active subscriptions to confirm the subscription was approved
  const query = `
    query CurrentAppInstallationAndSubscriptions {
      currentAppInstallation {
        id
        activeSubscriptions {
          id
          name
          status
          test
          trialDays
          currentPeriodEnd
          createdAt
        }
      }
    }
  `;

  logger.info({ 
    step: "4a_QUERYING_AFTER_APPROVAL",
    query: query,
    shopId: shopId
  }, "=== QUERYING: currentAppInstallation.activeSubscriptions after approval ===");

  const response = await shopify.graphql(query);
  
  logger.info({ 
    step: "4b_RECEIVED_APPROVAL_QUERY_RESPONSE",
    fullResponse: response,
    fullResponseJSON: JSON.stringify(response, null, 2),
    currentAppInstallation: response.currentAppInstallation,
    activeSubscriptions: response.currentAppInstallation?.activeSubscriptions,
    subscriptionCount: response.currentAppInstallation?.activeSubscriptions?.length || 0
  }, "=== RECEIVED RESPONSE: currentAppInstallation.activeSubscriptions after approval ===");

  const subscriptions = response.currentAppInstallation?.activeSubscriptions || [];
  
  if (subscriptions.length === 0) {
    logger.warn({ 
      step: "4c_NO_SUBSCRIPTIONS_FOUND",
      shopId 
    }, "No active subscriptions found after approval - subscription may not be active yet");
    return {
      success: false,
      message: "No active subscriptions found",
      subscriptions: []
    };
  }

  // Find the active subscription (should be the one just approved)
  const activeSubscription = subscriptions.find((sub: any) => sub.status === "ACTIVE");
  const pendingSubscription = subscriptions.find((sub: any) => sub.status === "PENDING");

  const subscriptionToUse = activeSubscription || pendingSubscription;

  if (subscriptionToUse) {
    logger.info({ 
      step: "4d_SUBSCRIPTION_ID_CONFIRMED",
      shopId, 
      subscription: subscriptionToUse,
      subscriptionId: subscriptionToUse.id,
      status: subscriptionToUse.status,
      note: "Found subscription after approval - saving subscription ID to database"
    }, "=== CONFIRMED: Active/Pending subscription found - saving subscription ID ===");

    const now = new Date();
    const trialEndsAt = shop.trialEndsAt ? new Date(shop.trialEndsAt) : null;
    const isStillInTrial = subscriptionToUse.trialDays > 0 || (trialEndsAt ? now < trialEndsAt : false);

    // Calculate trial end date from subscription if available
    let calculatedTrialEndsAt = trialEndsAt;
    if (subscriptionToUse.trialDays > 0 && subscriptionToUse.createdAt) {
      const createdAt = new Date(subscriptionToUse.createdAt);
      calculatedTrialEndsAt = new Date(createdAt.getTime() + subscriptionToUse.trialDays * 24 * 60 * 60 * 1000);
    }

    const updateData: any = {
      appSubscriptionId: subscriptionToUse.id, // Store the full GID string
      billingStatus: subscriptionToUse.status === "ACTIVE" ? "active" : "pending",
      billingActivatedAt: subscriptionToUse.status === "ACTIVE" ? now : null,
      isTrialActive: isStillInTrial,
    };

    if (calculatedTrialEndsAt) {
      updateData.trialEndsAt = calculatedTrialEndsAt;
    }

    await api.shopifyShop.update(shopId, updateData);

    logger.info({ 
      step: "4e_SUBSCRIPTION_ID_SAVED",
      shopId, 
      appSubscriptionId: subscriptionToUse.id,
      billingStatus: updateData.billingStatus,
      isTrialActive: isStillInTrial,
      updateData: updateData
    }, "=== SAVED: Subscription ID stored in database ===");

    return {
      success: true,
      message: "Billing charge confirmed and activated",
      subscription: subscriptionToUse,
      subscriptionId: subscriptionToUse.id,
      isTrialActive: isStillInTrial
    };
  }

  logger.warn({ 
    step: "4f_NO_ACTIVE_SUBSCRIPTION",
    shopId, 
    subscriptions,
    subscriptionStatuses: subscriptions.map((s: any) => ({ id: s.id, status: s.status }))
  }, "No ACTIVE or PENDING subscription found in response after approval");
  
  return {
    success: false,
    message: "Subscription is not active yet",
    subscriptions
  };
};

export const params = {
  shopId: {
    type: "string"
  },
  chargeId: {
    type: "string"
  }
};

export const options: ActionOptions = {
  returnType: true
};

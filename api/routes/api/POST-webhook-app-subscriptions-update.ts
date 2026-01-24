import { RouteHandler } from "gadget-server";

/**
 * Webhook handler for APP_SUBSCRIPTIONS_UPDATE
 * This is called by Shopify when a subscription is created, updated, or cancelled
 * in the managed pricing system.
 */
const route: RouteHandler = async ({ request, reply, api, logger, connections }) => {
  try {
    const payload = request.body as any;
    
    logger.info({ 
      payload: JSON.stringify(payload, null, 2),
      headers: request.headers 
    }, "Received APP_SUBSCRIPTIONS_UPDATE webhook");

    // Extract shop domain from webhook payload
    const shopDomain = payload.shop_domain || payload.domain;
    
    if (!shopDomain) {
      logger.error({ payload }, "No shop domain found in webhook payload");
      await reply.code(400).send({ error: "Missing shop_domain in webhook payload" });
      return;
    }

    // Find the shop by domain
    const shop = await api.shopifyShop.findFirst({
      filter: { 
        OR: [
          { myshopifyDomain: { equals: shopDomain } },
          { domain: { equals: shopDomain } }
        ]
      },
      select: {
        id: true,
        myshopifyDomain: true,
      }
    });

    if (!shop) {
      logger.warn({ shopDomain }, "Shop not found for webhook");
      await reply.code(404).send({ error: "Shop not found" });
      return;
    }

    // Get Shopify connection for this shop
    const shopify = await connections.shopify.forShopId(shop.id);

    // Query current subscription status
    const query = `
      query {
        currentAppInstallation {
          activeSubscriptions {
            id
            name
            status
            trialDays
            currentPeriodEnd
            test
          }
        }
      }
    `;

    const response = await shopify.graphql(query);
    const activeSubscriptions = response.currentAppInstallation?.activeSubscriptions || [];

    logger.info({ 
      shopId: shop.id,
      shopDomain,
      subscriptionCount: activeSubscriptions.length,
      subscriptions: activeSubscriptions 
    }, "Fetched subscription status from webhook");

    // Update shop record based on subscription status
    let updateData: any = {};

    if (activeSubscriptions.length > 0) {
      const subscription = activeSubscriptions[0];
      const subscriptionStatus = subscription.status.toLowerCase();
      
      // Extract plan name
      let planName: string | null = null;
      if (subscription.name) {
        planName = subscription.name.replace(/\s+Plan$/i, '').toLowerCase();
      }

      // Map subscription status
      if (subscription.status === "ACTIVE") {
        updateData.billingStatus = "active";
      } else if (subscription.status === "CANCELLED") {
        updateData.billingStatus = "cancelled";
        updateData.isTrialActive = false;
      } else if (subscription.status === "EXPIRED") {
        updateData.billingStatus = "expired";
        updateData.isTrialActive = false;
      } else if (subscription.status === "PENDING") {
        updateData.billingStatus = "pending";
      }

      // Update trial information using Shopify's source of truth
      // trialDays from Shopify = remaining trial days
      // If trialDays > 0, use currentPeriodEnd as the trial end date
      if (subscription.trialDays > 0) {
        updateData.isTrialActive = true;
        updateData.trialDaysRemaining = subscription.trialDays; // Store trialDays from Shopify
        
        // Use currentPeriodEnd as the trial end date (Shopify's source of truth)
        if (subscription.currentPeriodEnd) {
          updateData.trialEndsAt = new Date(subscription.currentPeriodEnd).toISOString();
        } else {
          // Fallback: calculate from trialDays if currentPeriodEnd not available
          const now = new Date();
          const trialEnd = new Date(now);
          trialEnd.setDate(trialEnd.getDate() + subscription.trialDays);
          updateData.trialEndsAt = trialEnd.toISOString();
        }
      } else {
        // Not in trial - clear trial fields
        updateData.isTrialActive = false;
        updateData.trialEndsAt = null;
        updateData.trialDaysRemaining = null;
      }

      // Update subscription ID and plan
      if (subscription.id) {
        updateData.appSubscriptionId = subscription.id;
      }
      if (planName) {
        updateData.billingPlan = planName;
      }
    } else {
      // No active subscription
      updateData.billingStatus = "no_billing";
      updateData.isTrialActive = false;
      updateData.trialEndsAt = null;
      updateData.billingPlan = null;
    }

    // Update the shop record
    if (Object.keys(updateData).length > 0) {
      await api.shopifyShop.update(shop.id, updateData);
      logger.info({ 
        shopId: shop.id,
        shopDomain,
        updates: updateData 
      }, "Updated shop billing status from webhook");
    }

    await reply.code(200).send({ success: true });
  } catch (error: any) {
    logger.error({ 
      error: error.message, 
      stack: error.stack,
      payload: request.body 
    }, "Error processing APP_SUBSCRIPTIONS_UPDATE webhook");
    await reply.code(500).send({ error: "Internal server error" });
  }
};

export default route;


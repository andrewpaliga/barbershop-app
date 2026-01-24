import { ActionRun, ActionOptions } from "gadget-server";

/**
 * Syncs subscription status from Shopify's managed pricing system.
 * This queries the Billing API to get current subscription state and updates local records.
 */
export const run: ActionRun = async ({ params, logger, api, connections }) => {
  const shopId = params.shopId || connections.shopify.currentShopId;

  if (!shopId) {
    throw new Error('shopId parameter is required or shop context must be available');
  }

  try {
    // Get the shop record
    const shop = await api.shopifyShop.findOne(shopId, {
      select: {
        id: true,
        myshopifyDomain: true,
        appSubscriptionId: true,
        billingStatus: true,
        billingPlan: true,
        isTrialActive: true,
        trialEndsAt: true,
        trialDaysRemaining: true,
      },
    });

    if (!shop) {
      throw new Error(`Shop with id ${shopId} not found`);
    }

    // Get Shopify API client for this shop
    const shopify = await connections.shopify.forShopId(shopId);

    // Query app subscriptions using the correct query for managed pricing
    // Uses AppPlanV2 with pricingDetails union type
    const query = `
      query SyncManagedPricingStatus {
        currentAppInstallation {
          activeSubscriptions {
            id
            name
            status
            trialDays
            currentPeriodEnd
            test
            lineItems {
              plan {
                pricingDetails {
                  __typename
                  ... on AppRecurringPricing {
                    price {
                      amount
                      currencyCode
                    }
                    interval
                  }
                }
              }
            }
          }
        }
      }
    `;

    const response = await shopify.graphql(query);
    
    // Handle GraphQL response shape - may be wrapped in 'data' property
    const data = response.data ?? response;
    const activeSubscriptions = data.currentAppInstallation?.activeSubscriptions || [];

    // Log full response for debugging (don't stringify - let logger handle it)
    logger.info(
      {
        shopId,
        query,
        rawResponse: response,
        responseShape: {
          hasDataProperty: !!response.data,
          hasCurrentAppInstallation: !!data.currentAppInstallation,
          subscriptionCount: activeSubscriptions.length,
        },
      },
      "Retrieved app subscriptions from managed pricing - raw GraphQL response"
    );

    // Determine subscription status
    let updateData: any = {};
    let hasActiveSubscription = false;
    let currentPlan: string | null = null;
    let subscriptionStatus: string = "no_billing";
    let daysRemainingInTrial: number | null = null;
    let currentPeriodEnd: Date | null = null;

    if (activeSubscriptions.length > 0) {
      // For managed pricing, we typically have one active subscription
      // Be defensive: prefer ACTIVE or TRIAL status, filter out CANCELLED/EXPIRED
      let subscription = activeSubscriptions[0];
      
      // If multiple subscriptions, prefer non-cancelled/expired ones
      const activeStatuses = ["ACTIVE", "TRIAL", "PENDING"];
      const preferredSubscription = activeSubscriptions.find((sub: any) => 
        activeStatuses.includes(sub.status)
      );
      
      if (preferredSubscription) {
        subscription = preferredSubscription;
      } else {
        // If all are cancelled/expired, use the first one but log it
        logger.warn({
          shopId,
          subscriptionStatus: subscription.status,
          allStatuses: activeSubscriptions.map((sub: any) => sub.status),
        }, "All subscriptions are cancelled/expired, using first one");
      }
      
      hasActiveSubscription = true;
      subscriptionStatus = subscription.status.toLowerCase();
      currentPlan = subscription.name || null;
      
      // Extract plan name (remove "Plan" suffix if present)
      if (currentPlan) {
        currentPlan = currentPlan.replace(/\s+Plan$/i, '').toLowerCase();
      }

      // Use Shopify's subscription status as source of truth for trial state
      // trialDays from Shopify = the number of free trial days configured on the subscription
      // (not a countdown of remaining days - Shopify handles trial accounting internally)
      // If trialDays > 0 and status indicates trial, the subscription is in trial
      // Use currentPeriodEnd as the canonical trial end date (Shopify's source of truth)
      
      // Log what we're getting from Shopify for debugging
      logger.info({
        shopId,
        trialDaysFromShopify: subscription.trialDays,
        currentPeriodEndFromShopify: subscription.currentPeriodEnd,
        status: subscription.status,
      }, "Trial information from Shopify subscription");

      // Determine if subscription is in trial based on status and trialDays
      const isInTrial = subscription.trialDays > 0 && 
                       subscription.status !== "CANCELLED" && 
                       subscription.status !== "EXPIRED";

      if (isInTrial) {
        // Store trialDays as a display helper (configured trial length, not remaining)
        daysRemainingInTrial = subscription.trialDays;
        updateData.isTrialActive = true;
        updateData.trialDaysRemaining = subscription.trialDays; // Store as display helper only
        
        // Use currentPeriodEnd as the trial end date - this is Shopify's source of truth
        // If currentPeriodEnd is available, use it; otherwise calculate from trialDays
        if (subscription.currentPeriodEnd) {
          currentPeriodEnd = new Date(subscription.currentPeriodEnd);
          updateData.trialEndsAt = currentPeriodEnd.toISOString();
          logger.info({
            shopId,
            usingCurrentPeriodEnd: true,
            currentPeriodEnd: subscription.currentPeriodEnd,
            trialDays: subscription.trialDays,
          }, "Using currentPeriodEnd from Shopify as trial end date");
        } else {
          // Fallback: calculate from trialDays if currentPeriodEnd not available
          const now = new Date();
          const trialEnd = new Date(now);
          trialEnd.setDate(trialEnd.getDate() + subscription.trialDays);
          updateData.trialEndsAt = trialEnd.toISOString();
          currentPeriodEnd = trialEnd;
          logger.info({
            shopId,
            usingCurrentPeriodEnd: false,
            calculatedTrialEnd: trialEnd.toISOString(),
            trialDays: subscription.trialDays,
            calculatedFrom: "now + trialDays",
          }, "Calculated trialEndsAt from trialDays (currentPeriodEnd not available)");
        }
      } else {
        // Not in trial - clear trial fields
        updateData.isTrialActive = false;
        updateData.trialEndsAt = null;
        updateData.trialDaysRemaining = null;
        
        // Set current period end if available (for active subscriptions)
        if (subscription.currentPeriodEnd) {
          currentPeriodEnd = new Date(subscription.currentPeriodEnd);
        }
        
        logger.info({
          shopId,
          trialDays: subscription.trialDays,
          reason: "trialDays is 0 or null - not in trial",
        }, "Subscription is not in trial");
      }

      // Map subscription status to billing status
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
      } else {
        updateData.billingStatus = subscription.status.toLowerCase();
      }

      // Update appSubscriptionId
      if (subscription.id) {
        updateData.appSubscriptionId = subscription.id;
      }

      // Update billing plan name if we extracted it
      if (currentPlan) {
        updateData.billingPlan = currentPlan;
      }
    } else {
      // No active subscription - merchant hasn't selected a plan or subscription was cancelled
      updateData.billingStatus = "no_billing";
      updateData.isTrialActive = false;
      updateData.trialEndsAt = null;
      updateData.billingPlan = null;
      subscriptionStatus = "no_billing";
    }

    // Only update if there are changes
    if (Object.keys(updateData).length > 0) {
      await api.shopifyShop.update(shopId, updateData);
      logger.info({ 
        shopId, 
        updates: updateData,
        subscriptionStatus,
        hasActiveSubscription,
        currentPlan,
        daysRemainingInTrial
      }, "Updated shop billing status from managed pricing");
    }

    // Determine calculation method for debugging
    let calculationMethod = "No subscription found";
    if (activeSubscriptions.length > 0) {
      const subscription = activeSubscriptions.find((sub: any) => 
        ["ACTIVE", "TRIAL", "PENDING"].includes(sub.status)
      ) || activeSubscriptions[0];
      
      if (subscription.trialDays > 0 && subscription.currentPeriodEnd) {
        calculationMethod = "Used currentPeriodEnd from Shopify (source of truth)";
      } else if (subscription.trialDays > 0) {
        calculationMethod = "Calculated from trialDays (currentPeriodEnd not available)";
      } else {
        calculationMethod = "Not in trial (trialDays = 0)";
      }
    }

    // Get final DB state for return values
    const finalIsTrialActive = updateData.isTrialActive ?? shop?.isTrialActive ?? false;
    const inTrial = activeSubscriptions.length > 0 && finalIsTrialActive;

    return {
      status: subscriptionStatus,
      isActive: subscriptionStatus === "active",
      inTrial,
      hasActiveSubscription,
      currentPlan,
      daysRemainingInTrial,
      currentPeriodEnd: currentPeriodEnd?.toISOString() || null,
      requiresCharge: !hasActiveSubscription || subscriptionStatus === "no_billing" || subscriptionStatus === "cancelled" || subscriptionStatus === "expired",
      // Debugging information
      debug: {
        shopId,
        // Request sent to Shopify
        request: {
          query: query,
          endpoint: "Admin GraphQL API",
          operation: "SyncManagedPricingStatus",
        },
        // Full response from Shopify
        response: {
          raw: response,
          data: data,
          hasDataProperty: !!response.data,
          responseShape: {
            hasDataProperty: !!response.data,
            hasCurrentAppInstallation: !!data.currentAppInstallation,
            subscriptionCount: activeSubscriptions.length,
          },
        },
        subscriptionCount: activeSubscriptions.length,
        rawSubscriptions: activeSubscriptions.map((sub: any) => ({
          id: sub.id,
          name: sub.name,
          status: sub.status,
          trialDays: sub.trialDays,
          currentPeriodEnd: sub.currentPeriodEnd,
          test: sub.test,
          lineItems: sub.lineItems,
        })),
        storedTrialEndsAt: updateData.trialEndsAt || null,
        storedTrialDaysRemaining: updateData.trialDaysRemaining || null,
        storedIsTrialActive: updateData.isTrialActive || false,
        calculationMethod,
        shopifyTrialDays: activeSubscriptions.length > 0 ? activeSubscriptions[0].trialDays : null,
        shopifyCurrentPeriodEnd: activeSubscriptions.length > 0 ? activeSubscriptions[0].currentPeriodEnd : null,
      },
    };
  } catch (error: any) {
    logger.error({ shopId, error: error.message, stack: error.stack }, "Error syncing managed pricing status");
    throw error;
  }
};

export const params = {
  shopId: { type: "string" },
};

export const options: ActionOptions = {
  transactional: false,
};


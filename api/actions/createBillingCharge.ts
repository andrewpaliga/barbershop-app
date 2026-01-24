import { ActionRun, ActionOptions } from "gadget-server";

export const run: ActionRun = async ({ params, logger, api, connections }) => {
  const { shopId, planName, amount, interval, trialDays = 7 } = params;

  if (!shopId) {
    throw new Error('shopId parameter is required');
  }
  if (!planName) {
    throw new Error('planName parameter is required');
  }
  if (amount === undefined || amount === null) {
    throw new Error('amount parameter is required');
  }
  if (!interval) {
    throw new Error('interval parameter is required');
  }

  logger.info({ shopId, planName, amount, interval, trialDays }, "Creating billing charge");

  const shop = await api.shopifyShop.findOne(shopId, {
    select: { id: true, myshopifyDomain: true }
  });

  if (!shop) {
    throw new Error(`Shop with id ${shopId} not found`);
  }

  const currentShopId = connections.shopify.currentShopId;
  const shopify = shopId === currentShopId 
    ? connections.shopify.current 
    : await connections.shopify.forShopId(shopId);
  
  if (!shopify) {
    throw new Error("Missing Shopify connection");
  }

  const billingInterval = interval.toLowerCase() === 'annual' ? 'ANNUAL' : 'EVERY_30_DAYS';

  const appUrl = connections.shopify.configuration.appUrl || 
                 process.env.GADGET_PUBLIC_APP_URL ||
                 `https://${process.env.GADGET_ENV === 'development' ? 'simplybook--development' : 'simplybook'}.gadget.app`;
  
  const returnUrl = `${appUrl}/billing-callback?shop_id=${shopId}`;
  
  logger.info({ returnUrl, shopId }, "Creating subscription with return URL");

  const mutation = `
    mutation AppSubscriptionCreate($name: String!, $lineItems: [AppSubscriptionLineItemInput!]!, $returnUrl: URL!, $trialDays: Int) {
      appSubscriptionCreate(
        name: $name
        lineItems: $lineItems
        returnUrl: $returnUrl
        trialDays: $trialDays
      ) {
        userErrors {
          field
          message
        }
        confirmationUrl
        appSubscription {
          id
          status
          name
          test
          trialDays
          currentPeriodEnd
        }
      }
    }
  `;

  const variables = {
    name: `${planName.charAt(0).toUpperCase() + planName.slice(1)} Plan`,
    lineItems: [
      {
        plan: {
          appRecurringPricingDetails: {
            price: { amount, currencyCode: "USD" },
            interval: billingInterval
          }
        }
      }
    ],
    returnUrl,
    trialDays
  };

  logger.info({ shopId, variables }, "Sending appSubscriptionCreate mutation");

  const response = await shopify.graphql(mutation, variables);

  if (response.appSubscriptionCreate?.userErrors?.length > 0) {
    const errors = response.appSubscriptionCreate.userErrors;
    const errorMessages = errors.map((e: any) => e.message);
    logger.error({ errors }, "Failed to create app subscription");
    throw new Error(`Failed to create billing charge: ${errorMessages.join(", ")}`);
  }

  const confirmationUrl = response.appSubscriptionCreate?.confirmationUrl;
  const subscriptionId = response.appSubscriptionCreate?.appSubscription?.id;

  if (!confirmationUrl) {
    throw new Error("No confirmation URL returned from Shopify");
  }

  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + trialDays);

  const updateData: any = {
    billingStatus: "pending",
    billingPlan: planName,
    billingInterval: interval,
    trialEndsAt,
    isTrialActive: true,
  };

  if (subscriptionId) {
    updateData.appSubscriptionId = subscriptionId;
  }

  try {
    await api.shopifyShop.update(shopId, updateData);
    logger.info({ shopId, subscriptionId }, "Updated shop with billing information");
  } catch (updateError: any) {
    logger.error({ shopId, error: updateError.message }, "Failed to update shop record");
  }

  logger.info({ confirmationUrl, subscriptionId, shopId }, "Successfully created billing charge");

  return {
    confirmationUrl,
    subscriptionId,
    trialEndsAt
  };
};

export const params = {
  shopId: { type: "string" },
  planName: { type: "string" },
  amount: { type: "number" },
  interval: { type: "string" },
  trialDays: { type: "number" }
};

export const options: ActionOptions = {
  returnType: true
};

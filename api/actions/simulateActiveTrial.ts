import { ActionRun, ActionOptions } from "gadget-server";

export const run: ActionRun = async ({ params, logger, api, connections }) => {
  // Get shopId from params or use currentShopId from connection context
  const shopId = params.shopId || connections.shopify.currentShopId;

  if (!shopId) {
    throw new Error('shopId parameter is required or shop context must be available');
  }

  logger.info({ shopId }, "Simulating active trial - setting trial to start now");

  // Get the shop record
  const shop = await api.shopifyShop.findOne(shopId, {
    select: {
      id: true,
    },
  });

  if (!shop) {
    throw new Error(`Shop with id ${shopId} not found`);
  }

  // Set trial to start now and end in 7 days
  // This simulates a user rejecting the charge, with a 7-day trial active
  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + 7);

  await api.shopifyShop.update(shopId, {
    trialEndsAt: trialEndsAt.toISOString(),
    isTrialActive: true,
    billingStatus: "pending",
  });

  logger.info({ shopId, trialEndsAt }, "Successfully simulated active trial");

  return {
    success: true,
    message: "Active trial simulated - trial ends in 7 days",
    trialEndsAt: trialEndsAt.toISOString(),
  };
};

export const params = {
  shopId: { type: "string" },
};

export const options: ActionOptions = {
  transactional: false,
};


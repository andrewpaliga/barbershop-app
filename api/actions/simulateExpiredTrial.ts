import { ActionRun, ActionOptions } from "gadget-server";

export const run: ActionRun = async ({ params, logger, api, connections }) => {
  // Get shopId from params or use currentShopId from connection context
  const shopId = params.shopId || connections.shopify.currentShopId;

  if (!shopId) {
    throw new Error('shopId parameter is required or shop context must be available');
  }

  logger.info({ shopId }, "Simulating expired trial - setting trial to 8 days ago");

  // Get the shop record
  const shop = await api.shopifyShop.findOne(shopId, {
    select: {
      id: true,
    },
  });

  if (!shop) {
    throw new Error(`Shop with id ${shopId} not found`);
  }

  // Set trial to 8 days ago - simulates expired trial, paywall should appear
  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() - 8);

  await api.shopifyShop.update(shopId, {
    trialEndsAt: trialEndsAt.toISOString(),
    isTrialActive: false,
    billingStatus: "expired",
  });

  logger.info({ shopId, trialEndsAt }, "Successfully simulated expired trial");

  return {
    success: true,
    message: "Expired trial simulated - trial ended 8 days ago, paywall should appear",
    trialEndsAt: trialEndsAt.toISOString(),
  };
};

export const params = {
  shopId: { type: "string" },
};

export const options: ActionOptions = {
  transactional: false,
};


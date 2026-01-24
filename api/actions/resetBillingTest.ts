import { ActionRun, ActionOptions } from "gadget-server";

export const run: ActionRun = async ({ params, logger, api, connections }) => {
  // Get shopId from params or use currentShopId from connection context
  const shopId = params.shopId || connections.shopify.currentShopId;

  if (!shopId) {
    throw new Error('shopId parameter is required or shop context must be available');
  }

  logger.info({ shopId }, "Resetting billing test - removing reinstall date");

  // Get the shop record
  const shop = await api.shopifyShop.findOne(shopId, {
    select: {
      id: true,
      billingActivatedAt: true,
      shopifyCreatedAt: true,
    },
  });

  if (!shop) {
    throw new Error(`Shop with id ${shopId} not found`);
  }

  // Reset billingActivatedAt to null - this simulates a fresh install
  // Trial will be calculated from original install date (shopifyCreatedAt)
  await api.shopifyShop.update(shopId, {
    billingActivatedAt: null,
    trialEndsAt: null,
    isTrialActive: false,
  });

  logger.info({ shopId }, "Successfully reset billing test state");

  return {
    success: true,
    message: "Billing test reset - trial will be calculated from original install date",
  };
};

export const params = {
  shopId: { type: "string" },
};

export const options: ActionOptions = {
  transactional: false,
};


import { RouteHandler } from "gadget-server";

const route: RouteHandler = async ({ reply, api, connections, logger }) => {
  try {
    const rawShopId = connections.shopify.currentShopId;
    if (!rawShopId) {
      logger.warn("No shop context found in connections.shopify.currentShopId");
      await reply.code(400).send({ error: "No shop context available" });
      return;
    }
    const shopId = String(rawShopId);
    
    logger.info(`Fetching locations for shop: ${shopId}`);

    const locations = await api.shopifyLocation.findMany({
      filter: { 
        shopId: { equals: shopId },
        offersServices: { equals: true } 
      },
      select: {
        id: true,
        name: true,
        offersServices: true
      }
    });

    logger.info(`Found ${locations.length} locations`);
    await reply.code(200).send({ locations });
    
  } catch (err: any) {
    logger.error({ err }, "Failed to fetch locations");
    await reply.code(500).send({ 
      error: "Failed to fetch locations", 
      details: err?.message || "Unknown error" 
    });
  }
};

export default route;

import { RouteHandler } from "gadget-server";

const route: RouteHandler = async ({ reply, api, connections, logger, params }) => {
  try {
    const rawShopId = connections.shopify.currentShopId;
    if (!rawShopId) {
      logger.warn("No shop context found in connections.shopify.currentShopId");
      await reply.code(400).send({ error: "No shop context available" });
      return;
    }
    const shopId = String(rawShopId);
    
    const staffId = params?.id;
    if (!staffId) {
      await reply.code(400).send({ error: "Staff ID required" });
      return;
    }

    logger.info(`Fetching staff member ${staffId} for shop: ${shopId}`);

    const staff = await api.staff.findOne(staffId, {
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        bio: true,
        isActive: true,
        avatar: {
          url: true
        }
      }
    });

    if (!staff) {
      await reply.code(404).send({ error: "Staff member not found" });
      return;
    }

    logger.info(`Found staff member: ${staff.name}`);
    await reply.code(200).send({ staff });
    
  } catch (err: any) {
    logger.error({ err }, "Failed to fetch staff member");
    await reply.code(500).send({ 
      error: "Failed to fetch staff member", 
      details: err?.message || "Unknown error" 
    });
  }
};

export default route;

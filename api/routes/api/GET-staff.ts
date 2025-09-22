import { RouteHandler } from "gadget-server";

const route: RouteHandler = async ({ reply, api, connections, logger }) => {
  try {
    const rawShopId = connections.shopify.currentShopId;
    if (!rawShopId) {
      await reply.code(400).send({ error: "No shop context" });
      return;
    }
    const shopId = String(rawShopId);

    const staff = await api.staff.findMany({
      filter: { shopId: { equals: shopId } },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        isActive: true,
        title: true
      }
    });

    await reply.code(200).send({ staff });
  } catch (err: any) {
    logger.error({ err }, "Failed to load staff");
    await reply.code(500).send({ error: err?.message || "Unknown error" });
  }
};

export default route;

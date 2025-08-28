import { RouteHandler } from "gadget-server";

const route: RouteHandler = async ({ reply, api, connections, params }) => {
  try {
    const rawShopId = connections.shopify.currentShopId;
    if (!rawShopId) {
      await reply.code(400).send({ error: "Staff ID required" });
      return;
    }
    const shopId = String(rawShopId);

    const staffId = params?.id;
    if (!staffId) {
      await reply.code(400).send({ error: "Staff ID required" });
      return;
    }

    const availability = await api.staffDateAvailability.findMany({
      filter: { staffId: { equals: staffId } },
      select: {
        id: true,
        date: true,
        startTime: true,
        endTime: true,
        isAvailable: true,
        notes: true,
        location: {
          id: true,
          name: true
        }
      }
    });

    await reply.code(200).send({ availability });
  } catch (err: any) {
    await reply.code(500).send({ error: err?.message || "Unknown error" });
  }
};

export default route;

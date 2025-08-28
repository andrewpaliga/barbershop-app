import { RouteHandler } from "gadget-server";

const route: RouteHandler = async ({ reply, api, connections, request }) => {
  try {
    const rawShopId = connections.shopify.currentShopId;
    if (!rawShopId) {
      await reply.code(400).send({ error: "No shop context" });
      return;
    }
    const shopId = String(rawShopId);

    const body = await request.json();
    const { staffId, date, startTime, endTime, isAvailable, notes } = body;

    const availability = await api.staffDateAvailability.create({
      staff: { _link: staffId },
      date,
      startTime,
      endTime,
      isAvailable,
      notes
    });

    await reply.code(200).send({ availability });
  } catch (err: any) {
    await reply.code(500).send({ error: err?.message || "Unknown error" });
  }
};

export default route;

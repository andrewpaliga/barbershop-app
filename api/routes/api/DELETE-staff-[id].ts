import { RouteHandler } from "gadget-server";

const route: RouteHandler = async ({ reply, api, connections, params }) => {
  try {
    const rawShopId = connections.shopify.currentShopId;
    if (!rawShopId) {
      await reply.code(400).send({ error: "No shop context" });
      return;
    }
    const shopId = String(rawShopId);

    const staffId = params?.id;
    if (!staffId) {
      await reply.code(400).send({ error: "Staff ID required" });
      return;
    }

    await api.staff.delete(staffId);

    await reply.code(200).send({ success: true });
  } catch (err: any) {
    await reply.code(500).send({ error: err?.message || "Unknown error" });
  }
};

export default route;

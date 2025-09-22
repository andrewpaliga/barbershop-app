import { RouteHandler } from "gadget-server";

const route: RouteHandler = async ({ reply, api, connections, params, request }) => {
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

    const body = await request.json();
    const { name, email, phone, title, isActive } = body;

    const updatedStaff = await api.staff.update(staffId, {
      name,
      email,
      phone,
      title,
      isActive
    });

    await reply.code(200).send({ staff: updatedStaff });
  } catch (err: any) {
    await reply.code(500).send({ error: err?.message || "Unknown error" });
  }
};

export default route;
```


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
    const { staffId, dayOfWeek, startTime, endTime, isAvailable } = body;

    const availability = await api.staffAvailability.create({
      staff: { _link: staffId },
      dayOfWeek,
      startTime,
      endTime,
      isAvailable
    });

    await reply.code(200).send({ availability });
  } catch (err: any) {
    await reply.code(500).send({ error: err?.message || "Unknown error" });
  }
};

export default route;
```

```


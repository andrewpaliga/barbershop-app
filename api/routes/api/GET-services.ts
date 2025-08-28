import { RouteHandler } from "gadget-server";

const route: RouteHandler = async ({ reply, api, connections, logger }) => {
  try {
    const rawShopId = connections.shopify.currentShopId;
    if (!rawShopId) {
      await reply.code(400).send({ error: "No shop context" });
      return;
    }
    const shopId = String(rawShopId);

    const products = await api.shopifyProduct.findMany({
      filter: {
        shopId: { equals: shopId },
        productType: { 
          in: ["Service", "service", "SERVICE"] 
        },
        status: { equals: "active" }
      },
      select: {
        id: true,
        title: true,
        shop: { myshopifyDomain: true },
        variants: {
          edges: {
            node: {
              id: true,
              price: true
            }
          }
        }
      }
    });

    const services = products.map((p: any) => {
      const firstVariant = p.variants?.edges?.[0]?.node;
      return {
        id: p.id,
        title: p.title,
        shopDomain: p.shop?.myshopifyDomain || null,
        price: firstVariant?.price ?? null,
        variantCount: p.variants?.edges?.length || 0
      };
    });

    await reply.code(200).send({ services });
  } catch (err: any) {
    logger.error({ err }, "Failed to load services");
    await reply.code(500).send({ error: err?.message || "Unknown error" });
  }
};

export default route;

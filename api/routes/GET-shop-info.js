const route = async ({ request, reply, api, logger, connections }) => {
  try {
    // Get the current shop ID from the Shopify connection
    const shopId = connections.shopify.currentShopId;
    
    if (!shopId) {
      await reply.code(400).send({
        error: "No shop ID found in connection context"
      });
      return;
    }

    // Query the shopifyShop model to get shop details
    const shop = await api.shopifyShop.findFirst({
      filter: {
        id: { equals: shopId }
      },
      select: {
        id: true,
        domain: true,
        name: true,
        myshopifyDomain: true
      }
    });

    if (!shop) {
      await reply.code(404).send({
        error: "Shop not found"
      });
      return;
    }

    // Set JSON content type and return shop information
    await reply
      .header('Content-Type', 'application/json')
      .send({
        shopId: shop.id,
        domain: shop.domain,
        name: shop.name,
        myshopifyDomain: shop.myshopifyDomain
      });
      
  } catch (error) {
    logger.error({ error: error.message }, "Error fetching shop information");
    await reply.code(500).send({
      error: "Internal server error"
    });
  }
};

export default route;
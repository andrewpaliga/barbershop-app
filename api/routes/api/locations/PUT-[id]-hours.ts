import { RouteHandler } from "gadget-server";

interface UpdateLocationHoursBody {
  operatingHours?: any;
  holidayClosures?: any;
}

const route: RouteHandler<{ 
  Params: { id: string }; 
  Body: UpdateLocationHoursBody;
}> = async ({ request, reply, api, logger, connections, applicationSession }) => {
  try {
    const locationId = request.params.id;
    const { operatingHours, holidayClosures } = request.body;
    
    // Debug logging to see what's available
    logger.info("Route context debug info", {
      hasConnections: !!connections,
      hasShopifyConnection: !!connections?.shopify,
      connectionsShopifyKeys: connections?.shopify ? Object.keys(connections.shopify) : null,
      hasApplicationSession: !!applicationSession,
      applicationSessionKeys: applicationSession ? Object.keys(applicationSession) : null,
      applicationSessionShopId: applicationSession?.shopId,
      applicationSessionShop: applicationSession?.shop
    });
    
    // Try multiple approaches to get the shop ID
    let shopId;
    
    // Approach 1: connections.shopify.currentShopId
    if (connections?.shopify?.currentShopId) {
      shopId = connections.shopify.currentShopId;
      logger.info("Got shop ID from connections.shopify.currentShopId", { shopId });
    }
    // Approach 2: connections.shopify.current.shop.id
    else if (connections?.shopify?.current?.shop?.id) {
      shopId = connections.shopify.current.shop.id;
      logger.info("Got shop ID from connections.shopify.current.shop.id", { shopId });
    }
    // Approach 3: applicationSession.shopId
    else if (applicationSession?.shopId) {
      shopId = applicationSession.shopId;
      logger.info("Got shop ID from applicationSession.shopId", { shopId });
    }
    // Approach 4: applicationSession.shop.id
    else if (applicationSession?.shop?.id) {
      shopId = applicationSession.shop.id;
      logger.info("Got shop ID from applicationSession.shop.id", { shopId });
    }
    
    if (!shopId) {
      logger.error("Could not determine shop ID from any available source", {
        connectionsShopify: connections?.shopify,
        applicationSession: applicationSession
      });
      await reply.code(401).send({ 
        error: "Unauthorized", 
        message: "No shop context found" 
      });
      return;
    }
    
    logger.info("Successfully determined shop ID", { shopId });

    // First, verify the location exists and belongs to the current shop
    const existingLocation = await api.internal.shopifyLocation.findOne(locationId, {
      select: { id: true, shopId: true, name: true }
    });

    if (!existingLocation) {
      await reply.code(404).send({ 
        error: "Not Found", 
        message: "Location not found" 
      });
      return;
    }

    if (existingLocation.shopId !== shopId) {
      await reply.code(403).send({ 
        error: "Forbidden", 
        message: "Location does not belong to current shop" 
      });
      return;
    }

    // Update the location with new operating hours and holiday closures
    const updateData: any = {};
    
    if (operatingHours !== undefined) {
      updateData.operatingHours = operatingHours;
    }
    
    if (holidayClosures !== undefined) {
      updateData.holidayClosures = holidayClosures;
    }

    // Only proceed if we have data to update
    if (Object.keys(updateData).length === 0) {
      await reply.code(400).send({ 
        error: "Bad Request", 
        message: "No valid data provided for update" 
      });
      return;
    }

    const updatedLocation = await api.internal.shopifyLocation.update(locationId, updateData);

    logger.info(`Successfully updated location hours for location ${locationId}`);

    await reply.code(200).send({
      success: true,
      message: "Location hours updated successfully",
      location: updatedLocation
    });

  } catch (error: any) {
    logger.error(`Error updating location hours: ${error.message}`, { 
      error: error.stack || error.toString(),
      locationId: request.params.id,
      requestBody: request.body
    });
    
    await reply.code(500).send({
      error: "Internal Server Error",
      message: "An error occurred while updating location hours"
    });
  }
};

route.options = {
  schema: {
    params: {
      type: "object",
      properties: {
        id: { type: "string" }
      },
      required: ["id"]
    },
    body: {
      type: "object",
      properties: {
        operatingHours: { 
          type: ["object", "null"],
          description: "JSON object containing operating hours data"
        },
        holidayClosures: { 
          type: ["object", "null"],
          description: "JSON object containing holiday closures data"
        }
      },
      additionalProperties: false
    }
  }
};

export default route;
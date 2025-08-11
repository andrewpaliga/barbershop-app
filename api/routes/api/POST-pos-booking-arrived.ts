import { RouteHandler } from "gadget-server";

const route: RouteHandler<{ Body: { bookingId: string } }> = async ({ 
  request, 
  reply, 
  api, 
  logger, 
  connections 
}) => {
  // Handle CORS preflight requests
  if (request.method === 'OPTIONS') {
    await reply
      .header('Access-Control-Allow-Origin', '*')
      .header('Access-Control-Allow-Methods', 'POST, OPTIONS')
      .header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
      .code(200)
      .send();
    return;
  }

  // Set CORS headers for actual request
  reply
    .header('Access-Control-Allow-Origin', '*')
    .header('Access-Control-Allow-Methods', 'POST, OPTIONS')
    .header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  try {
    logger.info("POS booking arrived route hit", { 
      method: request.method, 
      url: request.url,
      body: request.body
    });

    // Get current shop ID for tenancy
    const shopId = connections.shopify.currentShopId;
    
    if (!shopId) {
      logger.error("No shop ID found in connection");
      await reply.code(401).send({ 
        error: "Unauthorized - No shop context found" 
      });
      return;
    }

    // Extract booking ID from request body
    const { bookingId } = request.body;
    
    if (!bookingId) {
      logger.error("No booking ID provided in request body");
      await reply.code(400).send({ 
        error: "Missing bookingId in request body" 
      });
      return;
    }

    logger.info("Updating booking arrived status", { 
      bookingId, 
      shopId 
    });

    // Find the booking first to ensure it exists and belongs to this shop
    const existingBooking = await api.booking.findOne(bookingId, {
      filter: {
        shopId: { equals: shopId }
      }
    });

    if (!existingBooking) {
      logger.error("Booking not found or doesn't belong to this shop", { 
        bookingId, 
        shopId 
      });
      await reply.code(404).send({ 
        error: "Booking not found" 
      });
      return;
    }

    // Update the booking with arrived=true
    const updatedBooking = await api.booking.update(bookingId, {
      arrived: true
    });

    logger.info("Successfully updated booking arrived status", { 
      bookingId, 
      shopId,
      arrived: updatedBooking.arrived
    });

    // Return success response with updated booking data
    await reply.code(200).send({
      success: true,
      booking: updatedBooking,
      message: "Booking marked as arrived successfully"
    });

  } catch (error) {
    logger.error("Error updating booking arrived status", { 
      error: error.message,
      stack: error.stack,
      body: request.body
    });
    
    await reply.code(500).send({ 
      error: "Internal server error",
      message: error.message 
    });
  }
};

// Set route options with expected body schema
route.options = {
  schema: {
    body: {
      type: "object",
      properties: {
        bookingId: { type: "string" }
      },
      required: ["bookingId"]
    }
  }
};

export default route;
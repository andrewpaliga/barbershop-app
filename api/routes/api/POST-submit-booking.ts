import { RouteHandler } from "gadget-server";

interface BookingSubmissionBody {
  scheduledAt: string; // ISO datetime string
  productId: string;
  staffId: string;
  locationId: string;
  variantId?: string;
  duration: number;
  totalPrice: number;
  status: string;
  notes?: string;
  shop: string; // shop domain
}

const route: RouteHandler<{ Body: BookingSubmissionBody }> = async ({ 
  request, 
  reply, 
  api, 
  logger, 
  connections 
}) => {
  try {
    // Set CORS headers to allow cross-origin requests from storefront
    await reply.header('Access-Control-Allow-Origin', '*');
    await reply.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
    await reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Handle preflight OPTIONS request
    if (request.method === 'OPTIONS') {
      await reply.status(200).send();
      return;
    }

    const body = request.body;
    
    // Debug logging to see exactly what data is being received
    console.log('=== BOOKING SUBMISSION DEBUG ===');
    console.log('Request method:', request.method);
    console.log('Request body:', JSON.stringify(body, null, 2));
    console.log('Request headers:', JSON.stringify(request.headers, null, 2));
    logger.info({ 
      requestBody: body, 
      requestHeaders: request.headers 
    }, "Booking submission received");
    
    // Validate required fields
    if (!body.scheduledAt || !body.productId || !body.staffId || 
        !body.locationId || !body.duration || body.totalPrice === undefined || 
        !body.status || !body.shop) {
      await reply.status(400).send({
        success: false,
        error: "Missing required fields: scheduledAt, productId, staffId, locationId, duration, totalPrice, status, shop"
      });
      return;
    }

    // Find shop by domain since this is coming from storefront
    const shop = await api.shopifyShop.findFirst({
      filter: { domain: { equals: body.shop } },
      select: { id: true, domain: true }
    });

    if (!shop) {
      await reply.status(404).send({
        success: false,
        error: "Shop not found"
      });
      return;
    }

    const shopId = shop.id;

    // Validate that the product exists and belongs to this shop
    const product = await api.shopifyProduct.findOne(body.productId, {
      filter: { shopId: { equals: shopId } },
      select: { id: true, title: true }
    });

    if (!product) {
      await reply.status(404).send({
        success: false,
        error: "Service not found"
      });
      return;
    }

    // Validate that the location exists and belongs to this shop
    const location = await api.shopifyLocation.findOne(body.locationId, {
      filter: { shopId: { equals: shopId } },
      select: { id: true, name: true }
    });

    if (!location) {
      await reply.status(404).send({
        success: false,
        error: "Location not found"
      });
      return;
    }

    // Validate that the staff exists and belongs to this shop
    const staff = await api.staff.findOne(body.staffId, {
      filter: { shopId: { equals: shopId } },
      select: { id: true, name: true }
    });

    if (!staff) {
      await reply.status(404).send({
        success: false,
        error: "Staff member not found"
      });
      return;
    }

    // Parse scheduledAt from ISO datetime string
    const scheduledAt = new Date(body.scheduledAt);
    
    // Validate that the date is valid
    if (isNaN(scheduledAt.getTime())) {
      await reply.status(400).send({
        success: false,
        error: "Invalid scheduledAt datetime format"
      });
      return;
    }

    // Check if the booking time is in the future
    if (scheduledAt <= new Date()) {
      await reply.status(400).send({
        success: false,
        error: "Booking time must be in the future"
      });
      return;
    }

    // Create the booking record
    const booking = await api.booking.create({
      scheduledAt,
      product: { _link: body.productId },
      totalPrice: body.totalPrice,
      staff: { _link: body.staffId },
      duration: body.duration,
      status: body.status,
      notes: body.notes || null,
      shop: { _link: shopId },
      location: { _link: body.locationId }
    }, {
      select: {
        id: true,
        scheduledAt: true,
        status: true,
        customerName: true,
        customerEmail: true,
        duration: true,
        totalPrice: true,
        notes: true,
        product: { id: true, title: true },
        staff: { id: true, name: true },
        location: { id: true, name: true }
      }
    });

    logger.info({ bookingId: booking.id }, "Booking created successfully");

    await reply.status(201).send({
      success: true,
      booking: {
        id: booking.id,
        scheduledAt: booking.scheduledAt,
        status: booking.status,
        customerName: booking.customerName,
        customerEmail: booking.customerEmail,
        duration: booking.duration,
        totalPrice: booking.totalPrice,
        notes: booking.notes,
        service: {
          id: booking.product.id,
          title: booking.product.title
        },
        staff: {
          id: booking.staff.id,
          name: booking.staff.name
        },
        location: {
          id: booking.location.id,
          name: booking.location.name
        }
      }
    });

  } catch (error) {
    logger.error(error, "Error creating booking");
    
    await reply.status(500).send({
      success: false,
      error: "Internal server error while creating booking"
    });
  }
};

// Set route options including schema validation
route.options = {
  schema: {
    body: {
      type: "object",
      properties: {
        scheduledAt: { type: "string", format: "date-time" },
        productId: { type: "string" },
        staffId: { type: "string" },
        locationId: { type: "string" },
        variantId: { type: "string" },
        duration: { type: "number", minimum: 1 },
        totalPrice: { type: "number", minimum: 0 },
        status: { type: "string" },
        notes: { type: "string" },
        shop: { type: "string" }
      },
      required: ["scheduledAt", "productId", "staffId", "locationId", "duration", "totalPrice", "status", "shop"],
      additionalProperties: false
    }
  }
};

export default route;
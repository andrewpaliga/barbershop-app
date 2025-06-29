import { RouteHandler } from "gadget-server";

interface BookingSubmissionBody {
  serviceId: string;
  customerName: string;
  customerEmail: string;
  locationId: string;
  staffId?: string;
  bookingDate: string; // YYYY-MM-DD format
  bookingTime: string; // HH:MM format
  duration: number;
  notes?: string;
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
    
    // Validate required fields
    if (!body.serviceId || !body.customerName || !body.customerEmail || 
        !body.locationId || !body.bookingDate || !body.bookingTime || 
        !body.duration) {
      await reply.status(400).send({
        success: false,
        error: "Missing required fields: serviceId, customerName, customerEmail, locationId, bookingDate, bookingTime, duration"
      });
      return;
    }

    // Get current shop ID for tenancy
    const shopId = connections.shopify.currentShopId?.toString();
    if (!shopId) {
      await reply.status(401).send({
        success: false,
        error: "Shop context not found"
      });
      return;
    }

    // Validate that the product exists and belongs to this shop
    const product = await api.shopifyProduct.findOne(body.serviceId, {
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

    // Handle staff selection
    let staffId = body.staffId;
    if (!staffId) {
      // If no staff specified, find the first available staff for this location
      const availableStaff = await api.staff.findMany({
        filter: { 
          shopId: { equals: shopId },
          locationId: { equals: body.locationId },
          isActive: { equals: true }
        },
        first: 1,
        select: { id: true }
      });

      if (availableStaff.length === 0) {
        await reply.status(400).send({
          success: false,
          error: "No available staff found for this location"
        });
        return;
      }
      staffId = availableStaff[0].id;
    } else {
      // Validate that the specified staff exists and belongs to this shop
      const staff = await api.staff.findOne(staffId, {
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
    }

    // Combine date and time into scheduledAt datetime
    const scheduledAt = new Date(`${body.bookingDate}T${body.bookingTime}:00`);
    
    // Validate that the date is valid
    if (isNaN(scheduledAt.getTime())) {
      await reply.status(400).send({
        success: false,
        error: "Invalid booking date or time format"
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

    // For now, we'll use a default price of 0 since we don't have pricing data
    // In a real implementation, you would fetch this from the product or have a separate pricing model
    const totalPrice = 0;

    // Create the booking record
    const booking = await api.booking.create({
      scheduledAt,
      product: { _link: body.serviceId },
      totalPrice,
      customerName: body.customerName,
      customerEmail: body.customerEmail,
      staff: { _link: staffId },
      duration: body.duration,
      status: "pending",
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
        serviceId: { type: "string" },
        customerName: { type: "string" },
        customerEmail: { type: "string", format: "email" },
        locationId: { type: "string" },
        staffId: { type: "string" },
        bookingDate: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
        bookingTime: { type: "string", pattern: "^\\d{2}:\\d{2}$" },
        duration: { type: "number", minimum: 1 },
        notes: { type: "string" }
      },
      required: ["serviceId", "customerName", "customerEmail", "locationId", "bookingDate", "bookingTime", "duration"],
      additionalProperties: false
    }
  }
};

export default route;
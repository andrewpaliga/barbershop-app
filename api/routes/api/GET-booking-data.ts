import { RouteHandler } from "gadget-server";

const route: RouteHandler = async ({ request, reply, api, logger, connections }) => {
  try {
    let shopId: string | null = null;

    // Get shop context
    const rawShopId = connections.shopify.currentShopId;
    if (rawShopId) {
      shopId = String(rawShopId);
      logger.info(`Found shop ID from session context: ${shopId}`);
    } else {
      const shopDomain = request.query?.shop as string;
      logger.info(`No session context found, checking query params. Shop domain: ${shopDomain}`);

      if (!shopDomain) {
        await reply.code(400).send({ error: "Shop context not found. Please include shop information." });
        return;
      }

      const shopRecord = await api.shopifyShop.findFirst({
        filter: { OR: [{ myshopifyDomain: { equals: shopDomain } }, { domain: { equals: shopDomain } }] },
        select: { id: true, name: true, myshopifyDomain: true, domain: true }
      });

      if (!shopRecord) {
        await reply.code(404).send({ error: "Shop not found", message: `No shop for domain: ${shopDomain}` });
        return;
      }
      shopId = shopRecord.id;
      logger.info(`Found shop ID from domain lookup: ${shopId} (${shopRecord.name})`);
    }

    if (!shopId) {
      await reply.code(400).send({ error: "Unable to determine shop context" });
      return;
    }

    // CORS headers
    reply.header("Access-Control-Allow-Origin", "*");
    reply.header("Access-Control-Allow-Methods", "GET, OPTIONS");
    reply.header("Access-Control-Allow-Headers", "Content-Type, Authorization");

    // Fetch services
    const services = await api.shopifyProduct.findMany({
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
          body: true,
          handle: true,
          productType: true,
          vendor: true,
          variants: {
            edges: {
              node: {
                id: true,
                title: true,
                price: true,
                compareAtPrice: true,
                option1: true,
                sku: true,
                image: true
              }
            }
          }
        }
    });

    logger.info(`Found ${services.length} services`);

    // Use existing variant images from the database
    const variantImages = new Map();
    
    for (const service of services) {
      if (service.variants?.edges) {
        // Use existing variant images that were populated by the action
        service.variants.edges.forEach(edge => {
          if (edge.node.image && edge.node.image.url) {
            variantImages.set(edge.node.id, edge.node.image);
            logger.info(`Using existing image for variant ${edge.node.id}: ${edge.node.image.url}`);
          }
        });
      }
    }

    // Fetch other data
    const [staff, locations, staffAvailability, staffDateAvailability, existingBookings] = await Promise.all([
      api.staff.findMany({
        filter: { 
          shopId: { equals: shopId }, 
          isActive: { notEquals: false } // Include staff unless explicitly marked inactive
        },
        select: {
          id: true, name: true, email: true, phone: true, bio: true,
          avatar: { url: true, fileName: true }
        }
      }),
      api.shopifyLocation.findMany({
        filter: { 
          shopId: { equals: shopId }, 
          active: { equals: true },
          offersServices: { equals: true }
        },
        select: {
          id: true, name: true, address1: true, address2: true, city: true,
          province: true, country: true, zipCode: true, phone: true, offersServices: true
        }
      }),
      api.staffAvailability.findMany({
        filter: { shopId: { equals: shopId }, isAvailable: { equals: true } },
        select: {
          id: true, staffId: true, locationId: true, dayOfWeek: true,
          startTime: true, endTime: true, isAvailable: true
        }
      }),
      api.staffDateAvailability.findMany({
        filter: { shopId: { equals: shopId } },
        select: {
          id: true, staffId: true, locationId: true, date: true,
          startTime: true, endTime: true, isAvailable: true
        }
      }),
      api.booking.findMany({
        filter: { shopId: { equals: shopId }, status: { in: ["pending", "paid", "confirmed", "not_paid"] } },
        select: {
          id: true, scheduledAt: true, duration: true, status: true,
          staffId: true, locationId: true, variantId: true, totalPrice: true,
          customerName: true, customerEmail: true, notes: true, arrived: true
        }
      })
    ]);

    // Log detailed booking information for debugging
    logger.info(`=== BOOKING DATA DEBUG INFO ===`);
    logger.info(`Shop ID used for query: ${shopId}`);
    logger.info(`Current server time: ${new Date().toISOString()}`);
    logger.info(`Current server timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`);
    logger.info(`Total existing bookings found: ${existingBookings.length}`);
    
    if (existingBookings.length > 0) {
      logger.info(`=== EXISTING BOOKINGS DETAILS ===`);
      existingBookings.forEach((booking, index) => {
        logger.info(`Booking ${index + 1}:`);
        logger.info(`  - ID: ${booking.id}`);
        logger.info(`  - Staff ID: ${booking.staffId}`);
        logger.info(`  - Location ID: ${booking.locationId}`);
        logger.info(`  - Variant ID: ${booking.variantId}`);
        logger.info(`  - Scheduled At: ${booking.scheduledAt} (${new Date(booking.scheduledAt).toISOString()})`);
        logger.info(`  - Duration: ${booking.duration} minutes`);
        logger.info(`  - Status: ${booking.status}`);
        logger.info(`  - Total Price: ${booking.totalPrice}`);
        logger.info(`  - Customer: ${booking.customerName} (${booking.customerEmail})`);
        logger.info(`  - Arrived: ${booking.arrived}`);
        logger.info(`  - Notes: ${booking.notes || 'None'}`);
        logger.info(`  ---`);
      });
    } else {
      logger.info(`No existing bookings found for shop ${shopId}`);
    }
    logger.info(`=== END BOOKING DEBUG INFO ===`);

    // Helper function to parse duration
    const parseDuration = (text: string): number | null => {
      if (!text) return null;
      const minMatch = text.match(/(\d+)\s*min/i);
      if (minMatch) return parseInt(minMatch[1], 10);
      const hourMatch = text.match(/(\d+)\s*hours?/i);
      if (hourMatch) return parseInt(hourMatch[1], 10) * 60;
      return null;
    };

    // Update the existing config query to include theme customization fields
    const configWithTheme = await api.config.findFirst({
      filter: { shopId: { equals: shopId } },
      select: { 
        id: true, 
        timeSlotInterval: true,
        themeExtensionUsed: true
      }
    });

    // Get timeSlotInterval with fallback to default of 15 minutes
    const timeSlotInterval = configWithTheme?.timeSlotInterval || 15;

    // Build response
    const responseData = {
      services: services.map(service => ({
        id: service.id,
        title: service.title,
        description: service.body,
        handle: service.handle,
        productType: service.productType,
        vendor: service.vendor,
        variants: service.variants?.edges?.map(edge => {
          const parsedDuration =
            parseDuration(edge.node.option1 || '') || parseDuration(edge.node.title || '');

          // Fallback: if variant has no parseable duration, default to configured timeSlotInterval
          const effectiveDuration = parsedDuration != null ? parsedDuration : timeSlotInterval;

          return {
            id: edge.node.id,
            title: edge.node.title,
            price: edge.node.price,
            compareAtPrice: edge.node.compareAtPrice,
            shopifyVariantId: edge.node.id,
            duration: effectiveDuration,
            sku: edge.node.sku,
            image: variantImages.get(edge.node.id) || null
          };
        }) || []
      })),
      staff: staff.map(staffMember => ({
        id: staffMember.id,
        name: staffMember.name,
        email: staffMember.email,
        phone: staffMember.phone,
        bio: staffMember.bio,
        avatar: staffMember.avatar ? {
          url: staffMember.avatar.url,
          fileName: staffMember.avatar.fileName
        } : null
      })),
      locations: locations.map(location => ({
        id: location.id,
        name: location.name,
        address1: location.address1,
        address2: location.address2,
        city: location.city,
        province: location.province,
        country: location.country,
        zipCode: location.zipCode,
        phone: location.phone,
        offersServices: location.offersServices
      })),
      staffAvailability: staffAvailability.map(availability => ({
        id: availability.id,
        staffId: availability.staffId,
        locationId: availability.locationId,
        dayOfWeek: availability.dayOfWeek,
        startTime: availability.startTime,
        endTime: availability.endTime,
        isAvailable: availability.isAvailable
      })),
      staffDateAvailability: staffDateAvailability.map(dateAvailability => ({
        id: dateAvailability.id,
        staffId: dateAvailability.staffId,
        locationId: dateAvailability.locationId,
        date: dateAvailability.date,
        startTime: dateAvailability.startTime,
        endTime: dateAvailability.endTime,
        isAvailable: dateAvailability.isAvailable
      })),
      existingBookings: existingBookings.map(booking => ({
        id: booking.id,
        scheduledAt: booking.scheduledAt,
        duration: booking.duration,
        status: booking.status,
        staffId: booking.staffId,
        locationId: booking.locationId,
        variantId: booking.variantId,
        totalPrice: booking.totalPrice,
        customerName: booking.customerName,
        customerEmail: booking.customerEmail,
        notes: booking.notes,
        arrived: booking.arrived
      })),
      timeSlotInterval: timeSlotInterval
    };

    logger.info(`Successfully fetched booking data for shop ${shopId}: ${services.length} services, ${staff.length} staff, ${locations.length} locations, timeSlotInterval: ${timeSlotInterval}min`);

    // Track theme extension usage
    try {
      if (configWithTheme && !configWithTheme.themeExtensionUsed) {
        await api.config.update(configWithTheme.id, {
          themeExtensionUsed: true
        });
        logger.info(`Theme extension usage tracked for shop ${shopId}`);
      }
    } catch (error) {
      logger.error("Failed to track theme extension usage:", error);
      // Don't fail the request if tracking fails
    }

    await reply.code(200).send({ success: true, data: responseData });

  } catch (error) {
    logger.error("Error fetching booking data:", error);
    await reply.code(500).send({ error: "Internal server error", message: "Failed to fetch booking data" });
  }
};

// Handle preflight OPTIONS requests for CORS
route.options = {
  preHandler: async (request, reply) => {
    if (request.method === 'OPTIONS') {
      reply.header('Access-Control-Allow-Origin', '*');
      reply.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
      reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      await reply.code(204).send();
      return;
    }
  }
};

export default route;
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
          images: true,
          variants: {
            edges: {
              node: {
                id: true,
                title: true,
                price: true,
                compareAtPrice: true,
                option1: true,
                sku: true,
                image: true,
                images: true
              }
            }
          }
        }
    });

    logger.info(`Found ${services.length} services`);
    
    // Debug: Log variant IDs
    services.forEach(service => {
      if (service.variants && service.variants.edges && service.variants.edges.length > 0) {
        logger.info(`Service ${service.title} variants:`, service.variants.edges.map(edge => ({ 
          id: edge.node.id, 
          shopifyVariantId: edge.node.id,
          title: edge.node.title,
          price: edge.node.price
        })));
      }
    });

    // Debug: Check if variants exist in Shopify and their status
    if (services.length > 0 && services[0].variants && services[0].variants.edges && services[0].variants.edges.length > 0) {
      const firstVariant = services[0].variants.edges[0].node;
      logger.info(`Checking variant ${firstVariant.id} in Shopify...`);
      
      try {
        const shopify = await connections.shopify.forShopId(shopId);
        if (shopify) {
          const variantResponse = await shopify.rest.get({
            path: `variants/${firstVariant.id}`,
          });
          const variant = variantResponse.body.variant;
          logger.info(`Variant details:`, {
            id: variant.id,
            title: variant.title,
            price: variant.price,
            available: variant.available,
            inventory_quantity: variant.inventory_quantity,
            product_id: variant.product_id,
            sku: variant.sku
          });
          
          // Check the product status
          if (variant.product_id) {
            const productResponse = await shopify.rest.get({
              path: `products/${variant.product_id}`,
            });
            const product = productResponse.body.product;
            logger.info(`Product details:`, {
              id: product.id,
              title: product.title,
              status: product.status,
              published_at: product.published_at,
              product_type: product.product_type
            });
          }
        }
      } catch (error) {
        logger.error(`Variant ${firstVariant.id} error:`, error);
      }
    }

    // Use existing variant images from the database
    const variantImages = new Map();
    
    for (const service of services) {
      if (service.variants?.edges) {
        // Use existing variant images that were populated by the action
        service.variants.edges.forEach(edge => {
          // Use images array if available, otherwise fallback to single image
          if (edge.node.images && Array.isArray(edge.node.images) && edge.node.images.length > 0) {
            // Use the first image from the images array
            const firstImage = edge.node.images[0];
            if (firstImage && typeof firstImage === 'object' && firstImage !== null && 'url' in firstImage) {
              variantImages.set(edge.node.id, firstImage);
              logger.info(`Using existing images array for variant ${edge.node.id}: ${firstImage.url}`);
            }
          } else if (edge.node.image && typeof edge.node.image === 'object' && edge.node.image !== null && 'url' in edge.node.image) {
            variantImages.set(edge.node.id, edge.node.image);
            logger.info(`Using existing single image for variant ${edge.node.id}: ${edge.node.image.url}`);
          }
        });
      }
    }

    // Fetch other data
    const [staff, locations, staffAvailability, staffDateAvailability, bookingsNext90Days, locationHoursRules, locationHoursExceptions] = await Promise.all([
      api.staff.findMany({
        filter: { 
          shopId: { equals: shopId }, 
          isActive: { equals: true } // Only include explicitly active staff
        },
        select: {
          id: true, name: true, email: true, phone: true, title: true,
          isActive: true,
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
          province: true, country: true, zipCode: true, phone: true, offersServices: true,
          operatingHours: true, timeZone: true
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
      // Fetch bookings for next 90 days
      (async () => {
        const now = new Date();
        const ninetyDaysFromNow = new Date(now);
        ninetyDaysFromNow.setDate(ninetyDaysFromNow.getDate() + 90);
        return api.booking.findMany({
          filter: { 
            shopId: { equals: shopId },
            scheduledAt: { 
              greaterThanOrEqual: now.toISOString(),
              lessThanOrEqual: ninetyDaysFromNow.toISOString()
            },
            status: { in: ["pending", "paid", "not_paid", "completed"] }
          },
          select: {
            id: true, scheduledAt: true, duration: true, status: true,
            staffId: true, locationId: true, shopId: true, variantId: true, totalPrice: true,
            customerName: true, customerEmail: true, notes: true, arrived: true
          },
          sort: { scheduledAt: "Ascending" }
        });
      })(),
      api.locationHoursRule.findMany({
        filter: { shopId: { equals: shopId } },
        select: {
          id: true, locationId: true, weekday: true, openTime: true, closeTime: true,
          validFrom: true, validTo: true
        }
      }),
      api.locationHoursException.findMany({
        filter: { shopId: { equals: shopId } },
        select: {
          id: true, locationId: true, startDate: true, endDate: true,
          openTime: true, closeTime: true, closedAllDay: true, reason: true
        }
      })
    ]);

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
        image: service.images && Array.isArray(service.images) && service.images.length > 0 && service.images[0].src ? 
          { url: service.images[0].src, alt: service.images[0].alt || service.title } : null,
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
            // Keep variant ID as string to prevent precision loss with large Shopify IDs
            // and ensure compatibility with Shopify's cart API
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
        title: staffMember.title,
        isActive: staffMember.isActive,
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
        offersServices: location.offersServices,
        operatingHours: location.operatingHours,
        timeZone: location.timeZone
      })),
      locationHoursRules: locationHoursRules.map(rule => ({
        id: rule.id,
        locationId: rule.locationId,
        weekday: rule.weekday,
        openTime: rule.openTime,
        closeTime: rule.closeTime,
        validFrom: rule.validFrom,
        validTo: rule.validTo
      })),
      locationHoursExceptions: locationHoursExceptions.map(exception => ({
        id: exception.id,
        locationId: exception.locationId,
        startDate: exception.startDate,
        endDate: exception.endDate,
        openTime: exception.openTime,
        closeTime: exception.closeTime,
        closedAllDay: exception.closedAllDay,
        reason: exception.reason
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
      existingBookings: bookingsNext90Days.map(booking => ({
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
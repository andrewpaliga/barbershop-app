import { RouteHandler } from "gadget-server";

const route: RouteHandler = async ({ request, reply, api, logger, connections }) => {
  try {
    let shopId: string | null = null;
    
    // First try to get shop context from Shopify session (authenticated admin requests)
    const rawShopId = connections.shopify.currentShopId;
    
    if (rawShopId) {
      shopId = String(rawShopId);
      logger.info(`Found shop ID from session context: ${shopId}`);
    } else {
      // Fallback for app proxy requests - get shop domain from query parameters
      const shopDomain = request.query?.shop as string;
      logger.info(`No session context found, checking query params. Shop domain: ${shopDomain}`);
      
      if (!shopDomain) {
        logger.error("No shop context found in session or query parameters");
        await reply.code(400).send({ 
          error: "Shop context not found. Please ensure the request includes shop information." 
        });
        return;
      }
      
      try {
        // Look up the shop record by domain to get the shop ID
        const shopRecord = await api.shopifyShop.findFirst({
          filter: {
            OR: [
              { myshopifyDomain: { equals: shopDomain } },
              { domain: { equals: shopDomain } }
            ]
          },
          select: {
            id: true,
            name: true,
            myshopifyDomain: true,
            domain: true
          }
        });
        
        if (!shopRecord) {
          logger.error(`Shop not found for domain: ${shopDomain}`);
          await reply.code(404).send({
            error: "Shop not found",
            message: `No shop found for domain: ${shopDomain}`
          });
          return;
        }
        
        shopId = shopRecord.id;
        logger.info(`Found shop ID from domain lookup: ${shopId} (${shopRecord.name})`);
        
      } catch (domainLookupError) {
        logger.error(`Error looking up shop by domain ${shopDomain}:`, domainLookupError);
        await reply.code(500).send({
          error: "Shop lookup failed",
          message: "Unable to find shop information"
        });
        return;
      }
    }
    
    if (!shopId) {
      logger.error("Unable to determine shop ID");
      await reply.code(400).send({ 
        error: "Unable to determine shop context" 
      });
      return;
    }

    // Set CORS headers to allow cross-origin requests from storefront
    reply.header('Access-Control-Allow-Origin', '*');
    reply.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
    reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Fetch services (shopifyProduct records where isBarberService is true)
    const services = await api.shopifyProduct.findMany({
      filter: {
        shopId: { equals: shopId },
        isBarberService: { equals: true },
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
              sku: true
            }
          }
        }
      }
    });

    // Fetch active staff members
    const staff = await api.staff.findMany({
      filter: {
        shopId: { equals: shopId },
        isActive: { equals: true }
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        bio: true,
        avatar: {
          url: true,
          fileName: true
        }
      }
    });

    // Fetch active locations
    const locations = await api.shopifyLocation.findMany({
      filter: {
        shopId: { equals: shopId },
        active: { equals: true }
      },
      select: {
        id: true,
        name: true,
        address1: true,
        address2: true,
        city: true,
        province: true,
        country: true,
        zipCode: true,
        phone: true
      }
    });

    // Fetch staff availability (recurring weekly availability)
    const staffAvailability = await api.staffAvailability.findMany({
      filter: {
        shopId: { equals: shopId },
        isAvailable: { equals: true }
      },
      select: {
        id: true,
        staffId: true,
        locationId: true,
        dayOfWeek: true,
        startTime: true,
        endTime: true,
        isAvailable: true
      }
    });

    // Fetch staff date availability (specific date overrides)
    const staffDateAvailability = await api.staffDateAvailability.findMany({
      filter: {
        shopId: { equals: shopId }
      },
      select: {
        id: true,
        staffId: true,
        locationId: true,
        date: true,
        startTime: true,
        endTime: true,
        isAvailable: true
      }
    });

    // Helper function to parse duration from text
    const parseDuration = (text: string): number | null => {
      if (!text) return null;
      
      // Look for patterns like "30 min", "60 min", "1 hour", "2 hours"
      const minMatch = text.match(/(\d+)\s*min/i);
      if (minMatch) {
        return parseInt(minMatch[1], 10);
      }
      
      const hourMatch = text.match(/(\d+)\s*hours?/i);
      if (hourMatch) {
        return parseInt(hourMatch[1], 10) * 60;
      }
      
      return null;
    };

    // Transform the data into a simple JSON format
    const responseData = {
      services: services.map(service => ({
        id: service.id,
        title: service.title,
        description: service.body,
        handle: service.handle,
        productType: service.productType,
        vendor: service.vendor,
        variants: service.variants?.edges?.map(edge => {
          const duration = parseDuration(edge.node.option1 || '') || parseDuration(edge.node.title || '');
          
          return {
            id: edge.node.id,
            title: edge.node.title,
            price: edge.node.price,
            compareAtPrice: edge.node.compareAtPrice,
            shopifyVariantId: edge.node.id,
            duration: duration,
            sku: edge.node.sku
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
        phone: location.phone
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
      }))
    };

    logger.info(`Successfully fetched booking data for shop ${shopId}: ${services.length} services, ${staff.length} staff, ${locations.length} locations, ${staffAvailability.length} staff availability records, ${staffDateAvailability.length} staff date availability records`);

    await reply.code(200).send({ success: true, data: responseData });

  } catch (error) {
    logger.error("Error fetching booking data:", error);
    
    await reply.code(500).send({
      error: "Internal server error",
      message: "Failed to fetch booking data"
    });
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
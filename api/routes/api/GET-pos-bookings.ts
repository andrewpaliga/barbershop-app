import { RouteHandler } from "gadget-server";

const route: RouteHandler = async ({ request, reply, api, logger, connections }) => {
  // Handle CORS preflight requests
  if (request.method === "OPTIONS") {
    await reply
      .code(200)
      .header("Access-Control-Allow-Origin", "*")
      .header("Access-Control-Allow-Methods", "GET, OPTIONS")
      .header("Access-Control-Allow-Headers", "Content-Type, Authorization")
      .send();
    return;
  }

  // Add CORS headers to all responses
  reply.header("Access-Control-Allow-Origin", "*");
  reply.header("Access-Control-Allow-Methods", "GET, OPTIONS");
  reply.header("Access-Control-Allow-Headers", "Content-Type, Authorization");

  try {
    const startTime = Date.now();
    logger.info("/api/pos-bookings: Starting POS bookings data fetch");
    
    let shopId: string | null = null;

    // First, try to get shop ID from the current authenticated shop
    shopId = connections.shopify.currentShopId?.toString() || null;
    logger.info({ shopId }, "Attempted to get shop ID from current authenticated shop");

    // Get location ID from query parameters
    const locationId = (request.query as any)?.locationId as string;
    logger.info({ locationId }, "/api/pos-bookings: Location ID from query params");

    // Resolve location name if we have a location ID
    let locationName = "Unknown Location";
    if (locationId && shopId) {
      try {
        const shopifyClient = await connections.shopify.forShopId(shopId);
        if (shopifyClient) {
          const locationQuery = `
            query getLocation($id: ID!) {
              location(id: $id) {
                id
                name
              }
            }
          `;
          
          const locationResult = await shopifyClient.graphql(locationQuery, {
            id: `gid://shopify/Location/${locationId}`
          });
          
          if (locationResult?.location) {
            locationName = locationResult.location.name || `Location ${locationId}`;
            logger.info({ locationName, locationId }, "/api/pos-bookings: Resolved location name");
          }
        }
      } catch (error) {
        logger.warn({ error: error?.message, locationId }, "/api/pos-bookings: Failed to resolve location name");
      }
    }

    // If no shop ID found, try to get it from query parameters
    if (!shopId) {
      const shopDomain = (request.query as any)?.shop as string;
      logger.info({ shopDomain }, "/api/pos-bookings: No authenticated shop found, trying to get shop from query params");
      
      if (shopDomain) {
        try {
          // Look up shop by domain
          const shop = await api.shopifyShop.findFirst({
            filter: {
              myshopifyDomain: { equals: shopDomain }
            },
            select: {
              id: true,
              myshopifyDomain: true
            }
          });
          
          if (shop) {
            shopId = shop.id;
            logger.info({ shopId, shopDomain }, "/api/pos-bookings: Successfully found shop by domain");
          } else {
            logger.warn({ shopDomain }, "/api/pos-bookings: No shop found with the provided domain");
          }
        } catch (error) {
          logger.error({ error, shopDomain }, "/api/pos-bookings: Error looking up shop by domain");
        }
      }
    }
    
    if (!shopId) {
      logger.warn("/api/pos-bookings: No shop ID available - authentication failed");
      await reply.code(401).send({ error: "Shop not authenticated" });
      return;
    }

    logger.info({ shopId }, "/api/pos-bookings: Successfully authenticated shop, fetching booking data");

    const now = new Date();

    // Fetch 5 most recent completed bookings (past)
    logger.info("/api/pos-bookings: Fetching recent completed bookings");
    const recentBookingsData = await api.booking.findMany({
      filter: {
        shopId: { equals: shopId },
        scheduledAt: { lessThan: now.toISOString() },
        status: { notEquals: "cancelled" },
        staff: { isSet: true },
        order: {
          financialStatus: { notEquals: "voided" }
        },
        ...(locationId && {
          location: {
            legacyResourceId: { equals: locationId }
          }
        })
      },
      sort: { scheduledAt: "Descending" },
      first: 5,
      select: {
        id: true,
        scheduledAt: true,
        totalPrice: true,
        status: true,
        arrived: true,
        variantId: true,
        staffId: true,
        customer: {
          id: true,
          firstName: true,
          lastName: true,
          email: true
        },
        variant: {
          id: true,
          title: true,
          product: {
            title: true
          }
        },
        location: {
          id: true,
          name: true,
          legacyResourceId: true
        },
        order: {
          id: true,
          name: true,
          financialStatus: true,
          lineItems: {
            edges: {
              node: {
                id: true,
                title: true,
                price: true,
                quantity: true,
                variant: {
                  id: true
                }
              }
            }
          }
        },
        customerName: true,
        customerEmail: true
      }
    });
    logger.info({ count: recentBookingsData.length }, "/api/pos-bookings: Fetched recent bookings");

    // Fetch 5 most upcoming bookings (future with pending or paid status)
    logger.info("/api/pos-bookings: Fetching upcoming bookings");
    const upcomingBookingsData = await api.booking.findMany({
      filter: {
        shopId: { equals: shopId },
        scheduledAt: { greaterThanOrEqual: now.toISOString() },
        status: { notEquals: "cancelled" },
        staff: { isSet: true },
        order: {
          financialStatus: { notEquals: "voided" }
        },
        ...(locationId && {
          location: {
            legacyResourceId: { equals: locationId }
          }
        })
      },
      sort: { scheduledAt: "Ascending" },
      first: 5,
      select: {
        id: true,
        scheduledAt: true,
        totalPrice: true,
        status: true,
        arrived: true,
        variantId: true,
        staffId: true,
        customer: {
          id: true,
          firstName: true,
          lastName: true,
          email: true
        },
        variant: {
          id: true,
          title: true,
          product: {
            title: true
          }
        },
        location: {
          id: true,
          name: true,
          legacyResourceId: true
        },
        order: {
          id: true,
          name: true,
          financialStatus: true,
          lineItems: {
            edges: {
              node: {
                id: true,
                title: true,
                price: true,
                quantity: true,
                variant: {
                  id: true
                }
              }
            }
          }
        },
        customerName: true,
        customerEmail: true
      }
    });
    logger.info({ count: upcomingBookingsData.length }, "/api/pos-bookings: Fetched upcoming bookings");

    // Load staff data separately to avoid GraphQL non-nullable errors
    const allBookingsData = [...recentBookingsData, ...upcomingBookingsData];
    
    // Collect all unique staff IDs
    const staffIds = [...new Set(allBookingsData.map(b => b.staffId).filter(Boolean))];
    
    logger.info({ 
      totalBookings: allBookingsData.length,
      uniqueStaffIds: staffIds.length
    }, "Staff loading analysis");

    if (staffIds.length > 0) {
      logger.info({ count: staffIds.length }, "Batch loading staff data");
      
      try {
        // Load all staff in a single query
        const staffMembers = await api.staff.findMany({
          filter: {
            id: { in: staffIds },
            shopId: { equals: shopId }
          },
          select: {
            id: true,
            name: true
          }
        });
        
        // Create a lookup map for fast staff assignment
        const staffLookup = new Map(staffMembers.map(staff => [staff.id, staff]));
        
        // Assign staff data to bookings
        let successCount = 0;
        for (const booking of allBookingsData) {
          if (booking.staffId) {
            const staffMember = staffLookup.get(booking.staffId);
            if (staffMember) {
              (booking as any).staff = staffMember;
              successCount++;
            } else {
              logger.warn({ bookingId: booking.id, staffId: booking.staffId }, "Staff member not found for booking");
            }
          }
        }
        
        logger.info({ 
          requestedStaffIds: staffIds.length,
          foundStaff: staffMembers.length, 
          assignedToBookings: successCount 
        }, "Batch staff loading completed");
        
      } catch (error) {
        logger.error({ error: (error as any)?.message, staffIds }, "Failed to batch load staff data");
      }
    }

    // Transform the data to match the expected structure
    const recentBookings = recentBookingsData.map(booking => ({
      id: booking.id,
      customerId: booking.customer?.id,
      customerName: `${booking.customer?.firstName || ''} ${booking.customer?.lastName || ''}`.trim() ||
                   booking.customer?.email ||
                   booking.customerName || 
                   booking.customerEmail ||
                   'Unknown Customer',
      scheduledAt: booking.scheduledAt,
      serviceName: booking.variant?.product?.title || booking.variant?.title || 'Unknown Service',
      price: booking.totalPrice,
      staffName: booking.staff?.name || 'Unknown Staff',
      locationName: booking.location?.name || 'Unknown Location',
      locationId: booking.location?.legacyResourceId,
      status: booking.status,
      arrived: booking.arrived,
      source: booking.order ? 'web' : 'manual',
      orderFinancialStatus: booking.order?.financialStatus,
      orderId: booking.order?.id,
      orderName: booking.order?.name,
      variantId: booking.variantId,
      lineItems: booking.order?.lineItems?.edges?.map(edge => ({
        id: edge.node.id,
        title: edge.node.title,
        price: edge.node.price,
        quantity: edge.node.quantity,
        variantId: edge.node.variant?.id
      })) || []
    }));

    const upcomingBookings = upcomingBookingsData.map(booking => ({
      id: booking.id,
      customerId: booking.customer?.id,
      customerName: `${booking.customer?.firstName || ''} ${booking.customer?.lastName || ''}`.trim() ||
                   booking.customer?.email ||
                   booking.customerName || 
                   booking.customerEmail ||
                   'Unknown Customer',
      scheduledAt: booking.scheduledAt,
      serviceName: booking.variant?.product?.title || booking.variant?.title || 'Unknown Service',
      price: booking.totalPrice,
      staffName: booking.staff?.name || 'Unknown Staff',
      locationName: booking.location?.name || 'Unknown Location',
      locationId: booking.location?.legacyResourceId,
      status: booking.status,
      arrived: booking.arrived,
      source: booking.order ? 'web' : 'manual',
      orderFinancialStatus: booking.order?.financialStatus,
      orderId: booking.order?.id,
      orderName: booking.order?.name,
      variantId: booking.variantId,
      lineItems: booking.order?.lineItems?.edges?.map(edge => ({
        id: edge.node.id,
        title: edge.node.title,
        price: edge.node.price,
        quantity: edge.node.quantity,
        variantId: edge.node.variant?.id
      })) || []
    }));

    const endTime = Date.now();
    const processingTime = endTime - startTime;
    
    logger.info({ 
      recentCount: recentBookings.length, 
      upcomingCount: upcomingBookings.length,
      processingTimeMs: processingTime
    }, "/api/pos-bookings: Successfully processed booking data");

    // Track POS extension usage
    try {
      const currentConfig = await api.config.findFirst({
        filter: { shopId: { equals: shopId } },
        select: { id: true, posExtensionUsed: true }
      });

      if (currentConfig && !currentConfig.posExtensionUsed) {
        await api.config.update(currentConfig.id, {
          posExtensionUsed: true
        });
        logger.info(`POS extension usage tracked for shop ${shopId}`);
      }
    } catch (error) {
      logger.error("Failed to track POS extension usage:", error as any);
      // Don't fail the request if tracking fails
    }

    await reply.send({
      recentBookings,
      upcomingBookings,
      locationName: locationName
    });

  } catch (error) {
    logger.error({ error }, "/api/pos-bookings: Error fetching POS bookings data");
    await reply.code(500).send({ error: "Internal server error" });
  }
};

export default route;
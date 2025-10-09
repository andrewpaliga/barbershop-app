import { applyParams, save, ActionOptions } from "gadget-server";
import { preventCrossShopDataAccess } from "gadget-server/shopify";

export const run: ActionRun = async ({ params, record, logger, api, connections }) => {
  applyParams(params, record);
  await preventCrossShopDataAccess(params, record);
  await save(record);
};

export const onSuccess: ActionOnSuccess = async ({ params, record, logger, api, connections }) => {
  try {
    switch(record.topic) {
      case "customers/data_request":
        await handleCustomerDataRequest(record, logger, api);
        break;
      case "customers/redact":
        await handleCustomerRedaction(record, logger, api);
        break;
      case "shop/redact":
        await handleShopRedaction(record, logger, api);
        break;
      default:
        logger.warn(`Unknown GDPR topic: ${record.topic}`);
    }
  } catch (error) {
    logger.error(`Error processing GDPR request for topic ${record.topic}:`, error);
    throw error;
  }
};

async function handleCustomerDataRequest(record: any, logger: any, api: any) {
  logger.info(`Processing customer data request for GDPR request ID: ${record.id}`);
  
  const payload = record.payload;
  if (!payload?.customer?.id) {
    logger.error("No customer ID found in GDPR data request payload");
    return;
  }

  const customerId = payload.customer.id.toString();
  logger.info(`Extracting data for customer ID: ${customerId}`);

  try {
    // Find all bookings for this customer
    const bookings = await api.booking.findMany({
      filter: {
        OR: [
          { customerId: { equals: customerId } },
          { customerEmail: { equals: payload.customer.email } }
        ]
      },
      select: {
        id: true,
        scheduledAt: true,
        customerName: true,
        customerEmail: true,
        notes: true,
        status: true,
        totalPrice: true,
        duration: true,
        createdAt: true,
        updatedAt: true,
        staff: { id: true, name: true },
        location: { id: true, name: true }
      }
    });

    logger.info(`CUSTOMER DATA EXPORT REQUIRED - Manual Action Needed:
    
Customer ID: ${customerId}
Customer Email: ${payload.customer.email || 'N/A'}
Shop ID: ${record.shopId}
Request Date: ${new Date().toISOString()}

BOOKING DATA FOUND (${bookings.length} records):
${bookings.map(booking => `
- Booking ID: ${booking.id}
- Scheduled: ${booking.scheduledAt}
- Name: ${booking.customerName || 'N/A'}
- Email: ${booking.customerEmail || 'N/A'}
- Status: ${booking.status}
- Total Price: ${booking.totalPrice}
- Duration: ${booking.duration} minutes
- Notes: ${booking.notes || 'None'}
- Staff: ${booking.staff?.name || 'N/A'}
- Location: ${booking.location?.name || 'N/A'}
- Created: ${booking.createdAt}
- Updated: ${booking.updatedAt}
`).join('')}

ACTION REQUIRED: Store owner must be provided with this customer data manually.
See https://shopify.dev/apps/webhooks/configuration/mandatory-webhooks#customers-data_request
    `);

  } catch (error) {
    logger.error(`Error extracting customer data for ID ${customerId}:`, error);
    throw error;
  }
}

async function handleCustomerRedaction(record: any, logger: any, api: any) {
  logger.info(`Processing customer redaction for GDPR request ID: ${record.id}`);
  
  const payload = record.payload;
  if (!payload?.customer?.id) {
    logger.error("No customer ID found in GDPR redaction payload");
    return;
  }

  const customerId = payload.customer.id.toString();
  const customerEmail = payload.customer.email;
  logger.info(`Redacting data for customer ID: ${customerId}, email: ${customerEmail}`);

  try {
    // Find and redact/delete customer bookings
    const bookingsToRedact = await api.booking.findMany({
      filter: {
        OR: [
          { customerId: { equals: customerId } },
          { customerEmail: { equals: customerEmail } }
        ]
      }
    });

    logger.info(`Found ${bookingsToRedact.length} bookings to redact for customer ${customerId}`);

    // Delete all bookings for this customer
    if (bookingsToRedact.length > 0) {
      const bookingIds = bookingsToRedact.map(booking => booking.id);
      await api.booking.bulkDelete(bookingIds);
      logger.info(`Successfully deleted ${bookingIds.length} bookings for customer ${customerId}`);
    }

    logger.info(`Customer redaction completed for ID: ${customerId}. All booking records have been permanently deleted.`);

  } catch (error) {
    logger.error(`Error during customer redaction for ID ${customerId}:`, error);
    throw error;
  }
}

async function handleShopRedaction(record: any, logger: any, api: any) {
  logger.info(`Processing shop redaction for GDPR request ID: ${record.id}`);
  
  const shopId = record.shopId;
  if (!shopId) {
    logger.error("No shop ID found for shop redaction");
    return;
  }

  logger.info(`Redacting all data for shop ID: ${shopId}`);
  let totalDeletedRecords = 0;

  try {
    // Delete all bookings for this shop
    const bookings = await api.booking.findMany({
      filter: { shopId: { equals: shopId } }
    });
    if (bookings.length > 0) {
      await api.booking.bulkDelete(bookings.map(b => b.id));
      totalDeletedRecords += bookings.length;
      logger.info(`Deleted ${bookings.length} booking records`);
    }

    // Delete all staff for this shop
    const staff = await api.staff.findMany({
      filter: { shopId: { equals: shopId } }
    });
    if (staff.length > 0) {
      await api.staff.bulkDelete(staff.map(s => s.id));
      totalDeletedRecords += staff.length;
      logger.info(`Deleted ${staff.length} staff records`);
    }

    // Delete all staff availability for this shop
    const staffAvailabilities = await api.staffAvailability.findMany({
      filter: { shopId: { equals: shopId } }
    });
    if (staffAvailabilities.length > 0) {
      await api.staffAvailability.bulkDelete(staffAvailabilities.map(sa => sa.id));
      totalDeletedRecords += staffAvailabilities.length;
      logger.info(`Deleted ${staffAvailabilities.length} staff availability records`);
    }

    // Delete all staff date availability for this shop
    const staffDateAvailabilities = await api.staffDateAvailability.findMany({
      filter: { shopId: { equals: shopId } }
    });
    if (staffDateAvailabilities.length > 0) {
      await api.staffDateAvailability.bulkDelete(staffDateAvailabilities.map(sda => sda.id));
      totalDeletedRecords += staffDateAvailabilities.length;
      logger.info(`Deleted ${staffDateAvailabilities.length} staff date availability records`);
    }

    // Delete all location hours for this shop
    const locationHours = await api.locationHours.findMany({
      filter: { shopId: { equals: shopId } }
    });
    if (locationHours.length > 0) {
      await api.locationHours.bulkDelete(locationHours.map(lh => lh.id));
      totalDeletedRecords += locationHours.length;
      logger.info(`Deleted ${locationHours.length} location hours records`);
    }

    // Delete all staff products for this shop
    const staffProducts = await api.staffProduct.findMany({
      filter: { shopId: { equals: shopId } }
    });
    if (staffProducts.length > 0) {
      await api.staffProduct.bulkDelete(staffProducts.map(sp => sp.id));
      totalDeletedRecords += staffProducts.length;
      logger.info(`Deleted ${staffProducts.length} staff product records`);
    }

    // Delete all config for this shop
    const configs = await api.config.findMany({
      filter: { shopId: { equals: shopId } }
    });
    if (configs.length > 0) {
      await api.config.bulkDelete(configs.map(c => c.id));
      totalDeletedRecords += configs.length;
      logger.info(`Deleted ${configs.length} config records`);
    }

    logger.info(`Shop redaction completed for shop ID: ${shopId}. Total records deleted: ${totalDeletedRecords}.
    
SHOP DATA CLEANUP SUMMARY:
- Bookings: ${bookings.length} deleted
- Staff: ${staff.length} deleted  
- Staff Availability: ${staffAvailabilities.length} deleted
- Staff Date Availability: ${staffDateAvailabilities.length} deleted
- Location Hours: ${locationHours.length} deleted
- Staff Products: ${staffProducts.length} deleted
- Config: ${configs.length} deleted
- Total Records: ${totalDeletedRecords} deleted
    
All shop-related data has been permanently removed from the application.`);

  } catch (error) {
    logger.error(`Error during shop redaction for shop ID ${shopId}:`, error);
    throw error;
  }
}

export const options: ActionOptions = { actionType: "create" };

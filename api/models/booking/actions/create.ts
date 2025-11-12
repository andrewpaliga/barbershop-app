import { applyParams, save, ActionOptions } from "gadget-server";
import { preventCrossShopDataAccess } from "gadget-server/shopify";

export const run: ActionRun = async ({ params, record, logger, api, connections }) => {
  applyParams(params, record);
  
  // Always set status to 'not_paid' for new bookings
  record.status = 'not_paid';
  
  // Populate locationTimeZone from the location if not already set
  if (!record.locationTimeZone && record.locationId) {
    try {
      const location = await api.shopifyLocation.findOne(record.locationId, {
        select: {
          id: true,
          timeZone: true,
        },
      });
      
      if (location?.timeZone) {
        record.locationTimeZone = location.timeZone;
        logger?.info(`Set locationTimeZone from location`, {
          bookingId: record.id,
          locationId: record.locationId,
          timeZone: location.timeZone,
        });
      } else {
        // Default to EST if location doesn't have timezone
        record.locationTimeZone = 'America/New_York';
        logger?.warn(`Location missing timezone, defaulting to America/New_York`, {
          bookingId: record.id,
          locationId: record.locationId,
        });
      }
    } catch (error) {
      // If location lookup fails, default to EST
      record.locationTimeZone = 'America/New_York';
      logger?.warn(`Failed to fetch location timezone, defaulting to America/New_York`, {
        bookingId: record.id,
        locationId: record.locationId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  } else if (!record.locationTimeZone) {
    // No location provided, default to EST
    record.locationTimeZone = 'America/New_York';
    logger?.warn(`No location provided, defaulting timezone to America/New_York`, {
      bookingId: record.id,
    });
  }
  
  await preventCrossShopDataAccess(params, record);
  await save(record);
};

export const options: ActionOptions = {
  actionType: "create",
};

import { ActionOptions } from "gadget-server";

export const run: ActionRun = async ({ params, logger, api, connections }) => {
  logger.info("Starting saveLocationHours action", { locationId: params.locationId });

  // Validate required parameters
  if (!params.locationId) {
    throw new Error("locationId is required");
  }

  // Parse JSON string parameters
  let operatingHours;
  let holidayClosures;

  try {
    operatingHours = params.operatingHours ? JSON.parse(params.operatingHours) : {};
  } catch (error) {
    logger.error("Failed to parse operatingHours JSON", { operatingHours: params.operatingHours });
    throw new Error("Invalid operatingHours JSON format");
  }

  try {
    holidayClosures = params.holidayClosures ? JSON.parse(params.holidayClosures) : [];
  } catch (error) {
    logger.error("Failed to parse holidayClosures JSON", { holidayClosures: params.holidayClosures });
    throw new Error("Invalid holidayClosures JSON format");
  }

  // Get shop ID from Shopify connection
  const shopId = connections.shopify.currentShopId;
  if (!shopId) {
    throw new Error("No shop found in current context");
  }

  logger.info("Processing location hours", { 
    locationId: params.locationId, 
    shopId,
    hasOperatingHours: !!operatingHours,
    hasHolidayClosures: Array.isArray(holidayClosures) && holidayClosures.length > 0
  });

  // Find existing locationHours record for this location and shop
  const existingRecord = await api.locationHours.findFirst({
    filter: {
      AND: [
        { locationId: { equals: params.locationId } },
        { shopId: { equals: shopId } }
      ]
    }
  }).catch(() => null); // Return null if not found instead of throwing

  let savedRecord;

  if (existingRecord) {
    logger.info("Updating existing locationHours record", { recordId: existingRecord.id });
    
    savedRecord = await api.locationHours.update(existingRecord.id, {
      operatingHours,
      holidayClosures
    });
  } else {
    logger.info("Creating new locationHours record");
    
    savedRecord = await api.locationHours.create({
      operatingHours,
      holidayClosures,
      location: { _link: params.locationId },
      shop: { _link: shopId }
    });
  }

  logger.info("Successfully saved location hours", { 
    recordId: savedRecord.id,
    action: existingRecord ? "updated" : "created"
  });

  return {
    success: true,
    locationId: params.locationId,
    shopId,
    operatingHours,
    holidayClosures,
    recordId: savedRecord.id,
    action: existingRecord ? "updated" : "created"
  };
};

export const params = {
  locationId: { type: "string" },
  operatingHours: { type: "string" },
  holidayClosures: { type: "string" }
};

export const options: ActionOptions = {
  returnType: true
};

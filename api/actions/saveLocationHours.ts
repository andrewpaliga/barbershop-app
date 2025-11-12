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

  // Clear existing rules and exceptions for this location
  const existingRules = await api.locationHoursRule.findMany({
    filter: { locationId: { equals: params.locationId } }
  });
  const existingExceptions = await api.locationHoursException.findMany({
    filter: { locationId: { equals: params.locationId } }
  });

  for (const rule of existingRules) {
    await api.locationHoursRule.delete(rule.id);
  }
  for (const exception of existingExceptions) {
    await api.locationHoursException.delete(exception.id);
  }

  logger.info(`Cleared ${existingRules.length} existing rules and ${existingExceptions.length} exceptions`);

  // Create new locationHoursRule records from operatingHours
  const rulesCreated = await saveOperatingHours(
    api,
    shopId,
    params.locationId,
    operatingHours,
    logger
  );

  // Create new locationHoursException records from holidayClosures
  const exceptionsCreated = await saveHolidayClosures(
    api,
    shopId,
    params.locationId,
    holidayClosures,
    logger
  );

  logger.info("Successfully saved location hours", { 
    locationId: params.locationId,
    rulesCreated,
    exceptionsCreated
  });

  const normalizedOperatingHours = operatingHours || {};
  const normalizedHolidayClosures = Array.isArray(holidayClosures) ? holidayClosures : [];

  try {
    const existingLocationHours = await api.locationHours.findFirst({
      filter: { locationId: { equals: params.locationId } },
      select: { id: true }
    });

    if (existingLocationHours) {
      await api.locationHours.update(existingLocationHours.id, {
        operatingHours: normalizedOperatingHours,
        holidayClosures: normalizedHolidayClosures,
        shop: { _link: shopId },
      });
    } else {
      await api.locationHours.create({
        location: { _link: params.locationId },
        shop: { _link: shopId },
        operatingHours: normalizedOperatingHours,
        holidayClosures: normalizedHolidayClosures,
      });
    }

    await api.shopifyLocation.update(params.locationId, {
      operatingHours: normalizedOperatingHours,
      holidayClosures: normalizedHolidayClosures,
      shop: { _link: shopId },
    });

    logger.info("Synchronized legacy operating hours records", {
      locationId: params.locationId,
    });
  } catch (syncError) {
    logger.warn("Failed to synchronize legacy operating hours records", {
      locationId: params.locationId,
      error: syncError instanceof Error ? syncError.message : String(syncError),
    });
  }
 
  return {
    success: true,
    locationId: params.locationId,
    shopId,
    rulesCreated,
    exceptionsCreated
  };
};

/**
 * Saves operating hours as locationHoursRule records
 */
async function saveOperatingHours(
  api: any,
  shopId: string,
  locationId: string,
  operatingHours: any,
  logger: any
): Promise<number> {
  let rulesCreated = 0;

  const dayToWeekday: Record<string, number> = {
    monday: 0,
    tuesday: 1,
    wednesday: 2,
    thursday: 3,
    friday: 4,
    saturday: 5,
    sunday: 6,
  };

  const normalizeDayConfig = (): Record<string, any> => {
    if (!operatingHours) {
      return {};
    }

    if (operatingHours.mode === "individual_days" && operatingHours.days) {
      return operatingHours.days;
    }

    if (operatingHours.mode === "weekdays_weekends") {
      const normalized: Record<string, any> = {};

      const weekdaysConfig = operatingHours.weekdays || {};
      const weekendsConfig = operatingHours.weekends || {};

      ["monday", "tuesday", "wednesday", "thursday", "friday"].forEach((day) => {
        normalized[day] = {
          enabled: weekdaysConfig.enabled,
          from: weekdaysConfig.from,
          to: weekdaysConfig.to,
        };
      });

      ["saturday", "sunday"].forEach((day) => {
        normalized[day] = {
          enabled: weekendsConfig.enabled,
          from: weekendsConfig.from,
          to: weekendsConfig.to,
        };
      });

      return normalized;
    }

    // Fallback: if structure unknown, try days field
    return operatingHours.days || {};
  };

  const dayConfigs = normalizeDayConfig();
  const validFrom = new Date().toISOString();

  for (const [dayName, config] of Object.entries(dayConfigs)) {
    const dayData = config as any;
    const weekday = dayToWeekday[dayName];

    const isEnabled = dayData?.enabled ?? dayData?.isOpen;
    const openTime = dayData?.from ?? dayData?.startTime;
    const closeTime = dayData?.to ?? dayData?.endTime;

    if (weekday === undefined || !isEnabled || !openTime || !closeTime) {
      continue;
    }

    try {
      logger.info("Creating location hours rule", {
        locationId,
        dayName,
        weekday,
        openTime,
        closeTime,
      });
      await api.locationHoursRule.create({
        location: { _link: locationId },
        shop: { _link: shopId },
        weekday,
        openTime,
        closeTime,
        validFrom,
      });
      rulesCreated++;
    } catch (error) {
      logger.error("Failed to create rule", {
        locationId,
        dayName,
        weekday,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return rulesCreated;
}

/**
 * Saves holiday closures as locationHoursException records
 */
async function saveHolidayClosures(
  api: any,
  shopId: string,
  locationId: string,
  holidayClosures: any[],
  logger: any
): Promise<number> {
  if (!Array.isArray(holidayClosures) || holidayClosures.length === 0) {
    return 0;
  }

  let exceptionsCreated = 0;

  for (const closure of holidayClosures) {
    try {
      let startDate: string;
      let endDate: string;
      let reason: string;

      if (typeof closure === "string") {
        // Old format: just a holiday name string
        reason = closure;
        // For string-based closures, we'll skip (don't have actual dates)
        continue;
      } else {
        // Custom closure with date
        startDate = closure.date || closure.startDate;
        endDate = closure.endDate || closure.date || startDate; // Single day closure if only date provided
        reason = closure.name || closure.reason || "Holiday closure";
      }

      if (!startDate) {
        continue;
      }

      const validFrom = new Date().toISOString();
      const exceptionData: any = {
        location: { _link: locationId },
        shop: { _link: shopId },
        startDate,
        endDate: endDate || startDate,
        closedAllDay: true,
        reason,
        validFrom,
      };

      await api.locationHoursException.create(exceptionData);
      exceptionsCreated++;
    } catch (error) {
      logger.error(`Failed to create exception: ${error}`);
    }
  }

  return exceptionsCreated;
}

export const params = {
  locationId: { type: "string" },
  operatingHours: { type: "string" },
  holidayClosures: { type: "string" }
};

export const options: ActionOptions = {
  returnType: true
};

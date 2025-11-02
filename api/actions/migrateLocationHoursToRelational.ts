import { ActionOptions } from "gadget-server";

/**
 * This action migrates location hours from JSON storage to relational storage.
 * It converts the old operatingHours JSON structure to locationHoursRule records
 * and the old holidayClosures JSON structure to locationHoursException records.
 */
export const run: ActionRun = async ({ params, logger, api, connections }) => {
  const shopId = connections.shopify.currentShopId;
  if (!shopId) {
    throw new Error("No shop found in current context");
  }

  logger.info("Starting migration of location hours to relational structure");

  // Find all existing locationHours records
  const locationHoursRecords = await api.locationHours.findMany({
    filter: { shopId: { equals: shopId } },
    select: {
      id: true,
      locationId: true,
      operatingHours: true,
      holidayClosures: true,
      shopId: true,
    },
  });

  logger.info(`Found ${locationHoursRecords.length} location hours records to migrate`);

  let migratedCount = 0;
  let rulesCreated = 0;
  let exceptionsCreated = 0;
  const results = [];

  for (const locationHours of locationHoursRecords) {
    try {
      const locationId = locationHours.locationId;

      // Parse JSON fields
      let operatingHours;
      let holidayClosures;

      try {
        operatingHours = typeof locationHours.operatingHours === 'string'
          ? JSON.parse(locationHours.operatingHours)
          : locationHours.operatingHours;
      } catch (e) {
        logger.warn(`Failed to parse operatingHours for location ${locationId}`);
        continue;
      }

      try {
        holidayClosures = typeof locationHours.holidayClosures === 'string'
          ? JSON.parse(locationHours.holidayClosures)
          : locationHours.holidayClosures;
      } catch (e) {
        logger.warn(`Failed to parse holidayClosures for location ${locationId}`);
        holidayClosures = [];
      }

      // Convert operatingHours to locationHoursRule records
      const rulesThisLocation = await migrateOperatingHours(
        api,
        shopId,
        locationId,
        operatingHours,
        logger
      );
      rulesCreated += rulesThisLocation;

      // Convert holidayClosures to locationHoursException records
      const exceptionsThisLocation = await migrateHolidayClosures(
        api,
        shopId,
        locationId,
        holidayClosures,
        logger
      );
      exceptionsCreated += exceptionsThisLocation;

      migratedCount++;
      results.push({
        locationId,
        rulesCreated: rulesThisLocation,
        exceptionsCreated: exceptionsThisLocation,
        status: "success",
      });

      logger.info(`Migrated location ${locationId}: ${rulesThisLocation} rules, ${exceptionsThisLocation} exceptions`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to migrate location ${locationHours.locationId}: ${errorMessage}`);
      results.push({
        locationId: locationHours.locationId,
        status: "failed",
        error: errorMessage,
      });
    }
  }

  const summary = {
    totalLocations: locationHoursRecords.length,
    locationsMigrated: migratedCount,
    rulesCreated,
    exceptionsCreated,
    results,
  };

  logger.info(`Migration completed: ${migratedCount} locations migrated, ${rulesCreated} rules, ${exceptionsCreated} exceptions`);
  return summary;
};

/**
 * Migrates operating hours JSON to locationHoursRule records
 */
async function migrateOperatingHours(
  api: any,
  shopId: string,
  locationId: string,
  operatingHours: any,
  logger: any
): Promise<number> {
  let rulesCreated = 0;

  if (!operatingHours) {
    return 0;
  }

  // Handle different operating hours structures
  if (operatingHours.mode === "individual_days" && operatingHours.days) {
    // Map day names to weekday numbers (0=Monday, 6=Sunday)
    const dayToWeekday: Record<string, number> = {
      monday: 0,
      tuesday: 1,
      wednesday: 2,
      thursday: 3,
      friday: 4,
      saturday: 5,
      sunday: 6,
    };

    for (const [dayName, dayHours] of Object.entries(operatingHours.days)) {
      const dayData = dayHours as any;
      const weekday = dayToWeekday[dayName];

      if (weekday !== undefined && dayData.enabled && dayData.from && dayData.to) {
        try {
          await api.locationHoursRule.create({
            location: { _link: locationId },
            shop: { _link: shopId },
            weekday,
            openTime: dayData.from,
            closeTime: dayData.to,
            validFrom: "2000-01-01",
          });
          rulesCreated++;
        } catch (error) {
          logger.error(`Failed to create rule for ${dayName}: ${error}`);
        }
      }
    }
  } else if (operatingHours.mode === "weekdays_weekends") {
    // Handle weekdays_weekends mode
    if (operatingHours.weekdays?.enabled) {
      // For weekdays (Mon-Fri = 0-4)
      for (let weekday = 0; weekday <= 4; weekday++) {
        try {
          await api.locationHoursRule.create({
            location: { _link: locationId },
            shop: { _link: shopId },
            weekday,
            openTime: operatingHours.weekdays.from,
            closeTime: operatingHours.weekdays.to,
            validFrom: "2000-01-01",
          });
          rulesCreated++;
        } catch (error) {
          logger.error(`Failed to create weekday rule for ${weekday}: ${error}`);
        }
      }
    }

    if (operatingHours.weekends?.enabled) {
      // For weekends (Sat-Sun = 5-6)
      for (let weekday = 5; weekday <= 6; weekday++) {
        try {
          await api.locationHoursRule.create({
            location: { _link: locationId },
            shop: { _link: shopId },
            weekday,
            openTime: operatingHours.weekends.from,
            closeTime: operatingHours.weekends.to,
            validFrom: "2000-01-01",
          });
          rulesCreated++;
        } catch (error) {
          logger.error(`Failed to create weekend rule for ${weekday}: ${error}`);
        }
      }
    }
  }

  return rulesCreated;
}

/**
 * Migrates holiday closures JSON to locationHoursException records
 */
async function migrateHolidayClosures(
  api: any,
  shopId: string,
  locationId: string,
  holidayClosures: any[],
  logger: any
): Promise<number> {
  let exceptionsCreated = 0;

  if (!Array.isArray(holidayClosures) || holidayClosures.length === 0) {
    return 0;
  }

  for (const closure of holidayClosures) {
    try {
      let startDate: string;
      let endDate: string;
      let reason: string;

      if (typeof closure === "string") {
        // Old format: just a holiday name string
        reason = closure;
        // We don't have the actual date, so skip
        continue;
      } else {
        // Custom closure with date
        startDate = closure.date || closure.startDate;
        endDate = closure.date || closure.endDate; // Single day closure
        reason = closure.name || closure.reason || "Holiday closure";
      }

      if (!startDate) {
        continue;
      }

      const exceptionData: any = {
        location: { _link: locationId },
        shop: { _link: shopId },
        startDate,
        endDate: endDate || startDate,
        closedAllDay: true,
        reason,
        validFrom: "2000-01-01",
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
  dryRun: { type: "boolean", default: false },
};

export const options: ActionOptions = {
  returnType: true,
};


import { ActionOptions } from "gadget-server";

/**
 * Fetches location hours from the relational structure and converts back to JSON format
 * for compatibility with the existing UI
 */
export const run: ActionRun = async ({ params, logger, api, connections }) => {
  if (!params.locationId) {
    throw new Error("locationId is required");
  }

  const shopId = connections.shopify.currentShopId;
  if (!shopId) {
    throw new Error("No shop found in current context");
  }

  logger.info("Fetching location hours", { locationId: params.locationId, shopId });

  // Fetch all rules and exceptions for this location
  const rules = await api.locationHoursRule.findMany({
    filter: { 
      AND: [
        { locationId: { equals: params.locationId } },
        { shopId: { equals: shopId } }
      ]
    },
    select: {
      id: true,
      weekday: true,
      openTime: true,
      closeTime: true,
    },
    sort: { weekday: { sortDirection: "asc" } },
  });

  const exceptions = await api.locationHoursException.findMany({
    filter: { 
      AND: [
        { locationId: { equals: params.locationId } },
        { shopId: { equals: shopId } }
      ]
    },
    select: {
      id: true,
      startDate: true,
      endDate: true,
      closedAllDay: true,
      openTime: true,
      closeTime: true,
      reason: true,
    },
  });

  logger.info(`Found ${rules.length} rules and ${exceptions.length} exceptions`);

  // Convert rules to the operatingHours JSON format
  const operatingHours = convertRulesToOperatingHours(rules);

  // Convert exceptions to the holidayClosures array format
  const holidayClosures = convertExceptionsToHolidayClosures(exceptions);

  return {
    locationId: params.locationId,
    operatingHours,
    holidayClosures,
  };
};

/**
 * Converts locationHoursRule records back to operatingHours JSON format
 */
function convertRulesToOperatingHours(rules: any[]): any {
  // If no rules exist, return default structure
  if (rules.length === 0) {
    return {
      mode: "individual_days",
      days: {
        sunday: { enabled: false, from: "09:00", to: "17:00" },
        monday: { enabled: false, from: "09:00", to: "17:00" },
        tuesday: { enabled: false, from: "09:00", to: "17:00" },
        wednesday: { enabled: false, from: "09:00", to: "17:00" },
        thursday: { enabled: false, from: "09:00", to: "17:00" },
        friday: { enabled: false, from: "09:00", to: "17:00" },
        saturday: { enabled: false, from: "09:00", to: "17:00" },
      },
    };
  }

  const weekdaysToDay: Record<number, string> = {
    0: "monday",
    1: "tuesday",
    2: "wednesday",
    3: "thursday",
    4: "friday",
    5: "saturday",
    6: "sunday",
  };

  const days: any = {
    sunday: { enabled: false, from: "09:00", to: "17:00" },
    monday: { enabled: false, from: "09:00", to: "17:00" },
    tuesday: { enabled: false, from: "09:00", to: "17:00" },
    wednesday: { enabled: false, from: "09:00", to: "17:00" },
    thursday: { enabled: false, from: "09:00", to: "17:00" },
    friday: { enabled: false, from: "09:00", to: "17:00" },
    saturday: { enabled: false, from: "09:00", to: "17:00" },
  };

  for (const rule of rules) {
    const dayName = weekdaysToDay[rule.weekday];
    if (dayName && rule.openTime && rule.closeTime) {
      days[dayName] = {
        enabled: true,
        from: rule.openTime,
        to: rule.closeTime,
      };
    }
  }

  return {
    mode: "individual_days",
    days,
  };
}

/**
 * Converts locationHoursException records back to holidayClosures array format
 */
function convertExceptionsToHolidayClosures(exceptions: any[]): any[] {
  return exceptions.map((exception) => {
    if (exception.closedAllDay) {
      return {
        name: exception.reason || "Holiday closure",
        date: exception.startDate,
        endDate: exception.endDate,
      };
    } else {
      return {
        name: exception.reason || "Special hours",
        date: exception.startDate,
        endDate: exception.endDate,
        openTime: exception.openTime,
        closeTime: exception.closeTime,
      };
    }
  });
}

export const params = {
  locationId: { type: "string" },
};

export const options: ActionOptions = {
  returnType: true,
};


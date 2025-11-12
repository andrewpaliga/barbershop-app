import { applyParams, save, ActionOptions } from "gadget-server";
import { preventCrossShopDataAccess } from "gadget-server/shopify";

// Helper function to determine timezone based on location data
function determineTimezone(
  province?: string | null,
  provinceCode?: string | null,
  city?: string | null,
  countryCode?: string | null
): string {
  // If timezone is already set, return it
  // This function is for determining from geographic data
  
  // US States/Provinces mapping
  const usStateTimezones: Record<string, string> = {
    // Pacific Time (PST/PDT)
    'CA': 'America/Los_Angeles', // California
    'WA': 'America/Los_Angeles', // Washington
    'OR': 'America/Los_Angeles', // Oregon
    'NV': 'America/Los_Angeles', // Nevada (most of it)
    'ID': 'America/Boise', // Idaho (split, but Boise is Pacific)
    'AK': 'America/Anchorage', // Alaska
    'HI': 'Pacific/Honolulu', // Hawaii
    
    // Mountain Time (MST/MDT)
    'MT': 'America/Denver', // Montana
    'WY': 'America/Denver', // Wyoming
    'CO': 'America/Denver', // Colorado
    'NM': 'America/Denver', // New Mexico
    'UT': 'America/Denver', // Utah
    'AZ': 'America/Phoenix', // Arizona (no DST)
    'ND': 'America/Denver', // North Dakota (western part)
    'SD': 'America/Denver', // South Dakota (western part)
    
    // Central Time (CST/CDT)
    'TX': 'America/Chicago', // Texas
    'OK': 'America/Chicago', // Oklahoma
    'KS': 'America/Chicago', // Kansas
    'NE': 'America/Chicago', // Nebraska
    'IA': 'America/Chicago', // Iowa
    'MO': 'America/Chicago', // Missouri
    'AR': 'America/Chicago', // Arkansas
    'LA': 'America/Chicago', // Louisiana
    'MN': 'America/Chicago', // Minnesota
    'WI': 'America/Chicago', // Wisconsin
    'IL': 'America/Chicago', // Illinois
    'MI': 'America/Detroit', // Michigan
    'IN': 'America/Indiana/Indianapolis', // Indiana
    'KY': 'America/New_York', // Kentucky (Eastern)
    'TN': 'America/Chicago', // Tennessee (Central)
    'MS': 'America/Chicago', // Mississippi
    'AL': 'America/Chicago', // Alabama
    'ND': 'America/Chicago', // North Dakota (eastern part)
    'SD': 'America/Chicago', // South Dakota (eastern part)
    
    // Eastern Time (EST/EDT)
    'NY': 'America/New_York', // New York
    'PA': 'America/New_York', // Pennsylvania
    'NJ': 'America/New_York', // New Jersey
    'DE': 'America/New_York', // Delaware
    'MD': 'America/New_York', // Maryland
    'DC': 'America/New_York', // Washington DC
    'VA': 'America/New_York', // Virginia
    'WV': 'America/New_York', // West Virginia
    'NC': 'America/New_York', // North Carolina
    'SC': 'America/New_York', // South Carolina
    'GA': 'America/New_York', // Georgia
    'FL': 'America/New_York', // Florida (most of it)
    'OH': 'America/New_York', // Ohio
    'MA': 'America/New_York', // Massachusetts
    'RI': 'America/New_York', // Rhode Island
    'CT': 'America/New_York', // Connecticut
    'NH': 'America/New_York', // New Hampshire
    'VT': 'America/New_York', // Vermont
    'ME': 'America/New_York', // Maine
  };
  
  // Canadian Provinces mapping
  const canadaProvinceTimezones: Record<string, string> = {
    'BC': 'America/Vancouver', // British Columbia
    'AB': 'America/Edmonton', // Alberta
    'SK': 'America/Regina', // Saskatchewan
    'MB': 'America/Winnipeg', // Manitoba
    'ON': 'America/Toronto', // Ontario
    'QC': 'America/Montreal', // Quebec
    'NB': 'America/Moncton', // New Brunswick
    'NS': 'America/Halifax', // Nova Scotia
    'PE': 'America/Halifax', // Prince Edward Island
    'NL': 'America/St_Johns', // Newfoundland and Labrador
    'YT': 'America/Whitehorse', // Yukon
    'NT': 'America/Yellowknife', // Northwest Territories
    'NU': 'America/Iqaluit', // Nunavut
  };
  
  // Try province code first (most reliable)
  if (provinceCode) {
    const upperProvinceCode = provinceCode.toUpperCase();
    
    if (countryCode?.toUpperCase() === 'US' && usStateTimezones[upperProvinceCode]) {
      return usStateTimezones[upperProvinceCode];
    }
    
    if (countryCode?.toUpperCase() === 'CA' && canadaProvinceTimezones[upperProvinceCode]) {
      return canadaProvinceTimezones[upperProvinceCode];
    }
  }
  
  // Try province name
  if (province) {
    const upperProvince = province.toUpperCase();
    
    // Check US states by name
    if (countryCode?.toUpperCase() === 'US') {
      for (const [code, tz] of Object.entries(usStateTimezones)) {
        // Map common state name variations to codes
        const stateNameMap: Record<string, string> = {
          'CALIFORNIA': 'CA',
          'NEW YORK': 'NY',
          'TEXAS': 'TX',
          'FLORIDA': 'FL',
          'ILLINOIS': 'IL',
          'PENNSYLVANIA': 'PA',
          'OHIO': 'OH',
          'GEORGIA': 'GA',
          'NORTH CAROLINA': 'NC',
          'MICHIGAN': 'MI',
        };
        
        const stateCode = stateNameMap[upperProvince] || code;
        if (stateCode === code && upperProvince.includes(code) || upperProvince === code) {
          return tz;
        }
      }
    }
  }
  
  // Try city name for major cities
  if (city) {
    const upperCity = city.toUpperCase();
    const cityTimezoneMap: Record<string, string> = {
      'LOS ANGELES': 'America/Los_Angeles',
      'SAN FRANCISCO': 'America/Los_Angeles',
      'SAN DIEGO': 'America/Los_Angeles',
      'SEATTLE': 'America/Los_Angeles',
      'PORTLAND': 'America/Los_Angeles',
      'DENVER': 'America/Denver',
      'CHICAGO': 'America/Chicago',
      'DALLAS': 'America/Chicago',
      'HOUSTON': 'America/Chicago',
      'NEW YORK': 'America/New_York',
      'BROOKLYN': 'America/New_York',
      'PHILADELPHIA': 'America/New_York',
      'BOSTON': 'America/New_York',
      'MIAMI': 'America/New_York',
      'ATLANTA': 'America/New_York',
      'TORONTO': 'America/Toronto',
      'VANCOUVER': 'America/Vancouver',
      'MONTREAL': 'America/Montreal',
    };
    
    for (const [cityName, tz] of Object.entries(cityTimezoneMap)) {
      if (upperCity.includes(cityName) || cityName.includes(upperCity)) {
        return tz;
      }
    }
  }
  
  // Default to Eastern Time
  return 'America/New_York';
}

export const run: ActionRun = async ({ params, record, logger, api, connections }) => {
  applyParams(params, record);
  await preventCrossShopDataAccess(params, record);
  
  // Set default operating hours if not already set
  if (!record.operatingHours) {
    record.operatingHours = {
      monday: { isOpen: true, startTime: '09:00', endTime: '18:00' },
      tuesday: { isOpen: true, startTime: '09:00', endTime: '18:00' },
      wednesday: { isOpen: true, startTime: '09:00', endTime: '18:00' },
      thursday: { isOpen: true, startTime: '09:00', endTime: '18:00' },
      friday: { isOpen: true, startTime: '09:00', endTime: '18:00' },
      saturday: { isOpen: true, startTime: '09:00', endTime: '17:00' },
      sunday: { isOpen: false }
    };
  }
  
  // Set timezone if not already set - try to determine from location data
  if (!record.timeZone) {
    const determinedTimezone = determineTimezone(
      (record as any).province,
      (record as any).provinceCode,
      (record as any).city,
      (record as any).countryCode
    );
    record.timeZone = determinedTimezone;
    
    logger?.info('Auto-determined timezone for new location', {
      locationId: record.id,
      locationName: (record as any).name,
      province: (record as any).province,
      provinceCode: (record as any).provinceCode,
      city: (record as any).city,
      countryCode: (record as any).countryCode,
      determinedTimezone: determinedTimezone,
    });
  }
  
  // Set default enforceOperatingHours if not already set
  if (record.enforceOperatingHours === undefined || record.enforceOperatingHours === null) {
    record.enforceOperatingHours = false;
  }
  
  await save(record);
};

export const onSuccess: ActionOnSuccess = async ({ params, record, logger, api, connections }) => {
  try {
    // Seed locationHoursRule records from the location's operatingHours
    const operatingHours: any = record.operatingHours || {};
    const shopId = (record as any).shopId;

    const dayOrder = [
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
      'sunday',
    ];

    const now = new Date();

    // Create a rule per open day
    for (let i = 0; i < dayOrder.length; i++) {
      const dayKey = dayOrder[i];
      const config = operatingHours?.[dayKey];
      if (!config || config.isOpen === false) continue;

      const openTime: string = config.startTime || '09:00';
      const closeTime: string = config.endTime || '17:00';

      try {
        await api.locationHoursRule.create({
          location: { _link: record.id },
          shop: { _link: shopId },
          weekday: i, // 0 = Monday
          openTime,
          closeTime,
          validFrom: now,
        });
      } catch (createErr) {
        logger?.warn('Failed to seed locationHoursRule for day', {
          locationId: record.id,
          dayKey,
          weekday: i,
          error: createErr instanceof Error ? createErr.message : String(createErr),
        });
      }
    }

    logger?.info('Seeded locationHoursRule from operatingHours', {
      locationId: record.id,
      shopId,
    });
  } catch (err) {
    logger?.warn('Seeding locationHoursRule failed', {
      locationId: record.id,
      error: err instanceof Error ? err.message : String(err),
    });
  }
};

export const options: ActionOptions = { actionType: "create" };

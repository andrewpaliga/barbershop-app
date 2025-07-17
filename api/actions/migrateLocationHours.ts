import { save } from "gadget-server";

export const run: ActionRun = async ({ params, logger, api, connections }) => {
  // Default barbershop operating hours
  const defaultOperatingHours = {
    monday: { isOpen: true, startTime: '09:00', endTime: '18:00' },
    tuesday: { isOpen: true, startTime: '09:00', endTime: '18:00' },
    wednesday: { isOpen: true, startTime: '09:00', endTime: '18:00' },
    thursday: { isOpen: true, startTime: '09:00', endTime: '18:00' },
    friday: { isOpen: true, startTime: '09:00', endTime: '18:00' },
    saturday: { isOpen: true, startTime: '09:00', endTime: '17:00' },
    sunday: { isOpen: false }
  };

  // Query all locations that need operating hours configured
  const locations = await api.shopifyLocation.findMany({
    filter: {
      OR: [
        { operatingHours: { isSet: false } },
        { operatingHours: { equals: null } }
      ]
    },
    select: {
      id: true,
      name: true,
      operatingHours: true,
      timeZone: true,
      enforceOperatingHours: true
    }
  });

  logger.info(`Found ${locations.length} locations without operating hours configured`);

  let updatedCount = 0;
  const results = [];

  for (const location of locations) {
    try {
      // Fetch the full record
      const locationRecord = await api.shopifyLocation.findOne(location.id);
      
      // Modify the record properties directly
      locationRecord.operatingHours = defaultOperatingHours;

      // Set default timezone if not already set
      if (!locationRecord.timeZone) {
        locationRecord.timeZone = 'America/New_York';
      }

      // Set enforceOperatingHours to false if not set
      if (locationRecord.enforceOperatingHours === null || locationRecord.enforceOperatingHours === undefined) {
        locationRecord.enforceOperatingHours = false;
      }

      // Save the record
      await save(locationRecord);
      
      updatedCount++;
      results.push({
        id: location.id,
        name: location.name,
        status: 'updated'
      });

      logger.info(`Updated operating hours for location: ${location.name} (${location.id})`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to update location ${location.name} (${location.id}): ${errorMessage}`);
      results.push({
        id: location.id,
        name: location.name,
        status: 'failed',
        error: errorMessage
      });
    }
  }

  const summary = {
    totalLocationsFound: locations.length,
    locationsUpdated: updatedCount,
    locationsFailed: locations.length - updatedCount,
    results: results
  };

  logger.info(`Migration completed: ${updatedCount} locations updated out of ${locations.length} total`);

  return summary;
};

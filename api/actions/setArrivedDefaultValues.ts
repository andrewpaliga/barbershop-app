export const run: ActionRun = async ({ params, logger, api, connections }) => {
  // Get the current shop ID for tenancy filtering
  const shopId = connections.shopify.currentShopId;
  
  logger.info("Starting arrived field migration for existing bookings");
  
  // Find all booking records where arrived is null (not set)
  const bookingsToUpdate = await api.booking.findMany({
    filter: {
      AND: [
        { shopId: { equals: shopId } },
        { arrived: { isSet: false } }
      ]
    },
    select: {
      id: true,
      arrived: true
    }
  });
  
  logger.info(`Found ${bookingsToUpdate.length} booking records with null arrived field that need updating`);
  
  // Log the current values being found
  if (bookingsToUpdate.length > 0) {
    const nullCount = bookingsToUpdate.filter(b => b.arrived === null).length;
    const undefinedCount = bookingsToUpdate.filter(b => b.arrived === undefined).length;
    const otherCount = bookingsToUpdate.length - nullCount - undefinedCount;
    
    logger.info(`Breakdown of arrived field values found - null: ${nullCount}, undefined: ${undefinedCount}, other: ${otherCount}`);
  }
  
  if (bookingsToUpdate.length === 0) {
    logger.info("No bookings found with null arrived field that require updating");
    return {
      success: true,
      message: "No bookings with null arrived field required updating",
      recordsUpdated: 0
    };
  }
  
  // Prepare bulk update data
  const updateData = bookingsToUpdate.map(booking => ({
    id: booking.id,
    arrived: false
  }));
  
  // Perform bulk update
  const updateResults = await api.booking.bulkUpdate(updateData);
  
  const successCount = updateResults.length;
  
  logger.info(`Successfully updated ${successCount} booking records from null arrived field to arrived = false`);
  
  return {
    success: true,
    message: `Migration completed successfully. Updated ${successCount} booking records from null to arrived = false.`,
    recordsUpdated: successCount,
    recordsFound: bookingsToUpdate.length
  };
};

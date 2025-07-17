export const params = {
  clearTable: {
    type: "boolean",
    default: false
  }
};

export const run: ActionRun = async ({ params, logger, api, connections }) => {
  logger.info("Starting migration of staffAvailability dayOfWeek fields across all shops");
  
  // Parameter to choose migration strategy
  const clearTable = params.clearTable || false;
  
  if (clearTable) {
    logger.info("Clear table mode selected - deleting all staffAvailability records");
    return await clearAllStaffAvailability(logger, api);
  }
  
  try {
    logger.info("Attempting to migrate staffAvailability records using internal API");
    
    // Use internal API to bypass GraphQL validation
    const staffAvailabilityRecords = await api.internal.staffAvailability.findMany({
      select: {
        id: true,
        dayOfWeek: true,
        staffId: true,
        shopId: true
      }
    });
    
    logger.info(`Found ${staffAvailabilityRecords.length} staffAvailability records to process`);
    
    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    // Process each record
    for (const record of staffAvailabilityRecords) {
      try {
        const currentDayOfWeek = record.dayOfWeek;
        
        // Check if dayOfWeek is already an array (new format) or needs migration
        if (Array.isArray(currentDayOfWeek)) {
          // Already in correct format, skip
          skippedCount++;
          continue;
        }
        
        // If it's a string (old format), convert to array
        if (typeof currentDayOfWeek === 'string' && currentDayOfWeek.length > 0) {
          const newDayOfWeekArray = [currentDayOfWeek];
          
          // Use internal API to bypass validations during migration
          await api.internal.staffAvailability.update(record.id, {
            dayOfWeek: newDayOfWeekArray
          });
          
          logger.info(`Updated record ${record.id} - converted "${currentDayOfWeek}" to [${newDayOfWeekArray.join(', ')}]`);
          updatedCount++;
        } else if (currentDayOfWeek === null || currentDayOfWeek === undefined) {
          // Handle null/undefined values by setting to empty array
          await api.internal.staffAvailability.update(record.id, {
            dayOfWeek: []
          });
          
          logger.info(`Updated record ${record.id} - set null/undefined dayOfWeek to empty array`);
          updatedCount++;
        } else {
          // Handle other unexpected values
          logger.warn(`Record ${record.id} has unexpected dayOfWeek value: ${JSON.stringify(currentDayOfWeek)}, skipping`);
          skippedCount++;
        }
        
      } catch (recordError) {
        logger.error(`Error processing record ${record.id}: ${recordError.message}`);
        errorCount++;
      }
    }
    
    // Log final results
    logger.info(`Migration completed successfully!`);
    logger.info(`Total records processed: ${staffAvailabilityRecords.length}`);
    logger.info(`Records updated: ${updatedCount}`);
    logger.info(`Records skipped (already correct format): ${skippedCount}`);
    logger.info(`Records with errors: ${errorCount}`);
    
    return {
      success: true,
      totalRecords: staffAvailabilityRecords.length,
      updatedCount,
      skippedCount,
      errorCount,
      message: "Migration completed successfully"
    };
    
  } catch (error) {
    logger.error(`Migration failed with error: ${error.message}`);
    logger.error(`This might be due to validation issues. Consider running with clearTable=true to delete all records instead.`);
    
    // If migration fails, suggest clearing the table
    return {
      success: false,
      error: error.message,
      suggestion: "Migration failed. You can run this action with clearTable=true to delete all staffAvailability records and start fresh.",
      totalRecords: 0,
      updatedCount: 0,
      skippedCount: 0,
      errorCount: 0
    };
  }
};

async function clearAllStaffAvailability(logger: any, api: any) {
  try {
    logger.info("Starting to clear all staffAvailability records");
    
    // Get all record IDs using internal API
    const allRecords = await api.internal.staffAvailability.findMany({
      select: {
        id: true
      }
    });
    
    logger.info(`Found ${allRecords.length} records to delete`);
    
    if (allRecords.length === 0) {
      logger.info("No records found to delete");
      return {
        success: true,
        message: "No staffAvailability records found to delete",
        deletedCount: 0
      };
    }
    
    // Delete records in batches to avoid overwhelming the system
    const batchSize = 50;
    let deletedCount = 0;
    
    for (let i = 0; i < allRecords.length; i += batchSize) {
      const batch = allRecords.slice(i, i + batchSize);
      const recordIds = batch.map(record => record.id);
      
      try {
        // Use bulk delete with internal API
        await api.staffAvailability.bulkDelete(recordIds);
        deletedCount += recordIds.length;
        logger.info(`Deleted batch of ${recordIds.length} records (${deletedCount}/${allRecords.length} total)`);
      } catch (batchError) {
        logger.error(`Error deleting batch starting at index ${i}: ${batchError.message}`);
        // Continue with next batch
      }
    }
    
    logger.info(`Successfully deleted ${deletedCount} staffAvailability records`);
    
    return {
      success: true,
      message: `Successfully deleted ${deletedCount} staffAvailability records. You can now create new records with the correct dayOfWeek array format.`,
      deletedCount,
      totalRecords: allRecords.length
    };
    
  } catch (error) {
    logger.error(`Failed to clear staffAvailability records: ${error.message}`);
    return {
      success: false,
      error: error.message,
      message: "Failed to clear staffAvailability records",
      deletedCount: 0
    };
  }
}

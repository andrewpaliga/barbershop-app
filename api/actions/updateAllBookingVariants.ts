export const run: ActionRun = async ({ params, logger, api, connections }) => {
  let totalProcessed = 0;
  let successfulUpdates = 0;
  let errors = 0;
  const errorDetails: string[] = [];

  logger.info("Starting bulk update of booking variants to ID '50750669881636'");

  try {
    // Process records in batches using pagination
    let hasMore = true;
    let cursor: string | undefined = undefined;

    while (hasMore) {
      // Fetch a batch of bookings
      const bookings = await api.booking.findMany({
        first: 250,
        ...(cursor && { after: cursor }),
        select: {
          id: true,
          variantId: true
        }
      });

      logger.info(`Processing batch of ${bookings.length} bookings`);

      // Update each booking in the batch
      for (const booking of bookings) {
        totalProcessed++;

        try {
          // Only update if the variantId is different
          if (booking.variantId !== '50750669881636') {
            await api.booking.update(booking.id, {
              variant: {
                _link: '50750669881636'
              }
            });
            successfulUpdates++;
          }

          // Log progress every 50 records
          if (totalProcessed % 50 === 0) {
            logger.info(`Processed ${totalProcessed} records so far`);
          }
        } catch (error) {
          errors++;
          const errorMessage = `Failed to update booking ${booking.id}: ${error}`;
          errorDetails.push(errorMessage);
          logger.error(errorMessage);
        }
      }

      // Check if there are more records to process
      hasMore = bookings.hasNextPage;
      if (hasMore) {
        cursor = bookings.endCursor;
      }
    }

    const summary = {
      totalProcessed,
      successfulUpdates,
      errors,
      errorDetails: errorDetails.slice(0, 10) // Limit error details to first 10
    };

    logger.info(`Bulk update complete: ${JSON.stringify(summary)}`);
    return summary;

  } catch (error) {
    logger.error(`Critical error during bulk update: ${error}`);
    throw error;
  }
};

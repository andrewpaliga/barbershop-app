export const run: ActionRun = async ({ params, logger, api, connections }) => {
  try {
    // Log the start of the operation
    logger.info("Starting SQL update of booking variants");
    
    // Execute raw SQL to update all booking records
    const sql = `UPDATE booking SET "variantId" = $1`;
    const variantId = '50750669881636';
    
    logger.info(`Executing SQL: ${sql} with variantId: ${variantId}`);
    
    // Execute the raw SQL query using the database connection
    const result = await (connections as any).pg.query(sql, [variantId]);
    
    // Log the results
    logger.info(`SQL update completed. Rows affected: ${result.rowCount}`);
    
    // Return the number of rows affected
    return {
      success: true,
      rowsAffected: result.rowCount,
      message: `Successfully updated ${result.rowCount} booking records with variantId: ${variantId}`
    };
    
  } catch (error) {
    // Log the error
    logger.error("Error executing SQL update:", error);
    
    // Re-throw the error to be handled by the framework
    throw new Error(`Failed to update booking variants: ${error.message}`);
  }
};

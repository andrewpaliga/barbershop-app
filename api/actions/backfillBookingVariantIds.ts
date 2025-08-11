export const run: ActionRun = async ({ params, logger, api, connections }) => {
  try {
    logger.info("Starting backfill of booking variant IDs");
    
    // Execute raw SQL to update all booking records
    const sql = `UPDATE booking SET "variantId" = $1`;
    const values = ['50750669881636'];
    
    const result = await connections.db.query(sql, values);
    
    const rowsAffected = result.rowCount || 0;
    
    logger.info(`Successfully updated ${rowsAffected} booking records with variantId: 50750669881636`);
    
    return {
      success: true,
      rowsAffected,
      message: `Updated ${rowsAffected} booking records`
    };
    
  } catch (error) {
    logger.error({ error }, "Failed to backfill booking variant IDs");
    throw error;
  }
};
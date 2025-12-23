/**
 * Scheduled action to clean up reminder history older than 90 days
 * This should be run daily to remove old reminder records and keep the database clean
 */

import { ActionRun } from "gadget-server";

export const run: ActionRun = async ({ logger, api }) => {
  const now = new Date();
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  
  try {
    // Find all reminder history records older than 90 days
    const oldReminders = await api.reminderHistory.findMany({
      filter: {
        sentAt: {
          lessThan: ninetyDaysAgo.toISOString(),
        },
      },
      select: {
        id: true,
      },
    });
    
    let deletedCount = 0;
    
    for (const reminder of oldReminders) {
      try {
        await api.reminderHistory.delete(reminder.id);
        deletedCount++;
      } catch (error) {
        logger?.error(`Failed to delete reminder history ${reminder.id}`, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    
    logger?.info(`Cleaned up ${deletedCount} reminder history records older than 90 days`);
  } catch (error) {
    logger?.error("Error in cleanupOldReminders action", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
};

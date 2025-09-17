import { deleteRecord, ActionOptions } from "gadget-server";
import { preventCrossShopDataAccess } from "gadget-server/shopify";

export const run: ActionRun = async ({ params, record, logger, api, connections }) => {
  await preventCrossShopDataAccess(params, record);
  await deleteRecord(record);
};

// Helper function to update config
const updateConfig = async (config: any, shopId: string, workingHours: any, api: any) => {
  if (config) {
    await api.config.update(config.id, { workingHours });
  } else {
    await api.config.create({
      shop: { _link: shopId },
      workingHours
    });
  }
};

export const onSuccess: ActionOnSuccess = async ({ params, record, logger, api, connections }) => {
  try {
    const shopId = record.shopId;
    
    // Get config for this shop
    const config = await api.config.maybeFindFirst({
      filter: { shop: { id: { equals: shopId } } },
      select: { id: true, workingHours: true }
    });
    
    const now = new Date();
    const lastCleanupTime = config?.workingHours?.lastProductCleanup;
    const cleanupQueued = config?.workingHours?.cleanupQueued || false;
    
    // Check if we need immediate cleanup (no recent cleanup or >60s ago)
    const shouldRunImmediately = !lastCleanupTime || 
      (now.getTime() - new Date(lastCleanupTime).getTime()) > 60000;
    
    if (shouldRunImmediately) {
      // Run cleanup immediately and record timestamp
      const updatedWorkingHours = {
        ...(config?.workingHours || {}),
        lastProductCleanup: now.toISOString(),
        cleanupQueued: false
      };
      
      await updateConfig(config, shopId, updatedWorkingHours, api);
      await api.enqueue(api.cleanupDeletedProducts);
      
      logger.info(`Product cleanup running immediately for shop ${shopId} after product deletion`);
    } else {
      // Recent cleanup exists (<60s ago), check if we need to queue delayed cleanup
      if (!cleanupQueued) {
        // Calculate when delayed cleanup should run (60s after last cleanup)
        const lastCleanupDate = new Date(lastCleanupTime);
        const delayedCleanupTime = new Date(lastCleanupDate.getTime() + 60000);
        const delayMs = Math.max(0, delayedCleanupTime.getTime() - now.getTime());
        
        // Set the queued flag immediately to prevent duplicates
        const updatedWorkingHours = {
          ...(config?.workingHours || {}),
          lastProductCleanup: lastCleanupTime, // Keep existing timestamp
          cleanupQueued: true
        };
        
        await updateConfig(config, shopId, updatedWorkingHours, api);
        
        // Schedule the delayed cleanup
        setTimeout(async () => {
          try {
            // Run the cleanup
            await api.enqueue(api.cleanupDeletedProducts);
            
            // Update config to clear queued flag and update timestamp
            const finalWorkingHours = {
              ...(config?.workingHours || {}),
              lastProductCleanup: new Date().toISOString(),
              cleanupQueued: false
            };
            
            // Need to get fresh config reference for the delayed update
            const freshConfig = await api.config.maybeFindFirst({
              filter: { shop: { id: { equals: shopId } } },
              select: { id: true, workingHours: true }
            });
            
            await updateConfig(freshConfig, shopId, finalWorkingHours, api);
            
            logger.info(`Delayed product cleanup executed for shop ${shopId}`);
          } catch (error) {
            logger.error('Failed to execute delayed product cleanup', {
              error: error.message,
              shopId
            });
          }
        }, delayMs);
        
        logger.info(`Product cleanup queued for shop ${shopId}, will run in ${Math.round(delayMs / 1000)}s (60s after last cleanup)`);
      } else {
        const timeSinceLastCleanup = Math.round((now.getTime() - new Date(lastCleanupTime).getTime()) / 1000);
        logger.info(`Product cleanup already queued for shop ${shopId}, skipping (last cleanup was ${timeSinceLastCleanup}s ago)`);
      }
    }
  } catch (error) {
    // Log error but don't fail the product deletion
    logger.error('Failed to manage product cleanup queue', { 
      error: error.message,
      shopId: record.shopId 
    });
  }
};

export const options: ActionOptions = { actionType: "delete" };

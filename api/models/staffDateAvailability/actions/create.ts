import { applyParams, save, ActionOptions } from "gadget-server";
import { preventCrossShopDataAccess } from "gadget-server/shopify";

export const run: ActionRun = async ({ params, record, logger, api, connections }) => {
  applyParams(params, record);
  
  // Fix timezone issue by ensuring date is stored as date-only value
  if (typeof record.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(record.date)) {
    // Parse YYYY-MM-DD string as local date to avoid timezone shifts
    const [year, month, day] = record.date.split('-').map(Number);
    const localDate = new Date(year, month - 1, day);
    
    logger.info("StaffDateAvailability create - Date conversion:", {
      originalString: record.date,
      convertedDate: localDate.toISOString(),
      localDateString: localDate.toDateString()
    });
    
    record.date = localDate;
  }

  await preventCrossShopDataAccess(params, record);
  await save(record);
};

export const options: ActionOptions = {
  actionType: "create",
};

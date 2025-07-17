import { applyParams, save, ActionOptions } from "gadget-server";
import { preventCrossShopDataAccess } from "gadget-server/shopify";

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
  
  // Set default timezone if not already set
  if (!record.timeZone) {
    record.timeZone = 'America/New_York';
  }
  
  // Set default enforceOperatingHours if not already set
  if (record.enforceOperatingHours === undefined || record.enforceOperatingHours === null) {
    record.enforceOperatingHours = false;
  }
  
  await save(record);
};

export const onSuccess: ActionOnSuccess = async ({ params, record, logger, api, connections }) => {
  // Your logic goes here
};

export const options: ActionOptions = { actionType: "create" };

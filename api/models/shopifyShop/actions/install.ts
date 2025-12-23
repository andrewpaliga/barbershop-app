import { applyParams, save, ActionOptions, ActionRun, ActionOnSuccess } from "gadget-server";

export const run: ActionRun = async ({ params, record, logger, api, connections }) => {
  applyParams(params, record);
  await save(record);
};

export const onSuccess: ActionOnSuccess = async ({ params, record, logger, api, connections }) => {
  // Run Shopify sync for the newly installed shop
  await api.shopifySync.run({
    domain: record.domain,
    shop: {
      _link: record.id
    }
  });

  // Create default config record for the new shop
  try {
    logger.info(`Creating default config for shop ${record.id}`);
    
    await api.config.create({
      shop: {
        _link: record.id
      },
      businessName: record.name || "My Business",
      allowOnlineBooking: true,
      autoConfirmBookings: false,
      bookingAdvanceLimit: 30,
      bookingBuffer: 15,
      emailNotifications: true,
      smsNotifications: false,
      timeSlotInterval: 30,
      timeZone: record.ianaTimezone || record.timezone || "UTC",
      requireCustomerInfo: true,
      onboardingSkipped: false,
      posExtensionUsed: false,
      themeExtensionUsed: false,
      workingHours: {
        monday: { enabled: true, start: "09:00", end: "17:00" },
        tuesday: { enabled: true, start: "09:00", end: "17:00" },
        wednesday: { enabled: true, start: "09:00", end: "17:00" },
        thursday: { enabled: true, start: "09:00", end: "17:00" },
        friday: { enabled: true, start: "09:00", end: "17:00" },
        saturday: { enabled: false, start: "09:00", end: "17:00" },
        sunday: { enabled: false, start: "09:00", end: "17:00" }
      },
      cancellationPolicy: "Cancellations must be made at least 24 hours in advance.",
      enableAppointmentConfirmations: false,
      enable24HourReminders: false,
      enable1HourReminders: false,
    });
    
    logger.info(`Successfully created default config for shop ${record.id}`);
  } catch (error) {
    logger.error(`Failed to create default config for shop ${record.id}:`, error);
    throw error;
  }
};

export const options: ActionOptions = { actionType: "create" };

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

  // Create example staff members if no staff exist
  try {
    const existingStaff = await api.staff.findMany({
      filter: { shopId: { equals: record.id } },
      first: 1
    });

    if (existingStaff.length === 0) {
      logger.info(`Creating example staff members for shop ${record.id}`);

      // Find the first available location for this shop
      const locations = await api.shopifyLocation.findMany({
        filter: { shopId: { equals: record.id } },
        first: 1
      });
      const firstLocation = locations.length > 0 ? locations[0] : null;

      // Create first example staff member: Alex Johnson (Mon-Fri 9am-5pm)
      const alex = await api.staff.create({
        shop: { _link: record.id },
        name: "Alex Johnson",
        email: "alex@example.com",
        phone: "(555) 123-4567",
        title: "Example Staff",
        isActive: true,
      });

      // Create availability for Alex (Mon-Fri 9am-5pm)
      const alexWeekdays = ["monday", "tuesday", "wednesday", "thursday", "friday"];
      for (const day of alexWeekdays) {
        await api.staffAvailability.create({
          shop: { _link: record.id },
          staff: { _link: alex.id },
          dayOfWeek: [day],
          startTime: "09:00",
          endTime: "17:00",
          isAvailable: true,
          ...(firstLocation && { location: { _link: firstLocation.id } }),
        });
      }

      // Create second example staff member: Jamie Smith (Tue-Sat 10am-6pm)
      const jamie = await api.staff.create({
        shop: { _link: record.id },
        name: "Jamie Smith",
        email: "jamie@example.com",
        phone: "(555) 987-6543",
        title: "Example Staff",
        isActive: true,
      });

      // Create availability for Jamie (Tue-Sat 10am-6pm)
      const jamieWeekdays = ["tuesday", "wednesday", "thursday", "friday", "saturday"];
      for (const day of jamieWeekdays) {
        await api.staffAvailability.create({
          shop: { _link: record.id },
          staff: { _link: jamie.id },
          dayOfWeek: [day],
          startTime: "10:00",
          endTime: "18:00",
          isAvailable: true,
          ...(firstLocation && { location: { _link: firstLocation.id } }),
        });
      }

      logger.info(`Successfully created example staff members for shop ${record.id}`);
    } else {
      logger.info(`Shop ${record.id} already has staff members, skipping example staff creation`);
    }
  } catch (error) {
    // Don't throw - example staff creation failure shouldn't break installation
    logger.error(`Failed to create example staff for shop ${record.id}:`, error);
  }
};

export const options: ActionOptions = { actionType: "create" };

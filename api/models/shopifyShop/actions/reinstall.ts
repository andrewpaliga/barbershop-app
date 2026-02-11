import { applyParams, save, ActionOptions } from "gadget-server";
import { preventCrossShopDataAccess } from "gadget-server/shopify";

export const run: ActionRun = async ({ params, record, logger, api, connections }) => {
  applyParams(params, record);
  await preventCrossShopDataAccess(params, record);
  await save(record);
};

export const onSuccess: ActionOnSuccess = async ({ params, record, logger, api, connections }) => {
  // Add a models array and syncSince in the future if you want to restrict what data is synced
  await api.shopifySync.run({
    domain: record.domain,
    shop: {
      _link: record.id
    }
  });

  // Create example staff members if no staff exist (for reinstalls that may not have staff)
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
    // Don't throw - example staff creation failure shouldn't break reinstallation
    logger.error(`Failed to create example staff for shop ${record.id}:`, error);
  }
};

export const options: ActionOptions = { actionType: "update" };

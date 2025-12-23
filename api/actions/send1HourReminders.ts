/**
 * Scheduled action to send 1-hour reminder emails for upcoming appointments
 * This should be run periodically (e.g., every 15 minutes) to check for appointments
 * that are 1 hour away and send reminder emails.
 */

import { ActionRun, ActionOptions } from "gadget-server";
import { sendReminderEmail, formatDateTimeForEmail } from "../helpers/sendgrid";

export const run: ActionRun = async ({ logger, api }) => {
  const now = new Date();
  const in1Hour = new Date(now.getTime() + 60 * 60 * 1000);
  
  // Find bookings that are approximately 1 hour away (within a 15-minute window)
  const windowStart = new Date(in1Hour.getTime() - 7.5 * 60 * 1000); // 7.5 minutes before
  const windowEnd = new Date(in1Hour.getTime() + 7.5 * 60 * 1000); // 7.5 minutes after
  
  try {
    // Get all shops with 1-hour reminders enabled
    const configs = await api.config.findMany({
      filter: {
        enable1HourReminders: { equals: true },
      },
      select: {
        id: true,
        shopId: true,
        businessName: true,
      },
    });
    
    let totalSent = 0;
    let totalFailed = 0;
    
    for (const config of configs) {
      // Fetch shop name and domain as primary source for business name
      const shop = await api.shopifyShop.findOne(config.shopId, {
        select: {
          name: true,
          domain: true,
        },
      });
      
      // Find bookings for this shop that are in the 1-hour window
      const bookings = await api.booking.findMany({
        filter: {
          shopId: { equals: config.shopId },
          scheduledAt: {
            greaterThanOrEqual: windowStart.toISOString(),
            lessThan: windowEnd.toISOString(),
          },
          status: {
            in: ["pending", "paid", "not_paid"],
          },
        },
        select: {
          id: true,
          scheduledAt: true,
          duration: true,
          customerEmail: true,
          locationTimeZone: true,
          variant: {
            product: {
              title: true,
            },
          },
          staff: {
            name: true,
          },
          location: {
            name: true,
            address1: true,
            address2: true,
            city: true,
            province: true,
            zipCode: true,
            country: true,
          },
        },
      });
      
      // Check which reminders have already been sent
      for (const booking of bookings) {
        // Check if we've already sent a 1-hour reminder for this booking
        const existingReminder = await api.reminderHistory.findFirst({
          filter: {
            bookingId: { equals: booking.id },
            reminderType: { equals: "1_hour" },
          },
        });
        
        if (existingReminder) {
          continue; // Already sent
        }
        
        if (!booking.customerEmail) {
          continue; // No email to send to
        }
        
        try {
          const scheduledAt = new Date(booking.scheduledAt);
          const timeZone = booking.locationTimeZone || 'America/New_York';
          
          const locationAddress = [
            booking.location?.address1,
            booking.location?.address2,
            booking.location?.city,
            booking.location?.province,
            booking.location?.zipCode,
            booking.location?.country,
          ].filter(Boolean).join(", ");
          
          // Format shop URL from domain
          const shopUrl = shop?.domain 
            ? (shop.domain.startsWith('http') ? shop.domain : `https://${shop.domain}`)
            : "";
          
          const emailData = {
            serviceName: booking.variant?.product?.title || "Service",
            serviceDateTime: formatDateTimeForEmail(scheduledAt, timeZone),
            providerName: booking.staff?.name || "Staff",
            businessName: shop?.name || config.businessName || "Business",
            locationName: booking.location?.name || "Location",
            locationAddress: locationAddress || "Address not available",
            shopUrl: shopUrl,
          };
          
          const templateId = "d-174ae5ec77b449a2a9f117c3db575cc1";
          const result = await sendReminderEmail(
            booking.customerEmail,
            emailData,
            templateId
          );
          
          // Record in reminder history
          await api.reminderHistory.create({
            booking: { _link: booking.id },
            customerEmail: booking.customerEmail,
            reminderType: "1_hour",
            sentAt: new Date(),
            shop: { _link: config.shopId },
            status: result.success ? "sent" : "failed",
            errorMessage: result.error || null,
          });
          
          if (result.success) {
            totalSent++;
            logger?.info(`1-hour reminder sent for booking ${booking.id}`);
          } else {
            totalFailed++;
            logger?.warn(`Failed to send 1-hour reminder for booking ${booking.id}: ${result.error}`);
          }
        } catch (error) {
          totalFailed++;
          logger?.error(`Error sending 1-hour reminder for booking ${booking.id}`, {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }
    
    logger?.info(`1-hour reminders: ${totalSent} sent, ${totalFailed} failed`);
  } catch (error) {
    logger?.error("Error in send1HourReminders action", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
};

export const options: ActionOptions = {
  triggers: {
    scheduler: [
      {
        type: "cron",
        cron: "*/15 * * * *", // Run every 15 minutes
      },
    ],
  },
};


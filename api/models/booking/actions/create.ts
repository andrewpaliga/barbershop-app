import { applyParams, save, ActionOptions, ActionRun } from "gadget-server";
import { preventCrossShopDataAccess } from "gadget-server/shopify";
import { sendConfirmationEmail, formatDateTimeForEmail, formatDateTimeForGoogleCalendar } from "../../../helpers/sendgrid";

export const run: ActionRun = async ({ params, record, logger, api, connections }) => {
  applyParams(params, record);
  
  // Always set status to 'not_paid' for new bookings
  record.status = 'not_paid';
  
  // Populate locationTimeZone from the location if not already set
  if (!record.locationTimeZone && record.locationId) {
    try {
      const location = await api.shopifyLocation.findOne(record.locationId, {
        select: {
          id: true,
          timeZone: true,
        },
      });
      
      if (location?.timeZone) {
        record.locationTimeZone = location.timeZone;
        logger?.info(`Set locationTimeZone from location`, {
          bookingId: record.id,
          locationId: record.locationId,
          timeZone: location.timeZone,
        });
      } else {
        // Default to EST if location doesn't have timezone
        record.locationTimeZone = 'America/New_York';
        logger?.warn(`Location missing timezone, defaulting to America/New_York`, {
          bookingId: record.id,
          locationId: record.locationId,
        });
      }
    } catch (error) {
      // If location lookup fails, default to EST
      record.locationTimeZone = 'America/New_York';
      logger?.warn(`Failed to fetch location timezone, defaulting to America/New_York`, {
        bookingId: record.id,
        locationId: record.locationId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  } else if (!record.locationTimeZone) {
    // No location provided, default to EST
    record.locationTimeZone = 'America/New_York';
    logger?.warn(`No location provided, defaulting timezone to America/New_York`, {
      bookingId: record.id,
    });
  }
  
  await preventCrossShopDataAccess(params, record);
  await save(record);
  
  // Send confirmation email if enabled
  if (record.customerEmail && record.shopId) {
    try {
      const config = await api.config.findFirst({
        filter: { shopId: { equals: record.shopId } },
        select: {
          enableAppointmentConfirmations: true,
          businessName: true,
        },
      });
      
      // Also fetch shop name and domain as fallback
      const shop = await api.shopifyShop.findOne(record.shopId, {
        select: {
          name: true,
          domain: true,
        },
      });
      
      if (config?.enableAppointmentConfirmations) {
        // Fetch related data for email
        const bookingWithRelations = await api.booking.findOne(record.id, {
          select: {
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
        
        if (bookingWithRelations && bookingWithRelations.customerEmail) {
          const scheduledAt = new Date(bookingWithRelations.scheduledAt);
          const timeZone = bookingWithRelations.locationTimeZone || 'America/New_York';
          const endTime = new Date(scheduledAt.getTime() + (bookingWithRelations.duration || 60) * 60000);
          
          const locationAddress = [
            bookingWithRelations.location?.address1,
            bookingWithRelations.location?.address2,
            bookingWithRelations.location?.city,
            bookingWithRelations.location?.province,
            bookingWithRelations.location?.zipCode,
            bookingWithRelations.location?.country,
          ].filter(Boolean).join(", ");
          
          // Always prioritize Shopify store name first, then config businessName, then fallback
          const businessName = shop?.name || config.businessName || "Business";
          
          // Format shop URL from domain
          const shopUrl = shop?.domain 
            ? (shop.domain.startsWith('http') ? shop.domain : `https://${shop.domain}`)
            : "";
          
          logger?.info(`Sending confirmation email with businessName: ${businessName}`, {
            bookingId: record.id,
            shopName: shop?.name,
            shopDomain: shop?.domain,
            shopUrl: shopUrl,
            configBusinessName: config.businessName,
          });
          
          const emailData = {
            serviceName: bookingWithRelations.variant?.product?.title || "Service",
            serviceDateTime: formatDateTimeForEmail(scheduledAt, timeZone),
            providerName: bookingWithRelations.staff?.name || "Staff",
            businessName: businessName,
            locationName: bookingWithRelations.location?.name || "Location",
            locationAddress: locationAddress || "Address not available",
            shopUrl: shopUrl,
            gcalStart: formatDateTimeForGoogleCalendar(scheduledAt),
            gcalEnd: formatDateTimeForGoogleCalendar(endTime),
          };
          
          // TODO: Replace with your actual SendGrid template ID for confirmation emails
          // You can find this in your SendGrid dashboard under Email API > Dynamic Templates
          const templateId = "d-290cb7cadfd04b0e8c89fed27557accf";
          const result = await sendConfirmationEmail(
            bookingWithRelations.customerEmail,
            emailData,
            templateId
          );
          
          // Record in reminder history
          await api.reminderHistory.create({
            booking: { _link: record.id },
            customerEmail: bookingWithRelations.customerEmail,
            reminderType: "confirmation",
            sentAt: new Date(),
            shop: { _link: record.shopId },
            status: result.success ? "sent" : "failed",
            errorMessage: result.error || null,
          });
          
          if (result.success) {
            logger?.info(`Confirmation email sent for booking ${record.id}`);
          } else {
            logger?.warn(`Failed to send confirmation email for booking ${record.id}: ${result.error}`);
          }
        }
      }
    } catch (error) {
      logger?.error(`Error sending confirmation email for booking ${record.id}`, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
};

export const options: ActionOptions = {
  actionType: "create",
};

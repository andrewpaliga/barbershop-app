import { applyParams, save, ActionOptions } from "gadget-server";
import { preventCrossShopDataAccess } from "gadget-server/shopify";

export const run: ActionRun = async ({ params, record, logger, api, connections }) => {
  applyParams(params, record);
  await preventCrossShopDataAccess(params, record);
  await save(record);

  // Log order details at start
  logger.info(`Starting processBookings for order ${record.id}`, {
    orderId: record.id,
    orderName: record.name,
    financialStatus: record.financialStatus,
    shopId: record.shopId,
    customerId: record.customerId,
    email: record.email,
    totalPrice: record.totalPrice,
    currency: record.currency
  });

  // Only process orders with 'paid' financial status
  if (record.financialStatus !== 'paid') {
    logger.info(`Order ${record.id} is not paid (status: ${record.financialStatus}), skipping booking processing`);
    return;
  }

  logger.info(`Order ${record.id} has paid financial status, proceeding with booking processing`);

  // Check if this order has already been processed to avoid duplicates
  logger.info(`Checking for existing bookings for order ${record.id} with name ${record.name}`);
  
  const existingBookings = await api.booking.findMany({
    filter: {
      shopId: { equals: record.shopId },
      // We'll use the notes field to track the order ID
      notes: { startsWith: `Order: ${record.name}` }
    }
  });

  logger.info(`Found ${existingBookings.length} existing bookings for order ${record.id}`);

  if (existingBookings.length > 0) {
    logger.info(`Order ${record.id} has already been processed, skipping booking creation`, {
      existingBookingIds: existingBookings.map(b => b.id)
    });
    return;
  }

  logger.info(`No existing bookings found for order ${record.id}, proceeding with processing`);

  // Get line items for this order
  logger.info(`Fetching line items for order ${record.id}`);
  
  const lineItems = await api.shopifyOrderLineItem.findMany({
    filter: {
      orderId: { equals: record.id }
    },
    select: {
      id: true,
      name: true,
      quantity: true,
      price: true,
      properties: true,
      product: {
        id: true,
        title: true,
        isBarberService: true
      }
    }
  });

  logger.info(`Found ${lineItems.length} line items for order ${record.id}`, {
    lineItemIds: lineItems.map(li => li.id),
    lineItemNames: lineItems.map(li => li.name)
  });

  // Process each line item
  for (const lineItem of lineItems) {
    try {
      logger.info(`Processing line item ${lineItem.id}`, {
        lineItemId: lineItem.id,
        name: lineItem.name,
        quantity: lineItem.quantity,
        price: lineItem.price,
        productId: lineItem.product?.id,
        productTitle: lineItem.product?.title,
        propertiesCount: lineItem.properties?.length || 0
      });

      // Check if this line item represents a barber service
      const isBarberService = lineItem.product?.isBarberService === true;
      
      logger.info(`Line item ${lineItem.id} barber service check`, {
        isBarberService,
        productIsBarberService: lineItem.product?.isBarberService
      });
      
      if (!isBarberService) {
        logger.info(`Line item ${lineItem.id} is not a barber service, skipping`);
        continue;
      }

      // Extract booking metadata from line item properties
      const properties = lineItem.properties || [];
      logger.info(`Extracting booking data from ${properties.length} properties for line item ${lineItem.id}`, {
        properties: properties.map(p => ({ name: p.name, value: p.value }))
      });
      
      const bookingData = extractBookingData(properties, logger);

      logger.info(`Extracted booking data for line item ${lineItem.id}`, {
        bookingData,
        hasAllRequiredData: !!(bookingData.date && bookingData.time && bookingData.barberName && bookingData.locationName)
      });

      if (!bookingData.date || !bookingData.time || !bookingData.barberName || !bookingData.locationName) {
        logger.warn(`Line item ${lineItem.id} missing required booking data`, {
          bookingData,
          missingFields: {
            date: !bookingData.date,
            time: !bookingData.time,
            barberName: !bookingData.barberName,
            locationName: !bookingData.locationName
          }
        });
        continue;
      }

      // Find matching staff member
      logger.info(`Searching for staff member for line item ${lineItem.id}`, {
        searchCriteria: {
          name: bookingData.barberName,
          shopId: record.shopId,
          isActive: true
        }
      });
      
      const staff = await api.staff.findMany({
        filter: {
          name: { equals: bookingData.barberName },
          shopId: { equals: record.shopId },
          isActive: { equals: true }
        },
        first: 1
      });

      logger.info(`Staff search results for line item ${lineItem.id}`, {
        staffFound: staff.length,
        staffIds: staff.map(s => s.id),
        staffNames: staff.map(s => s.name)
      });

      if (staff.length === 0) {
        logger.error(`Could not find active staff member with name: ${bookingData.barberName}`, {
          lineItemId: lineItem.id,
          searchedName: bookingData.barberName,
          shopId: record.shopId
        });
        continue;
      }

      // Find matching location
      logger.info(`Searching for location for line item ${lineItem.id}`, {
        searchCriteria: {
          name: bookingData.locationName,
          shopId: record.shopId,
          active: true
        }
      });
      
      const location = await api.shopifyLocation.findMany({
        filter: {
          name: { equals: bookingData.locationName },
          shopId: { equals: record.shopId },
          active: { equals: true }
        },
        select: {
          id: true,
          name: true,
          timeZone: true
        },
        first: 1
      });

      logger.info(`Location search results for line item ${lineItem.id}`, {
        locationsFound: location.length,
        locationIds: location.map(l => l.id),
        locationNames: location.map(l => l.name)
      });

      if (location.length === 0) {
        logger.error(`Could not find active location with name: ${bookingData.locationName}`, {
          lineItemId: lineItem.id,
          searchedName: bookingData.locationName,
          shopId: record.shopId
        });
        continue;
      }

      // Get location timezone for proper date handling
      const locationTimeZone = location[0].timeZone;
      
      logger.info(`Using location timezone for scheduling`, {
        lineItemId: lineItem.id,
        locationId: location[0].id,
        locationName: location[0].name,
        locationTimeZone: locationTimeZone
      });

      // Create timezone-aware scheduledAt date
      const scheduledAt = createScheduledAtInLocationTimezone(
        bookingData.date, 
        bookingData.time, 
        locationTimeZone, 
        logger, 
        lineItem.id
      );
      
      if (!scheduledAt) {
        logger.error(`Failed to create valid scheduled date for line item ${lineItem.id}`, {
          lineItemId: lineItem.id,
          date: bookingData.date,
          time: bookingData.time,
          locationTimeZone: locationTimeZone
        });
        continue;
      }
      
      logger.info(`Preparing booking creation for line item ${lineItem.id}`, {
        originalDate: bookingData.date,
        originalTime: bookingData.time,
        locationTimeZone: locationTimeZone,
        scheduledAt: scheduledAt.toISOString(),
        productId: lineItem.product.id,
        staffId: staff[0].id,
        locationId: location[0].id,
        duration: bookingData.duration || 60
      });

      // Parse price correctly - handle decimal amounts
      const rawPrice = lineItem.price || '';
      logger.info(`Parsing price for line item ${lineItem.id}`, {
        lineItemId: lineItem.id,
        rawPrice: rawPrice
      });
      
      // Remove currency symbols and convert to number, preserving decimals
      const priceWithoutCurrency = rawPrice.replace(/[^\d.-]/g, '');
      const totalPrice = parseFloat(priceWithoutCurrency) || 0;
      
      logger.info(`Price parsing result for line item ${lineItem.id}`, {
        lineItemId: lineItem.id,
        rawPrice: rawPrice,
        priceWithoutCurrency: priceWithoutCurrency,
        totalPrice: totalPrice
      });

      // Create booking record
      const bookingCreateData = {
        scheduledAt,
        product: { _link: lineItem.product.id },
        totalPrice: totalPrice,
        staff: { _link: staff[0].id },
        duration: bookingData.duration || 60, // Default to 60 minutes
        status: 'confirmed',
        notes: `Order: ${record.name}\nService: ${lineItem.name}\n${bookingData.notes || ''}`.trim(),
        shop: { _link: record.shopId },
        location: { _link: location[0].id }
      };

      // Only set customer relationship if customerId exists, otherwise fall back to email/name
      if (record.customerId) {
        bookingCreateData.customer = { _link: record.customerId };
        logger.info(`Linking booking to customer ${record.customerId} for line item ${lineItem.id}`);
      } else {
        // Fall back to storing email/name directly if no customer relationship
        bookingCreateData.customerEmail = record.email || bookingData.customerEmail;
        bookingCreateData.customerName = bookingData.customerName || `${record.billingAddress?.first_name || ''} ${record.billingAddress?.last_name || ''}`.trim();
        logger.info(`No customer ID available, using email/name fallback for line item ${lineItem.id}`, {
          customerEmail: bookingCreateData.customerEmail,
          customerName: bookingCreateData.customerName
        });
      }

      logger.info(`Creating booking with data`, {
        lineItemId: lineItem.id,
        bookingCreateData
      });

      const booking = await api.booking.create(bookingCreateData);

      logger.info(`Successfully created booking ${booking.id} for order ${record.id}, line item ${lineItem.id}`, {
        bookingId: booking.id,
        orderId: record.id,
        lineItemId: lineItem.id,
        scheduledAt: booking.scheduledAt,
        status: booking.status
      });

    } catch (error) {
      logger.error(`Error processing line item ${lineItem.id} for order ${record.id}`, {
        lineItemId: lineItem.id,
        orderId: record.id,
        lineItemName: lineItem.name,
        error: error.message,
        stack: error.stack
      });
      // Continue processing other line items even if one fails
    }
  }

  logger.info(`Completed processing bookings for order ${record.id}`);
};

// Helper function to extract booking data from line item properties
function extractBookingData(properties: any[], logger?: any): any {
  const bookingData: any = {};
  
  if (logger) {
    logger.info(`Starting booking data extraction from ${properties?.length || 0} properties`);
  }
  
  if (!Array.isArray(properties)) {
    if (logger) {
      logger.warn(`Properties is not an array:`, { properties, type: typeof properties });
    }
    return bookingData;
  }

  properties.forEach((prop: any, index: number) => {
    if (logger) {
      logger.info(`Processing property ${index}:`, { name: prop.name, value: prop.value });
    }
    
    if (prop.name && prop.value) {
      const normalizedName = prop.name.toLowerCase();
      
      switch (normalizedName) {
        case 'booking_date':
        case 'booking date':
          bookingData.date = prop.value;
          if (logger) logger.info(`Extracted date: ${prop.value}`);
          break;
        case 'booking_time':
        case 'booking time':
          bookingData.time = prop.value;
          if (logger) logger.info(`Extracted time: ${prop.value}`);
          break;
        case 'barber_name':
        case 'barber name':
        case 'barber':
        case 'stylist_name':
        case 'stylist name':
          bookingData.barberName = prop.value;
          if (logger) logger.info(`Extracted barber name: ${prop.value}`);
          break;
        case 'location_name':
        case 'location name':
        case 'location':
        case 'shop_location':
        case 'shop location':
          bookingData.locationName = prop.value;
          if (logger) logger.info(`Extracted location name: ${prop.value}`);
          break;
        case 'customer_name':
        case 'customer name':
          bookingData.customerName = prop.value;
          if (logger) logger.info(`Extracted customer name: ${prop.value}`);
          break;
        case 'customer_email':
        case 'customer email':
          bookingData.customerEmail = prop.value;
          if (logger) logger.info(`Extracted customer email: ${prop.value}`);
          break;
        case 'duration':
        case 'service_duration':
        case 'service duration':
          bookingData.duration = parseInt(prop.value) || 60;
          if (logger) logger.info(`Extracted duration: ${bookingData.duration}`);
          break;
        case 'notes':
        case 'booking_notes':
        case 'booking notes':
          bookingData.notes = prop.value;
          if (logger) logger.info(`Extracted notes: ${prop.value}`);
          break;
        default:
          if (logger) {
            logger.info(`Unrecognized property name: ${prop.name} (normalized: ${normalizedName})`);
          }
      }
    } else {
      if (logger) {
        logger.warn(`Property ${index} missing name or value:`, { name: prop.name, value: prop.value });
      }
    }
  });

  if (logger) {
    logger.info(`Completed booking data extraction:`, { bookingData });
  }

  return bookingData;
}

// Helper function to create timezone-aware scheduled date
function createScheduledAtInLocationTimezone(
  dateStr: string, 
  timeStr: string, 
  locationTimeZone: string | null | undefined, 
  logger: any, 
  lineItemId: string
): Date | null {
  try {
    logger.info(`Starting timezone conversion for line item ${lineItemId}`, {
      lineItemId: lineItemId,
      originalDate: dateStr,
      originalTime: timeStr,
      locationTimeZone: locationTimeZone
    });

    // Parse MM/DD/YYYY format and convert to YYYY-MM-DD
    const dateParts = dateStr.split('/');
    if (dateParts.length !== 3) {
      logger.error(`Invalid date format for line item ${lineItemId}`, {
        lineItemId: lineItemId,
        dateValue: dateStr,
        expectedFormat: 'MM/DD/YYYY'
      });
      return null;
    }
    
    const month = dateParts[0].padStart(2, '0');
    const day = dateParts[1].padStart(2, '0');
    const year = dateParts[2];
    const formattedDate = `${year}-${month}-${day}`;
    
    // Parse time (assume HH:MM format, handle 12-hour format if needed)
    let parsedTime = timeStr;
    if (timeStr.includes('AM') || timeStr.includes('PM')) {
      parsedTime = convertTo24Hour(timeStr);
      logger.info(`Converted 12-hour time to 24-hour format`, {
        lineItemId: lineItemId,
        originalTime: timeStr,
        convertedTime: parsedTime
      });
    }
    
    // Ensure time is in HH:MM format
    if (!/^\d{2}:\d{2}$/.test(parsedTime)) {
      logger.error(`Invalid time format for line item ${lineItemId}`, {
        lineItemId: lineItemId,
        timeValue: timeStr,
        parsedTime: parsedTime,
        expectedFormat: 'HH:MM or HH:MM AM/PM'
      });
      return null;
    }
    
    const [hours, minutes] = parsedTime.split(':').map(Number);
    
    // Use fallback timezone if locationTimeZone is not provided
    const timezone = locationTimeZone || 'America/New_York';
    
    logger.info(`Parsed date/time components`, {
      lineItemId: lineItemId,
      year: parseInt(year),
      month: parseInt(month),
      day: parseInt(day),
      hours: hours,
      minutes: minutes,
      timezone: timezone
    });
    
    // Create date in the location's timezone
    // We'll use a combination of approaches to handle timezone conversion properly
    
    // Method 1: Try using Intl.DateTimeFormat to handle timezone conversion
    let scheduledAtUTC: Date;
    
    try {
      // Create a date object representing the local time in the location's timezone
      // We need to calculate the timezone offset for the specific date to handle DST
      const localDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), hours, minutes, 0, 0);
      
      logger.info(`Created local date object`, {
        lineItemId: lineItemId,
        localDate: localDate.toISOString(),
        localDateString: localDate.toString()
      });
      
      // Get the timezone offset for this specific date in the location's timezone
      const offsetMinutes = getTimezoneOffset(localDate, timezone);
      
      logger.info(`Retrieved timezone offset`, {
        lineItemId: lineItemId,
        timezone: timezone,
        offsetMinutes: offsetMinutes,
        offsetHours: offsetMinutes / 60
      });
      
      // Convert to UTC by subtracting the offset
      scheduledAtUTC = new Date(localDate.getTime() - offsetMinutes * 60 * 1000);
      
      logger.info(`Converted to UTC`, {
        lineItemId: lineItemId,
        localTime: localDate.toISOString(),
        utcTime: scheduledAtUTC.toISOString(),
        timezoneOffset: offsetMinutes
      });
      
    } catch (timezoneError) {
      logger.warn(`Timezone conversion failed, falling back to basic UTC conversion`, {
        lineItemId: lineItemId,
        timezone: timezone,
        error: timezoneError.message
      });
      
      // Fallback: Create UTC date directly (less accurate for DST)
      scheduledAtUTC = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day), hours, minutes, 0, 0));
    }
    
    // Validate the resulting date
    if (isNaN(scheduledAtUTC.getTime())) {
      logger.error(`Invalid date created for line item ${lineItemId}`, {
        lineItemId: lineItemId,
        year: parseInt(year),
        month: parseInt(month),
        day: parseInt(day),
        hours: hours,
        minutes: minutes,
        resultingDate: scheduledAtUTC
      });
      return null;
    }
    
    // Additional validation: ensure the date is reasonable (not too far in the past or future)
    const now = new Date();
    const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    const twoYearsFromNow = new Date(now.getFullYear() + 2, now.getMonth(), now.getDate());
    
    if (scheduledAtUTC < oneYearAgo || scheduledAtUTC > twoYearsFromNow) {
      logger.warn(`Scheduled date seems unreasonable for line item ${lineItemId}`, {
        lineItemId: lineItemId,
        scheduledAt: scheduledAtUTC.toISOString(),
        comparison: {
          oneYearAgo: oneYearAgo.toISOString(),
          twoYearsFromNow: twoYearsFromNow.toISOString()
        }
      });
    }
    
    logger.info(`Successfully created timezone-aware scheduled date`, {
      lineItemId: lineItemId,
      originalDate: dateStr,
      originalTime: timeStr,
      locationTimeZone: timezone,
      scheduledAtUTC: scheduledAtUTC.toISOString(),
      scheduledAtLocal: formatDateInTimezone(scheduledAtUTC, timezone)
    });
    
    return scheduledAtUTC;
    
  } catch (error) {
    logger.error(`Error creating timezone-aware scheduled date for line item ${lineItemId}`, {
      lineItemId: lineItemId,
      dateStr: dateStr,
      timeStr: timeStr,
      locationTimeZone: locationTimeZone,
      error: error.message,
      stack: error.stack
    });
    return null;
  }
}

// Helper function to convert 12-hour time to 24-hour time
function convertTo24Hour(time12h: string): string {
  const [time, modifier] = time12h.split(' ');
  let [hours, minutes] = time.split(':');
  
  if (hours === '12') {
    hours = '00';
  }
  
  if (modifier === 'PM') {
    hours = (parseInt(hours, 10) + 12).toString();
  }
  
  return `${hours.padStart(2, '0')}:${minutes}`;
}

// Helper function to get timezone offset in minutes for a specific date
function getTimezoneOffset(date: Date, timezone: string): number {
  try {
    // Create a date formatter for the target timezone
    const utcDate = new Date(date.getTime());
    
    // Get the date/time in the target timezone
    const targetTime = utcDate.toLocaleString('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    
    // Get the date/time in UTC
    const utcTime = utcDate.toLocaleString('en-US', {
      timeZone: 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    
    // Parse both times and calculate the difference
    const targetDate = new Date(targetTime);
    const utcDateParsed = new Date(utcTime);
    
    // Calculate offset in minutes
    const offsetMs = targetDate.getTime() - utcDateParsed.getTime();
    const offsetMinutes = Math.round(offsetMs / (1000 * 60));
    
    return offsetMinutes;
    
  } catch (error) {
    // Fallback to a basic timezone offset calculation
    // This is less accurate but provides a reasonable default
    const timezoneOffsets: { [key: string]: number } = {
      'America/New_York': -300,     // EST (UTC-5), will be -240 in EDT
      'America/Chicago': -360,      // CST (UTC-6), will be -300 in CDT
      'America/Denver': -420,       // MST (UTC-7), will be -360 in MDT
      'America/Los_Angeles': -480,  // PST (UTC-8), will be -420 in PDT
      'America/Phoenix': -420,      // MST (UTC-7), no DST
      'UTC': 0
    };
    
    return timezoneOffsets[timezone] || -300; // Default to EST
  }
}

// Helper function to format date in a specific timezone for logging
function formatDateInTimezone(date: Date, timezone: string): string {
  try {
    return date.toLocaleString('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  } catch (error) {
    return date.toISOString();
  }
}

export const options: ActionOptions = {
  actionType: "custom",
  triggers: {
    api: true
  }
};

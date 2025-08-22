export const run: ActionRun = async ({ params, logger, api, connections }) => {
  const testDate = params.testDate;
  const shopId = connections.shopify.currentShopId;
  
  logger.info(`Starting date handling debug with input: ${testDate}`);
  
  // Log the original string value
  logger.info(`Original testDate string: ${testDate}`);
  logger.info(`Type of testDate: ${typeof testDate}`);
  
  if (!testDate) {
    throw new Error('testDate parameter is required');
  }
  
  // Parse the date string (YYYY-MM-DD format)
  const dateParts = testDate.split('-');
  if (dateParts.length !== 3) {
    throw new Error('testDate must be in YYYY-MM-DD format');
  }
  
  const year = parseInt(dateParts[0], 10);
  const month = parseInt(dateParts[1], 10);
  const day = parseInt(dateParts[2], 10);
  
  logger.info(`Parsed components - Year: ${year}, Month: ${month}, Day: ${day}`);
  
  // Convert using new Date(year, month-1, day) method to avoid timezone issues
  const properDateObj = new Date(year, month - 1, day);
  logger.info(`Created Date object using new Date(${year}, ${month - 1}, ${day}): ${properDateObj}`);
  logger.info(`Date object toString(): ${properDateObj.toString()}`);
  logger.info(`Date object toISOString(): ${properDateObj.toISOString()}`);
  logger.info(`Date object toDateString(): ${properDateObj.toDateString()}`);
  
  // Also show what happens with naive string parsing for comparison
  const naiveDateObj = new Date(testDate);
  logger.info(`Naive Date parsing new Date("${testDate}"): ${naiveDateObj}`);
  logger.info(`Naive date toISOString(): ${naiveDateObj.toISOString()}`);
  
  // Find or create a staff member for testing
  let staff = await api.staff.findFirst({
    filter: {
      shopId: { equals: shopId }
    }
  });
  
  if (!staff) {
    logger.info('No staff found, creating test staff member');
    staff = await api.staff.create({
      name: 'Debug Test Staff',
      shop: { _link: shopId }
    });
    logger.info(`Created staff member with ID: ${staff.id}`);
  } else {
    logger.info(`Using existing staff member with ID: ${staff.id}`);
  }
  
  // Create a staffDateAvailability record with the correctly converted date
  const availability = await api.staffDateAvailability.create({
    date: properDateObj,
    startTime: '09:00',
    endTime: '17:00',
    isAvailable: true,
    staff: { _link: staff.id },
    shop: { _link: shopId },
    notes: `Debug test record created from input: ${testDate}`
  });
  
  logger.info(`Created staffDateAvailability record with ID: ${availability.id}`);
  logger.info(`Stored date value: ${availability.date}`);
  
  // Return detailed information about the date conversion process
  return {
    input: {
      originalString: testDate,
      type: typeof testDate
    },
    parsing: {
      year,
      month,
      day,
      parsedComponents: `${year}-${month}-${day}`
    },
    conversion: {
      properMethod: {
        dateObject: properDateObj.toISOString(),
        dateString: properDateObj.toDateString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      },
      naiveMethod: {
        dateObject: naiveDateObj.toISOString(),
        dateString: naiveDateObj.toDateString()
      }
    },
    database: {
      recordId: availability.id,
      storedDate: availability.date,
      actualStoredValue: availability.date?.toISOString?.() || availability.date
    },
    comparison: {
      inputWas: testDate,
      properConversionResult: properDateObj.toDateString(),
      naiveConversionResult: naiveDateObj.toDateString(),
      databaseStoredAs: availability.date?.toDateString?.() || 'Unable to call toDateString()'
    }
  };
};

export const options = {
  returnType: true
};

export const params = {
  testDate: { 
    type: "string"
  }
};

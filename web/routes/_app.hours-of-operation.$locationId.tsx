import React, { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "@remix-run/react";
import {
  Page,
  Card,
  FormLayout,
  Select,
  RadioButton,
  Checkbox,
  TextField,
  Button,
  Banner,
  Text,
  Box,
  InlineStack,
  BlockStack,
  Breadcrumbs,
  Grid,
  FooterHelp,
  Link,
} from "@shopify/polaris";
import { ArrowLeftIcon } from "@shopify/polaris-icons";
import { useFindOne, useFindFirst, useGlobalAction, useAction } from "@gadgetinc/react";
import { api } from "../api";

interface OperatingHours {
  mode: "weekdays_weekends" | "individual_days";
  weekdays: {
    enabled: boolean;
    from: string;
    to: string;
  };
  weekends: {
    enabled: boolean;
    from: string;
    to: string;
  };
  days: {
    [key: string]: {
      enabled: boolean;
      from: string;
      to: string;
    };
  };
}

interface CustomHoliday {
  name: string;
  date: string;
}

type HolidayItem = string | CustomHoliday;



const USA_HOLIDAYS = [
  "New Year's Day",
  "Martin Luther King Jr. Day",
  "Presidents' Day",
  "Memorial Day",
  "Independence Day",
  "Labor Day",
  "Columbus Day",
  "Veterans Day",
  "Thanksgiving",
  "Christmas Day",
];

const CANADA_HOLIDAYS = [
  "New Year's Day",
  "Family Day",
  "Good Friday",
  "Victoria Day",
  "Canada Day",
  "Civic Holiday",
  "Labour Day",
  "Thanksgiving (Canadian)",
  "Remembrance Day",
  "Christmas Day",
  "Boxing Day",
];

const getHolidaysForCountry = (countryCode: string | null | undefined): string[] => {
  if (countryCode === "CA") {
    return CANADA_HOLIDAYS;
  }
  // Default to USA holidays if country is unknown or US
  return USA_HOLIDAYS;
};

const DAYS_OF_WEEK = [
  { key: "sunday", label: "Sun" },
  { key: "monday", label: "Mon" },
  { key: "tuesday", label: "Tue" },
  { key: "wednesday", label: "Wed" },
  { key: "thursday", label: "Thu" },
  { key: "friday", label: "Fri" },
  { key: "saturday", label: "Sat" },
];

const TIME_OPTIONS = (() => {
  const times = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 15) {
      const timeString = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
      
      // Convert to 12-hour format
      let displayHour = hour;
      let ampm = "AM";
      
      if (hour === 0) {
        displayHour = 12;
        ampm = "AM";
      } else if (hour < 12) {
        displayHour = hour;
        ampm = "AM";
      } else if (hour === 12) {
        displayHour = 12;
        ampm = "PM";
      } else {
        displayHour = hour - 12;
        ampm = "PM";
      }
      
      const displayTime = `${displayHour}:${minute.toString().padStart(2, "0")} ${ampm}`;
      times.push({ label: displayTime, value: timeString });
    }
  }
  return times;
})();

export default function LocationHours() {
  const { locationId } = useParams();
  const navigate = useNavigate();
  
  // Fetch location hours data
  const [{ data: locationHours, fetching: fetchingHours, error: hoursError }] = useFindFirst(api.locationHours, {
    filter: { locationId: { equals: locationId! } },
    select: {
      id: true,
      operatingHours: true,
      holidayClosures: true,
      locationId: true,
    },
  });

  // Fetch basic location data
  const [{ data: location, fetching: fetchingLocation, error: locationError }] = useFindOne(api.shopifyLocation, locationId!, {
    select: {
      id: true,
      name: true,
      timeZone: true,
      countryCode: true,
      offersServices: true,
    },
  });

  const [{ data: updateResult, fetching: updating, error: updateError }, saveLocationHours] = useGlobalAction(
    api.saveLocationHours
  );

  const [{ data: locationUpdateResult, fetching: updatingLocation, error: locationUpdateError }, updateLocation] = useAction(
    api.shopifyLocation.update
  );

  const [operatingHours, setOperatingHours] = useState<OperatingHours>({
    mode: "weekdays_weekends",
    weekdays: {
      enabled: true,
      from: "09:00",
      to: "17:00",
    },
    weekends: {
      enabled: false,
      from: "09:00",
      to: "17:00",
    },
    days: {
      sunday: { enabled: false, from: "09:00", to: "17:00" },
      monday: { enabled: true, from: "09:00", to: "17:00" },
      tuesday: { enabled: true, from: "09:00", to: "17:00" },
      wednesday: { enabled: true, from: "09:00", to: "17:00" },
      thursday: { enabled: true, from: "09:00", to: "17:00" },
      friday: { enabled: true, from: "09:00", to: "17:00" },
      saturday: { enabled: false, from: "09:00", to: "17:00" },
    },
  });
  const [holidayClosures, setHolidayClosures] = useState<HolidayItem[]>([]);
  const [customHolidayInput, setCustomHolidayInput] = useState("");
  const [customHolidayDate, setCustomHolidayDate] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [offersServices, setOffersServices] = useState(true);

  useEffect(() => {
    if (locationHours) {
      if (locationHours.operatingHours) {
        try {
          const hours = typeof locationHours.operatingHours === 'string' 
            ? JSON.parse(locationHours.operatingHours) 
            : locationHours.operatingHours;
          setOperatingHours({ ...operatingHours, ...hours });
        } catch (e) {
          console.error("Error parsing operating hours:", e);
        }
      }
      if (locationHours.holidayClosures) {
        try {
          const closures = typeof locationHours.holidayClosures === 'string' 
            ? JSON.parse(locationHours.holidayClosures) 
            : locationHours.holidayClosures;
          setHolidayClosures(Array.isArray(closures) ? closures : []);
        } catch (e) {
          console.error("Error parsing holiday closures:", e);
        }
      }
    }
  }, [locationHours]);

  useEffect(() => {
    if (updateResult) {
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    }
  }, [updateResult]);

  useEffect(() => {
    if (location?.offersServices !== undefined) {
      setOffersServices(location.offersServices);
    }
  }, [location]);

  const handleModeChange = (mode: OperatingHours["mode"]) => {
    setOperatingHours({ ...operatingHours, mode });
  };

  const handleWeekdaysChange = (field: string, value: string | boolean) => {
    setOperatingHours({
      ...operatingHours,
      weekdays: { ...operatingHours.weekdays, [field]: value },
    });
  };

  const handleWeekendsChange = (field: string, value: string | boolean) => {
    setOperatingHours({
      ...operatingHours,
      weekends: { ...operatingHours.weekends, [field]: value },
    });
  };

  const handleDayChange = (day: string, field: string, value: string | boolean) => {
    setOperatingHours({
      ...operatingHours,
      days: {
        ...operatingHours.days,
        [day]: { ...operatingHours.days[day], [field]: value },
      },
    });
  };

  const handleHolidayChange = (holiday: HolidayItem, checked: boolean) => {
    if (checked) {
      setHolidayClosures([...holidayClosures, holiday]);
    } else {
      setHolidayClosures(holidayClosures.filter((h) => {
        if (typeof h === 'string' && typeof holiday === 'string') {
          return h !== holiday;
        }
        if (typeof h === 'object' && typeof holiday === 'object') {
          return h.name !== holiday.name || h.date !== holiday.date;
        }
        return true;
      }));
    }
  };

  const handleAddCustomHoliday = () => {
    const trimmedInput = customHolidayInput.trim();
    const trimmedDate = customHolidayDate.trim();
    
    // Validate input
    if (!trimmedInput || !trimmedDate) {
      return; // Don't add empty holidays
    }
    
    // Check for duplicate dates among custom holidays
    const existingCustomHolidays = holidayClosures.filter((h): h is CustomHoliday => typeof h === 'object');
    const isDuplicateDate = existingCustomHolidays.some(holiday => holiday.date === trimmedDate);
    
    if (isDuplicateDate) {
      return; // Don't add holidays with duplicate dates
    }
    
    // Add the custom holiday
    const newCustomHoliday: CustomHoliday = {
      name: trimmedInput,
      date: trimmedDate
    };
    setHolidayClosures([...holidayClosures, newCustomHoliday]);
    setCustomHolidayInput(""); // Clear the inputs
    setCustomHolidayDate("");
  };

  const handleRemoveCustomHoliday = (holiday: CustomHoliday) => {
    setHolidayClosures(holidayClosures.filter((h) => {
      if (typeof h === 'object') {
        return h.name !== holiday.name || h.date !== holiday.date;
      }
      return true;
    }));
  };

  const isCustomHoliday = (holiday: HolidayItem): holiday is CustomHoliday => {
    return typeof holiday === 'object';
  };

  const getAllHolidays = (): HolidayItem[] => {
    const predefinedHolidays = getHolidaysForCountry(location?.countryCode);
    const customHolidays = holidayClosures.filter(holiday => typeof holiday === 'object');
    return [...predefinedHolidays, ...customHolidays];
  };

  const handleOffersServicesChange = async (checked: boolean) => {
    setOffersServices(checked);
    try {
      await updateLocation({
        id: locationId!,
        offersServices: checked,
      });
    } catch (error) {
      console.error("Error updating location services setting:", error);
      // Revert state on error
      setOffersServices(!checked);
    }
  };

  const handleSave = async () => {
    try {
      await saveLocationHours({
        locationId: locationId!,
        operatingHours: JSON.stringify(operatingHours),
        holidayClosures: JSON.stringify(holidayClosures),
      });
    } catch (error) {
      console.error("Error saving location hours:", error);
    }
  };

  const isHolidaySelected = (holiday: HolidayItem): boolean => {
    return holidayClosures.some(selected => {
      if (typeof selected === 'string' && typeof holiday === 'string') {
        return selected === holiday;
      }
      if (typeof selected === 'object' && typeof holiday === 'object') {
        return selected.name === holiday.name && selected.date === holiday.date;
      }
      return false;
    });
  };

  const getHolidayDisplayName = (holiday: HolidayItem): string => {
    if (typeof holiday === 'string') {
      return holiday;
    }
    return `${holiday.name} (${holiday.date})`;
  };

  if (fetchingHours || fetchingLocation) {
    return (
      <Page title="Loading...">
        <Card>
          <Text as="p" variant="bodyMd">
            Loading location details...
          </Text>
        </Card>
      </Page>
    );
  }

  if (hoursError || locationError) {
    return (
      <Page title="Error">
        <Card>
          <Banner status="critical">
            <Text as="p" variant="bodyMd">
              Error loading location: {(hoursError || locationError)?.toString()}
            </Text>
          </Banner>
        </Card>
      </Page>
    );
  }

  return (
    <Page
      title={
        <InlineStack gap="300" align="start" blockAlign="center">
          <Button
            variant="plain"
            icon={ArrowLeftIcon}
            onClick={() => navigate("/hours-of-operation")}
            accessibilityLabel="Go back to Hours of Operation"
          />
          <Text as="h1" variant="headingLg">
            Hours of Operation - {location?.name || "Location"}
          </Text>
        </InlineStack>
      }
      titleMetadata={<Text as="span" variant="bodyMd" tone="subdued">Configure operating hours and holidays</Text>}
      breadcrumbs={[
        {
          content: "Hours of Operation",
          url: "/hours-of-operation",
        },
      ]}
      primaryAction={{
        content: "Save",
        loading: updating,
        onAction: handleSave,
      }}
    >
      <BlockStack gap="500">
        {showSuccess && (
          <Banner status="success">
            <Text as="p" variant="bodyMd">
              Location hours updated successfully!
            </Text>
          </Banner>
        )}

        {updateError && (
          <Banner status="critical">
            <Text as="p" variant="bodyMd">
              Error updating location hours: {updateError.toString()}
            </Text>
          </Banner>
        )}

        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">
              Service Availability
            </Text>
            <Checkbox
              label="I offer services at this location"
              checked={offersServices}
              onChange={handleOffersServicesChange}
              helpText="When enabled, customers can book appointments at this location. When disabled, this location will not appear in the booking widget."
            />
            {locationUpdateError && (
              <Banner status="critical">
                <Text as="p" variant="bodyMd">
                  Error updating service availability: {locationUpdateError.toString()}
                </Text>
              </Banner>
            )}
          </BlockStack>
        </Card>

        <Card>
          <BlockStack gap="500">
            <Text as="h2" variant="headingMd">
              Days and Hours of Operation
            </Text>
            <Text as="p" variant="bodyMd" tone="subdued">
              These are the times your customers can reach your team.
            </Text>

            <BlockStack gap="400">
              <Box>
                <RadioButton
                  label="Weekdays / Weekends"
                  checked={operatingHours.mode === "weekdays_weekends"}
                  id="weekdays_weekends"
                  onChange={() => handleModeChange("weekdays_weekends")}
                />
                <Box paddingInlineStart="600" paddingBlockStart="200">
                  <Text as="p" variant="bodyMd" tone="subdued">
                    Set different hours for weekdays (Monday-Friday) and weekends (Saturday-Sunday)
                  </Text>
                </Box>
              </Box>

              <Box>
                <RadioButton
                  label="Individual days"
                  checked={operatingHours.mode === "individual_days"}
                  id="individual_days"
                  onChange={() => handleModeChange("individual_days")}
                />
                <Box paddingInlineStart="600" paddingBlockStart="200">
                  <Text as="p" variant="bodyMd" tone="subdued">
                    Set specific hours for each day of the week
                  </Text>
                </Box>
              </Box>
            </BlockStack>

            {operatingHours.mode === "weekdays_weekends" && (
              <Box paddingBlockStart="400">
                <BlockStack gap="400">
                  <Box>
                    <InlineStack gap="400" align="start" blockAlign="center">
                      <Box minWidth="120px">
                        <Checkbox
                          label="Weekdays"
                          checked={operatingHours.weekdays.enabled}
                          onChange={(checked) => handleWeekdaysChange("enabled", checked)}
                        />
                      </Box>
                      <Text as="span" variant="bodyMd">
                        from
                      </Text>
                      <Box minWidth="120px">
                        <Select
                          label=""
                          options={TIME_OPTIONS}
                          value={operatingHours.weekdays.from}
                          onChange={(value) => handleWeekdaysChange("from", value)}
                          disabled={!operatingHours.weekdays.enabled}
                        />
                      </Box>
                      <Text as="span" variant="bodyMd">
                        to
                      </Text>
                      <Box minWidth="120px">
                        <Select
                          label=""
                          options={TIME_OPTIONS}
                          value={operatingHours.weekdays.to}
                          onChange={(value) => handleWeekdaysChange("to", value)}
                          disabled={!operatingHours.weekdays.enabled}
                        />
                      </Box>
                    </InlineStack>
                  </Box>

                  <Box>
                    <InlineStack gap="400" align="start" blockAlign="center">
                      <Box minWidth="120px">
                        <Checkbox
                          label="Weekends"
                          checked={operatingHours.weekends.enabled}
                          onChange={(checked) => handleWeekendsChange("enabled", checked)}
                        />
                      </Box>
                      <Text as="span" variant="bodyMd">
                        from
                      </Text>
                      <Box minWidth="120px">
                        <Select
                          label=""
                          options={TIME_OPTIONS}
                          value={operatingHours.weekends.from}
                          onChange={(value) => handleWeekendsChange("from", value)}
                          disabled={!operatingHours.weekends.enabled}
                        />
                      </Box>
                      <Text as="span" variant="bodyMd">
                        to
                      </Text>
                      <Box minWidth="120px">
                        <Select
                          label=""
                          options={TIME_OPTIONS}
                          value={operatingHours.weekends.to}
                          onChange={(value) => handleWeekendsChange("to", value)}
                          disabled={!operatingHours.weekends.enabled}
                        />
                      </Box>
                    </InlineStack>
                  </Box>
                </BlockStack>
              </Box>
            )}

            {operatingHours.mode === "individual_days" && (
              <Box paddingBlockStart="400">
                <BlockStack gap="300">
                  {DAYS_OF_WEEK.map((day) => (
                    <Box key={day.key}>
                      <InlineStack gap="400" align="start" blockAlign="center">
                        <Box minWidth="80px">
                          <Checkbox
                            label={day.label}
                            checked={operatingHours.days[day.key].enabled}
                            onChange={(checked) => handleDayChange(day.key, "enabled", checked)}
                          />
                        </Box>
                        <Text as="span" variant="bodyMd">
                          from
                        </Text>
                        <Box minWidth="120px">
                          <Select
                            label=""
                            options={TIME_OPTIONS}
                            value={operatingHours.days[day.key].from}
                            onChange={(value) => handleDayChange(day.key, "from", value)}
                            disabled={!operatingHours.days[day.key].enabled}
                          />
                        </Box>
                        <Text as="span" variant="bodyMd">
                          to
                        </Text>
                        <Box minWidth="120px">
                          <Select
                            label=""
                            options={TIME_OPTIONS}
                            value={operatingHours.days[day.key].to}
                            onChange={(value) => handleDayChange(day.key, "to", value)}
                            disabled={!operatingHours.days[day.key].enabled}
                          />
                        </Box>
                      </InlineStack>
                    </Box>
                  ))}
                </BlockStack>
              </Box>
            )}
          </BlockStack>
        </Card>

        <Card>
          <BlockStack gap="500">
            <Text as="h2" variant="headingMd">
              Closure / Holidays to Observe
            </Text>
            <Grid>
              {getAllHolidays().map((holiday, index) => {
                const key = typeof holiday === 'string' ? holiday : `${holiday.name}-${holiday.date}`;
                return (
                  <Grid.Cell key={key} columnSpan={{ xs: 6, sm: 4, md: 4, lg: 4, xl: 4 }}>
                    <InlineStack gap="200" align="start" blockAlign="center">
                      <Checkbox
                        label={getHolidayDisplayName(holiday)}
                        checked={isHolidaySelected(holiday)}
                        onChange={(checked) => handleHolidayChange(holiday, checked)}
                      />
                      {isCustomHoliday(holiday) && (
                        <Button
                          variant="plain"
                          size="micro"
                          onClick={() => handleRemoveCustomHoliday(holiday)}
                          accessibilityLabel={`Remove ${getHolidayDisplayName(holiday)}`}
                        >
                          ×
                        </Button>
                      )}
                    </InlineStack>
                  </Grid.Cell>
                );
              })}
            </Grid>
            
            <Box paddingBlockStart="400">
              <BlockStack gap="300">
                <Text as="h3" variant="headingSm">
                  Add Custom Holiday
                </Text>
                <InlineStack gap="300" align="start" blockAlign="end">
                  <Box minWidth="200px">
                    <TextField
                      label="Holiday Name"
                      value={customHolidayInput}
                      onChange={setCustomHolidayInput}
                      placeholder="Enter holiday name"
                      onKeyPress={(event) => {
                        if (event.key === 'Enter' && customHolidayInput.trim() && customHolidayDate.trim()) {
                          handleAddCustomHoliday();
                        }
                      }}
                    />
                  </Box>
                  <Box minWidth="150px">
                    <TextField
                      label="Date"
                      type="date"
                      value={customHolidayDate}
                      onChange={setCustomHolidayDate}
                      onKeyPress={(event) => {
                        if (event.key === 'Enter' && customHolidayInput.trim() && customHolidayDate.trim()) {
                          handleAddCustomHoliday();
                        }
                      }}
                    />
                  </Box>
                  <Button
                    onClick={handleAddCustomHoliday}
                    disabled={!customHolidayInput.trim() || !customHolidayDate.trim()}
                  >
                    Add Holiday
                  </Button>
                </InlineStack>
              </BlockStack>
            </Box>
          </BlockStack>
        </Card>
      </BlockStack>
      <FooterHelp>
        Learn more about <Link url="https://shopifybookingapp.com/docs/#hours-of-operation">SimplyBook hours of operation</Link>.
      </FooterHelp>
    </Page>
  );
}
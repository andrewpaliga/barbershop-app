import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "@remix-run/react";
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
import { useFindOne, useFindMany, useGlobalAction, useAction } from "@gadgetinc/react";
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

export default function LocationDetail() {
  const { locationId } = useParams();
  const navigate = useNavigate();
  
  // Fetch location hours rules (recurring weekly hours)
  const [{ data: locationHoursRules, fetching: fetchingRules, error: rulesError }] = useFindMany(api.locationHoursRule, {
    filter: { locationId: { equals: locationId! } },
    select: {
      id: true,
      weekday: true,
      openTime: true,
      closeTime: true,
    },
  });

  // Fetch location hours exceptions (holidays, special hours)
  const [{ data: locationHoursExceptions, fetching: fetchingExceptions, error: exceptionsError }] = useFindMany(api.locationHoursException, {
    filter: { locationId: { equals: locationId! } },
    select: {
      id: true,
      startDate: true,
      endDate: true,
      closedAllDay: true,
      openTime: true,
      closeTime: true,
      reason: true,
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
      operatingHours: true,
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

  // Helper to convert rules to operatingHours format
  const rulesToOperatingHours = (rules: any[]): OperatingHours | null => {
    if (!rules || rules.length === 0) {
      return null;
    }

    const weekdaysToDay: Record<number, string> = {
      0: "monday",
      1: "tuesday",
      2: "wednesday",
      3: "thursday",
      4: "friday",
      5: "saturday",
      6: "sunday",
    };

    const days: any = {};
    
    // Initialize all days as disabled
    Object.values(weekdaysToDay).forEach(day => {
      days[day] = { enabled: false, from: "09:00", to: "17:00" };
    });

    // Set enabled days from rules
    for (const rule of rules) {
      const dayName = weekdaysToDay[rule.weekday];
      if (dayName && rule.openTime && rule.closeTime) {
        days[dayName] = {
          enabled: true,
          from: rule.openTime,
          to: rule.closeTime,
        };
      }
    }

    // Check if we can use weekdays/weekends mode
    const weekdayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
    const weekendNames = ['saturday', 'sunday'];
    
    // Get enabled weekdays
    const enabledWeekdays = weekdayNames.filter(day => days[day]?.enabled);
    const enabledWeekends = weekendNames.filter(day => days[day]?.enabled);
    
    // Check if all enabled weekdays have the same hours
    const weekdaysHaveSameHours = enabledWeekdays.length > 0 && enabledWeekdays.every(day => 
      days[day].from === days[enabledWeekdays[0]].from && 
      days[day].to === days[enabledWeekdays[0]].to
    );
    
    // Check if all enabled weekends have the same hours
    const weekendsHaveSameHours = enabledWeekends.length > 0 && enabledWeekends.every(day => 
      days[day].from === days[enabledWeekends[0]].from && 
      days[day].to === days[enabledWeekends[0]].to
    );
    
    // Check if all weekdays are either all enabled or all disabled
    const allWeekdaysSameState = weekdayNames.every(day => days[day].enabled) || weekdayNames.every(day => !days[day].enabled);
    
    // Check if all weekends are either all enabled or all disabled  
    const allWeekendsSameState = weekendNames.every(day => days[day].enabled) || weekendNames.every(day => !days[day].enabled);
    
    // Use weekdays_weekends mode if the pattern matches
    if (allWeekdaysSameState && allWeekendsSameState && weekdaysHaveSameHours && weekendsHaveSameHours) {
      const weekdaysConfig = enabledWeekdays.length > 0 
        ? { enabled: true, from: days[enabledWeekdays[0]].from, to: days[enabledWeekdays[0]].to }
        : { enabled: false, from: "09:00", to: "17:00" };
      
      const weekendsConfig = enabledWeekends.length > 0
        ? { enabled: true, from: days[enabledWeekends[0]].from, to: days[enabledWeekends[0]].to }
        : { enabled: false, from: "09:00", to: "17:00" };
      
      return {
        mode: "weekdays_weekends",
        weekdays: weekdaysConfig,
        weekends: weekendsConfig,
        days,
      };
    }
    
    // Otherwise use individual_days mode
    return { 
      mode: "individual_days", 
      weekdays: { enabled: false, from: "09:00", to: "17:00" },
      weekends: { enabled: false, from: "09:00", to: "17:00" },
      days 
    };
  };

  // Helper to convert exceptions to holidayClosures format
  const exceptionsToHolidayClosures = (exceptions: any[]): HolidayItem[] => {
    if (!exceptions || exceptions.length === 0) {
      return [];
    }
    
    return exceptions.map(exception => ({
      name: exception.reason || "Holiday closure",
      date: exception.startDate,
      ...(exception.endDate !== exception.startDate && { endDate: exception.endDate }),
      ...(!exception.closedAllDay && { 
        openTime: exception.openTime, 
        closeTime: exception.closeTime 
      })
    }));
  };

  // Helper to normalize legacy format { monday: { isOpen, startTime, endTime } } to new format
  const normalizeLegacyHours = (legacy: any): OperatingHours | null => {
    if (!legacy) return null;
    
    // If already in new format, return as-is
    if (legacy.mode && (legacy.mode === 'weekdays_weekends' || legacy.mode === 'individual_days')) {
      return legacy as OperatingHours;
    }
    
    // Convert legacy format to new format
    const dayKeys = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const days: any = {};
    
    for (const day of dayKeys) {
      const cfg = legacy[day];
      if (cfg && typeof cfg === 'object') {
        const enabled = !!(cfg.isOpen !== undefined ? cfg.isOpen : cfg.enabled);
        const from = cfg.from ?? cfg.startTime ?? '09:00';
        const to = cfg.to ?? cfg.endTime ?? '17:00';
        days[day] = { enabled, from, to };
      }
    }
    
    if (Object.keys(days).length === 0) return null;
    
    // Infer weekdays/weekends from the days
    const weekdays = days.monday || days.tuesday || days.wednesday || days.thursday || days.friday;
    const weekends = days.saturday || days.sunday;
    
    return {
      mode: 'weekdays_weekends',
      weekdays: weekdays || { enabled: false, from: '09:00', to: '17:00' },
      weekends: weekends || { enabled: false, from: '09:00', to: '17:00' },
      days,
    };
  };

  useEffect(() => {
    if (locationHoursRules || locationHoursExceptions) {
      const convertedHours = rulesToOperatingHours(locationHoursRules || []);
      const convertedClosures = exceptionsToHolidayClosures(locationHoursExceptions || []);
      
      if (convertedHours) {
        console.log('Loading hours from locationHoursRules:', convertedHours);
        setOperatingHours(convertedHours);
      }
      if (convertedClosures && convertedClosures.length > 0) {
        console.log('Loading closures from locationHoursExceptions:', convertedClosures);
        setHolidayClosures(convertedClosures);
      }
    } else if (location && (location as any).operatingHours) {
      // Fallback: if no locationHoursRules, try reading from shopifyLocation.operatingHours
      try {
        const legacyHours = (location as any).operatingHours;
        const normalized = normalizeLegacyHours(legacyHours);
        if (normalized) {
          console.log('Loading hours from shopifyLocation.operatingHours:', normalized);
          setOperatingHours(normalized);
        }
      } catch (e) {
        console.error("Error parsing legacy operating hours:", e);
      }
    }
  }, [locationHoursRules, locationHoursExceptions, location]);

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
      // Clean up the operating hours based on mode
      let cleanOperatingHours;
      
      if (operatingHours.mode === 'weekdays_weekends') {
        // Update all individual days to match weekdays/weekends settings
        const updatedDays: { [key: string]: { enabled: boolean; from: string; to: string } } = {};
        
        // Weekdays (Monday-Friday)
        const weekdaysList = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
        weekdaysList.forEach(day => {
          updatedDays[day] = {
            enabled: operatingHours.weekdays.enabled,
            from: operatingHours.weekdays.from,
            to: operatingHours.weekdays.to
          };
        });
        
        // Weekends (Saturday-Sunday)
        const weekendsList = ['saturday', 'sunday'];
        weekendsList.forEach(day => {
          updatedDays[day] = {
            enabled: operatingHours.weekends.enabled,
            from: operatingHours.weekends.from,
            to: operatingHours.weekends.to
          };
        });
        
        cleanOperatingHours = {
          mode: operatingHours.mode,
          weekdays: operatingHours.weekdays,
          weekends: operatingHours.weekends,
          days: updatedDays
        };
      } else {
        cleanOperatingHours = {
          mode: operatingHours.mode,
          days: operatingHours.days
        };
      }
      
      await saveLocationHours({
        locationId: locationId!,
        operatingHours: JSON.stringify(cleanOperatingHours),
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

  if (fetchingRules || fetchingExceptions || fetchingLocation) {
    return (
      <Page title="Location">
        <Card>
          <Text as="p" variant="bodyMd">
            Loading location details...
          </Text>
        </Card>
      </Page>
    );
  }

  if (rulesError || exceptionsError || locationError) {
    return (
      <Page title="Location">
        <Card>
          <Banner>
            <Text as="p" variant="bodyMd">
              Error loading location: {(rulesError || exceptionsError || locationError)?.toString()}
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
            onClick={() => navigate("/locations")}
            accessibilityLabel="Go back to Locations"
          />
          <Text as="h1" variant="headingLg">
            Locations - {location?.name || "Location"}
          </Text>
        </InlineStack>
      }
      titleMetadata={<Text as="span" variant="bodyMd" tone="subdued">Configure operating hours and holidays</Text>}
      breadcrumbs={[
        {
          content: "Locations",
          url: "/locations",
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
              Days and Hours
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
        Learn more about <Link url="https://thesimplybookapp.com/docs/#locations">SimplyBook locations</Link>.
      </FooterHelp>
    </Page>
  );
}
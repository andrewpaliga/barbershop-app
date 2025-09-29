import React, { useMemo } from "react";
import { useFindMany } from "@gadgetinc/react";
import { api } from "../api";
import {
  Page,
  Card,
  Text,
  Button,
  Badge,
  Spinner,
  Banner,
  EmptyState,
  DataTable,
  FooterHelp,
} from "@shopify/polaris";
import { Link, useNavigate } from "@remix-run/react";

export default function HoursOfOperation() {
  const navigate = useNavigate();
  const [{ data: locations, fetching: locationsFetching, error: locationsError }] = useFindMany(api.shopifyLocation, {
    select: {
      id: true,
      name: true,
      address1: true,
      address2: true,
      city: true,
      active: true,
      timeZone: true,
    },
  });

  const [{ data: locationHours, fetching: hoursFetching, error: hoursError }] = useFindMany(api.locationHours, {
    select: {
      id: true,
      locationId: true,
      operatingHours: true,
      holidayClosures: true,
    },
  });

  // Create a map of locationId to hours for easy lookup
  const hoursMap = useMemo(() => {
    if (!locationHours) return new Map();
    const map = new Map();
    locationHours.forEach((hours) => {
      map.set(hours.locationId, hours);
    });
    return map;
  }, [locationHours]);

  // Helper function to get current time in a specific timezone
  const getCurrentTimeInTimezone = (timezone: string) => {
    const now = new Date();
    // Create a new date object in the target timezone
    const targetTime = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).formatToParts(now);
    
    const year = parseInt(targetTime.find(part => part.type === 'year')?.value || '0');
    const month = parseInt(targetTime.find(part => part.type === 'month')?.value || '0');
    const day = parseInt(targetTime.find(part => part.type === 'day')?.value || '0');
    const hour = parseInt(targetTime.find(part => part.type === 'hour')?.value || '0');
    const minute = parseInt(targetTime.find(part => part.type === 'minute')?.value || '0');
    
    const timeInTimezone = new Date(year, month - 1, day, hour, minute);
    
    return {
      date: timeInTimezone,
      dayOfWeek: timeInTimezone.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase(),
      timeString: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
    };
  };

  // Helper function to convert time string "HH:MM" to minutes since midnight
  const timeToMinutes = (timeString: string): number => {
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 60 + minutes;
  };

  // Helper function to parse time strings like "9am-5pm" into 24-hour format
  const parseTimeString = (timeStr: string) => {
    if (!timeStr || typeof timeStr !== 'string') return null;
    
    const parts = timeStr.split('-');
    if (parts.length !== 2) return null;
    
    const parseTime = (time: string) => {
      const match = time.trim().match(/^(\d{1,2})(:\d{2})?(am|pm)$/i);
      if (!match) return null;
      
      let hours = parseInt(match[1]);
      const minutes = match[2] ? parseInt(match[2].slice(1)) : 0;
      const ampm = match[3].toLowerCase();
      
      if (ampm === 'pm' && hours !== 12) hours += 12;
      if (ampm === 'am' && hours === 12) hours = 0;
      
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    };
    
    const from = parseTime(parts[0]);
    const to = parseTime(parts[1]);
    
    if (!from || !to) return null;
    
    return { enabled: true, from, to };
  };

  // Utility function to determine if location is currently open
  const isLocationOpen = (operatingHours: any, locationTimeZone: string, locationName: string): boolean => {
    if (!operatingHours || !locationTimeZone) {
      return false;
    }
    
    // Parse the operatingHours if it's a string
    let parsedOperatingHours;
    try {
      parsedOperatingHours = typeof operatingHours === 'string' ? JSON.parse(operatingHours) : operatingHours;
    } catch (e) {
      return false;
    }
    
    // Get current time in the location's timezone
    const { dayOfWeek, timeString } = getCurrentTimeInTimezone(locationTimeZone);
    
    let todayHours = null;
    
    // Handle different operating hours structures
    if (parsedOperatingHours.mode === 'weekdays_weekends') {
      const isWeekend = dayOfWeek === 'saturday' || dayOfWeek === 'sunday';
      if (isWeekend && parsedOperatingHours.weekends) {
        todayHours = parsedOperatingHours.weekends;
      } else if (!isWeekend && parsedOperatingHours.weekdays) {
        todayHours = parsedOperatingHours.weekdays;
      }
    } else if (parsedOperatingHours.mode === 'individual_days' && parsedOperatingHours.days) {
      todayHours = parsedOperatingHours.days[dayOfWeek];
    } else {
      // Fallback: try direct property access for the day of week
      todayHours = parsedOperatingHours[dayOfWeek];
      
      // If that doesn't work, try checking if the structure has days property without mode
      if (!todayHours && parsedOperatingHours.days) {
        todayHours = parsedOperatingHours.days[dayOfWeek];
      }
      
      // Additional fallback: check if the entire structure is just the day's hours
      if (!todayHours && parsedOperatingHours.enabled !== undefined) {
        todayHours = parsedOperatingHours;
      }
    }
    
    // After finding todayHours, convert string format to object format if needed
    if (typeof todayHours === 'string') {
      todayHours = parseTimeString(todayHours);
    }
    
    if (!todayHours || !todayHours.enabled || !todayHours.from || !todayHours.to) {
      return false;
    }
    
    const currentMinutes = timeToMinutes(timeString);
    const startMinutes = timeToMinutes(todayHours.from);
    const endMinutes = timeToMinutes(todayHours.to);
    
    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  };

  // Get today's hours for a location
  const getTodaysHours = (operatingHours: any, locationTimeZone: string): string => {
    if (!operatingHours || !locationTimeZone) return "No hours configured";
    
    // Parse the operatingHours if it's a string
    let parsedOperatingHours;
    try {
      parsedOperatingHours = typeof operatingHours === 'string' ? JSON.parse(operatingHours) : operatingHours;
    } catch (e) {
      return "No hours configured";
    }
    
    // Get current day in the location's timezone
    const { dayOfWeek } = getCurrentTimeInTimezone(locationTimeZone);
    
    let todayHours = null;
    
    // Handle different operating hours structures
    if (parsedOperatingHours.mode === 'weekdays_weekends') {
      const isWeekend = dayOfWeek === 'saturday' || dayOfWeek === 'sunday';
      if (isWeekend && parsedOperatingHours.weekends) {
        todayHours = parsedOperatingHours.weekends;
      } else if (!isWeekend && parsedOperatingHours.weekdays) {
        todayHours = parsedOperatingHours.weekdays;
      }
    } else if (parsedOperatingHours.mode === 'individual_days' && parsedOperatingHours.days) {
      todayHours = parsedOperatingHours.days[dayOfWeek];
    } else {
      // Fallback: try direct property access for the day of week
      todayHours = parsedOperatingHours[dayOfWeek];
      
      // If that doesn't work, try checking if the structure has days property without mode
      if (!todayHours && parsedOperatingHours.days) {
        todayHours = parsedOperatingHours.days[dayOfWeek];
      }
      
      // Additional fallback: check if the entire structure is just the day's hours
      if (!todayHours && parsedOperatingHours.enabled !== undefined) {
        todayHours = parsedOperatingHours;
      }
    }
    
    // After finding todayHours, convert string format to object format if needed
    if (typeof todayHours === 'string') {
      todayHours = parseTimeString(todayHours);
    }
    
    if (!todayHours || !todayHours.enabled || !todayHours.from || !todayHours.to) return "Closed";
    
    // Convert 24-hour to 12-hour format
    const formatTime = (time: string) => {
      const [hours, minutes] = time.split(':');
      const hour = parseInt(hours);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour % 12 || 12;
      return `${displayHour}:${minutes} ${ampm}`;
    };
    
    return `${formatTime(todayHours.from)} - ${formatTime(todayHours.to)}`;
  };

  // Prepare table rows
  const rows = useMemo(() => {
    if (!locations) return [];
    
    return locations.map((location) => {
      // Get the hours configuration for this location
      const locationHoursRecord = hoursMap.get(location.id);
      const operatingHours = locationHoursRecord?.operatingHours;
      const locationTimeZone = location.timeZone || 'UTC';
      
      const isOpen = isLocationOpen(operatingHours, locationTimeZone, location.name);
      const todaysHours = getTodaysHours(operatingHours, locationTimeZone);
      const address = [location.address1, location.address2, location.city]
        .filter(Boolean)
        .join(", ");

      return [
        <Link key={location.id} to={`/hours-of-operation/${location.id}`}>
          <Button variant="plain" textAlign="left">
            {location.name}
          </Button>
        </Link>,
        address || "No address",
        <Badge key={`status-${location.id}`} tone={isOpen ? "success" : "critical"}>
          {isOpen ? "Open" : "Closed"}
        </Badge>,
        todaysHours,
        <Button 
          key={`action-${location.id}`}
          variant="primary" 
          size="slim"
          onClick={() => navigate(`/hours-of-operation/${location.id}`)}
        >
          Configure Hours
        </Button>,
      ];
    });
  }, [locations, hoursMap, navigate]);

  const fetching = locationsFetching || hoursFetching;
  const error = locationsError || hoursError;

  if (fetching) {
    return (
      <Page title="Hours of Operation">
        <Card>
          <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
            <Spinner size="large" />
          </div>
        </Card>
      </Page>
    );
  }

  if (error) {
    return (
      <Page title="Hours of Operation">
        <Banner tone="critical">
          <Text as="p">Error loading data: {error.message}</Text>
        </Banner>
      </Page>
    );
  }

  if (!locations || locations.length === 0) {
    return (
      <Page title="Hours of Operation">
        <Card>
          <EmptyState
            heading="No locations found"
            image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
          >
            <Text as="p">
              You don't have any locations configured yet.
            </Text>
          </EmptyState>
        </Card>
      </Page>
    );
  }

  return (
    <Page title="Hours of Operation">
      <Card>
        <DataTable
          columnContentTypes={[
            'text',
            'text', 
            'text',
            'text',
            'text',
          ]}
          headings={[
            'Location Name',
            'Address',
            'Current Status',
            'Today\'s Hours',
            'Action',
          ]}
          rows={rows}
        />
      </Card>
      <FooterHelp>
        Learn more about <a href="https://shopifybookingapp.com/docs/#hours-of-operation">SimplyBook hours of operation</a>.
      </FooterHelp>
    </Page>
  );
}
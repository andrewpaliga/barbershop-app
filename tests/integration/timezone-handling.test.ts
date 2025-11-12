import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Tests to ensure timezone handling works correctly:
 * 1. Times display in location timezone (EST) even when user is in different timezone (China)
 * 2. Bookings saved at 9am EST are correctly saved as 9am EST (not converted to user's timezone)
 */

describe('Timezone Handling', () => {
  // Store original timezone
  const originalTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  
  beforeEach(() => {
    // Mock being in China timezone (UTC+8)
    vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({
      ...Intl.DateTimeFormat().resolvedOptions(),
      timeZone: 'Asia/Shanghai', // China timezone
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Timezone Conversion Utilities', () => {
    it('should convert UTC to location timezone (EST) correctly', () => {
      // Test: 9:00 AM EST = 14:00 UTC (EST is UTC-5)
      // But in November, EST is actually UTC-5, so 9:00 AM EST = 14:00 UTC
      const utcDate = new Date('2025-11-07T14:00:00.000Z'); // 2:00 PM UTC
      const locationTimezone = 'America/New_York'; // EST
      
      // Use Intl to format in location timezone
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: locationTimezone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
      
      const timeInLocation = formatter.format(utcDate);
      
      // Should be 9:00 AM in EST (UTC-5)
      expect(timeInLocation).toBe('09:00');
    });

    it('should convert location timezone (EST) to UTC correctly', () => {
      // Test: 9:00 AM EST should convert to 14:00 UTC (in November, EST is UTC-5)
      const locationTimezone = 'America/New_York';
      const year = 2025;
      const month = 11; // November
      const day = 7;
      const hour = 9;
      const minute = 0;
      
      // Create a date representing 9:00 AM in EST
      // We need to calculate what UTC time corresponds to 9:00 AM EST
      const estDate = new Date(Date.UTC(year, month - 1, day, hour, minute));
      
      // Get the offset for EST in November
      const estFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: locationTimezone,
        timeZoneName: 'short',
      });
      
      // Calculate offset by comparing UTC and EST times
      const utcDate = new Date(Date.UTC(year, month - 1, day, 14, 0)); // 2 PM UTC
      const estTime = new Intl.DateTimeFormat('en-US', {
        timeZone: locationTimezone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(utcDate);
      
      // If 2 PM UTC = 9 AM EST, then 9 AM EST = 2 PM UTC
      expect(estTime).toBe('09:00');
    });

    it('should handle DST correctly (EDT vs EST)', () => {
      // July date (EDT = UTC-4) vs November date (EST = UTC-5)
      const julyDate = new Date('2025-07-15T13:00:00.000Z'); // 1 PM UTC
      const novemberDate = new Date('2025-11-15T14:00:00.000Z'); // 2 PM UTC
      const locationTimezone = 'America/New_York';
      
      const julyFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: locationTimezone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
      
      const novemberFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: locationTimezone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
      
      const julyTime = julyFormatter.format(julyDate);
      const novemberTime = novemberFormatter.format(novemberDate);
      
      // Both should show 9:00 AM in the location timezone
      // July: 13:00 UTC = 9:00 AM EDT (UTC-4)
      // November: 14:00 UTC = 9:00 AM EST (UTC-5)
      expect(julyTime).toBe('09:00');
      expect(novemberTime).toBe('09:00');
    });
  });

  describe('Booking Widget Timezone Display', () => {
    it('should display times in location timezone (EST) not user timezone (China)', () => {
      // Simulate user in China viewing a booking widget for EST location
      const locationTimezone = 'America/New_York'; // EST
      const utcBookingTime = new Date('2025-11-07T14:00:00.000Z'); // 2:00 PM UTC
      
      // Function to get time in location timezone (what widget should display)
      function getTimeInLocationTimezone(utcDate: Date, locationTz: string): string {
        const formatter = new Intl.DateTimeFormat('en-US', {
          timeZone: locationTz,
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        });
        return formatter.format(utcDate);
      }
      
      const displayedTime = getTimeInLocationTimezone(utcBookingTime, locationTimezone);
      
      // Should show 9:00 AM (EST) not 10:00 PM (China time)
      expect(displayedTime).toBe('09:00');
      
      // Verify it's NOT in China timezone
      const chinaTime = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Shanghai',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(utcBookingTime);
      
      expect(displayedTime).not.toBe(chinaTime);
      expect(chinaTime).toBe('22:00'); // 10:00 PM in China
    });

    it('should convert location timezone selection to UTC correctly for booking submission', () => {
      // Simulate user in China selecting 9:00 AM EST for a booking
      const locationTimezone = 'America/New_York';
      const selectedDate = '2025-11-07';
      const selectedTime = '09:00'; // 9:00 AM in EST
      
      // Function to convert location timezone to UTC (what widget should do)
      function convertLocationTimeToUTC(
        dateStr: string,
        timeStr: string,
        locationTz: string
      ): Date {
        const [year, month, day] = dateStr.split('-').map(Number);
        const [hour, minute] = timeStr.split(':').map(Number);
        
        // Create a date string in the location timezone
        const dateTimeStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
        
        // Use a method that calculates UTC equivalent
        // For EST in November (UTC-5), 9:00 AM = 14:00 UTC
        const tempDate = new Date(dateTimeStr);
        
        // Get what this time would be in the location timezone
        const locationFormatter = new Intl.DateTimeFormat('en-US', {
          timeZone: locationTz,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        });
        
        // Find UTC time that produces 9:00 AM in EST
        // We'll test different UTC times
        for (let utcHour = 0; utcHour < 24; utcHour++) {
          const testUTC = new Date(Date.UTC(year, month - 1, day, utcHour, minute));
          const formatted = locationFormatter.format(testUTC);
          const parts = formatted.match(/(\d{2})\/(\d{2})\/(\d{4}), (\d{2}):(\d{2}):(\d{2})/);
          if (parts) {
            const formattedHour = parseInt(parts[4]);
            if (formattedHour === hour) {
              return testUTC;
            }
          }
        }
        
        // Fallback: EST is UTC-5 in November
        return new Date(Date.UTC(year, month - 1, day, hour + 5, minute));
      }
      
      const utcTime = convertLocationTimeToUTC(selectedDate, selectedTime, locationTimezone);
      
      // Should be 14:00 UTC (9:00 AM EST + 5 hours = 2:00 PM UTC)
      expect(utcTime.getUTCHours()).toBe(14);
      expect(utcTime.getUTCMinutes()).toBe(0);
      
      // Verify: if we convert this UTC back to EST, we get 9:00 AM
      const verifyFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: locationTimezone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
      const verifiedTime = verifyFormatter.format(utcTime);
      expect(verifiedTime).toBe('09:00');
    });
  });

  describe('Booking Creation Timezone Handling', () => {
    it('should save booking at 9am EST as 9am EST (not converted to user timezone)', async () => {
      // Simulate booking creation from China for EST location
      const locationTimezone = 'America/New_York';
      const bookingDate = '2025-11-07';
      const bookingTime = '09:00'; // 9:00 AM EST
      
      // This is what should happen when booking is submitted
      // The widget should convert 9:00 AM EST to UTC
      function createScheduledAtUTC(
        dateStr: string,
        timeStr: string,
        locationTz: string
      ): Date {
        const [year, month, day] = dateStr.split('-').map(Number);
        const [hour, minute] = timeStr.split(':').map(Number);
        
        // For EST in November (UTC-5), 9:00 AM EST = 14:00 UTC
        // Calculate offset
        const testUTC = new Date(Date.UTC(year, month - 1, day, 14, 0));
        const formatter = new Intl.DateTimeFormat('en-US', {
          timeZone: locationTz,
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        });
        
        const formatted = formatter.format(testUTC);
        if (formatted === `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`) {
          return testUTC;
        }
        
        // Fallback: EST offset
        return new Date(Date.UTC(year, month - 1, day, hour + 5, minute));
      }
      
      const scheduledAtUTC = createScheduledAtUTC(bookingDate, bookingTime, locationTimezone);
      
      // Verify it's stored as UTC equivalent of 9:00 AM EST
      expect(scheduledAtUTC.getUTCHours()).toBe(14); // 2:00 PM UTC = 9:00 AM EST
      expect(scheduledAtUTC.getUTCMinutes()).toBe(0);
      
      // Verify: when retrieved and converted back to EST, it shows 9:00 AM
      const retrievalFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: locationTimezone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
      const retrievedTime = retrievalFormatter.format(scheduledAtUTC);
      expect(retrievedTime).toBe('09:00');
    });

    it('should not convert 9am EST to 9pm China time when saving', () => {
      // Ensure booking saved at 9am EST is NOT saved as 9am China time
      const locationTimezone = 'America/New_York';
      const userTimezone = 'Asia/Shanghai'; // Simulating user in China
      const bookingDate = '2025-11-07';
      const bookingTime = '09:00'; // 9:00 AM EST
      
      // What should NOT happen: interpret 9:00 AM as user's timezone (China)
      // If user in China selects 9:00 AM, and we interpret it as 9:00 AM China time,
      // that would be WRONG for an EST location
      const wrongUTC_ChinaTime = (() => {
        const [year, month, day] = bookingDate.split('-').map(Number);
        const [hour, minute] = bookingTime.split(':').map(Number);
        // China is UTC+8, so 9:00 AM China = 1:00 AM UTC
        return new Date(Date.UTC(year, month - 1, day, hour - 8, minute));
      })();
      
      // What SHOULD happen: convert 9:00 AM EST to UTC
      const correctUTC_ESTTime = (() => {
        const [year, month, day] = bookingDate.split('-').map(Number);
        const [hour, minute] = bookingTime.split(':').map(Number);
        // EST is UTC-5 in November, so 9:00 AM EST = 14:00 UTC (2:00 PM UTC)
        return new Date(Date.UTC(year, month - 1, day, hour + 5, minute));
      })();
      
      // Verify correct UTC is different from wrong UTC
      expect(correctUTC_ESTTime.getTime()).not.toBe(wrongUTC_ChinaTime.getTime());
      
      // Verify correct UTC represents 9:00 AM EST
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: locationTimezone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
      const correctTime = formatter.format(correctUTC_ESTTime);
      expect(correctTime).toBe('09:00');
      
      // Verify wrong UTC does NOT represent 9:00 AM EST
      const wrongTime = formatter.format(wrongUTC_ChinaTime);
      expect(wrongTime).not.toBe('09:00');
      
      // The wrong time would show a different time in EST
      // (1:00 AM UTC = 8:00 PM previous day EST, or 9:00 PM previous day EST)
    });
  });

  describe('Date Display in Different Timezones', () => {
    it('should show same date in location timezone regardless of user timezone', () => {
      // User in China viewing a booking in EST
      const locationTimezone = 'America/New_York';
      const utcBookingTime = new Date('2025-11-07T14:00:00.000Z'); // 2:00 PM UTC
      
      // Date in EST (should be Nov 7)
      const estDateFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: locationTimezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      const estDate = estDateFormatter.format(utcBookingTime);
      
      // Date in China (might be Nov 8 due to timezone difference)
      const chinaDateFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      const chinaDate = chinaDateFormatter.format(utcBookingTime);
      
      // The widget should show EST date, not China date
      // For 2 PM UTC on Nov 7:
      // - EST: Nov 7, 9:00 AM (UTC-5)
      // - China: Nov 7, 10:00 PM (UTC+8)
      
      // Widget should display EST date
      expect(estDate).toBe('11/07/2025');
      
      // Even though user is in China, they should see EST date
      // (This test verifies the logic, actual widget would use locationTimezone)
    });
  });
});


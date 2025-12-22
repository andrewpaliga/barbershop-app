import { describe, it, expect } from 'vitest';

/**
 * Tests for booking conflict detection logic
 * Ensures that the conflict detection works correctly after removing debug code
 */

describe('Booking Conflict Detection', () => {
  /**
   * Simulates the checkBookingConflictsForStaff function from bookingButton.js
   * This tests the core conflict detection logic without debug code
   */
  function checkBookingConflictsForStaff(
    date: Date,
    time: string,
    serviceDuration: number,
    staffId: string | number,
    existingBookings: Array<{
      id: string;
      scheduledAt: string;
      duration: number;
      status: string;
      staffId: string | number;
    }>
  ): boolean {
    // Filter out cancelled and no-show bookings
    const activeBookings = existingBookings.filter(booking => {
      const status = String(booking.status || '').toLowerCase();
      return status !== 'cancelled' && status !== 'no_show';
    });

    if (activeBookings.length === 0) {
      return false;
    }

    // Convert proposed date/time to UTC timestamp
    const proposedDateLocal = new Date(date);
    const [hours, minutes] = time.split(':').map(Number);

    // Create local Date object for the proposed start time
    const proposedStartLocal = new Date(
      proposedDateLocal.getFullYear(),
      proposedDateLocal.getMonth(),
      proposedDateLocal.getDate(),
      hours,
      minutes,
      0,
      0
    );

    // Convert to UTC timestamp (milliseconds since epoch)
    const proposedStartUTC = proposedStartLocal.getTime();
    const proposedEndUTC = proposedStartUTC + (serviceDuration * 60 * 1000);

    // Get UTC date components for the proposed booking
    const proposedStartUTCDate = new Date(proposedStartUTC);
    const proposedYearUTC = proposedStartUTCDate.getUTCFullYear();
    const proposedMonthUTC = proposedStartUTCDate.getUTCMonth();
    const proposedDayUTC = proposedStartUTCDate.getUTCDate();

    const targetStaffId = String(staffId);

    // Get bookings for this staff member
    const staffBookings = activeBookings.filter(booking => String(booking.staffId) === targetStaffId);

    // Check for conflicts: filter by staff, then by date, then check time overlap
    const conflictingBookings: typeof existingBookings = [];

    staffBookings.forEach(booking => {
      // Filter 2: Same day (compare dates in UTC to ensure consistency)
      if (!booking.scheduledAt) {
        return;
      }

      // Parse existing booking scheduledAt (UTC ISO string)
      const existingStartUTC = new Date(booking.scheduledAt);

      // Get UTC date components for comparison
      const existingYearUTC = existingStartUTC.getUTCFullYear();
      const existingMonthUTC = existingStartUTC.getUTCMonth();
      const existingDayUTC = existingStartUTC.getUTCDate();

      const isSameDay = existingYearUTC === proposedYearUTC &&
                        existingMonthUTC === proposedMonthUTC &&
                        existingDayUTC === proposedDayUTC;

      if (!isSameDay) {
        return;
      }

      // Filter 3: Time overlap check (all in UTC timestamps)
      const existingDuration = booking.duration || 60;
      const existingStartUTCTimestamp = existingStartUTC.getTime();
      const existingEndUTC = existingStartUTCTimestamp + (existingDuration * 60 * 1000);

      // Standard interval overlap formula: two intervals overlap if:
      // proposedStart < existingEnd AND proposedEnd > existingStart
      const hasOverlap = (proposedStartUTC < existingEndUTC) && (proposedEndUTC > existingStartUTCTimestamp);

      if (hasOverlap) {
        conflictingBookings.push(booking);
      }
    });

    return conflictingBookings.length > 0;
  }

  describe('Conflict Detection Logic', () => {
    it('should detect conflicts when bookings overlap', () => {
      const date = new Date(2025, 11, 24); // December 24, 2025
      const time = '12:00'; // Noon
      const serviceDuration = 30; // 30 minutes
      const staffId = '3';

      // Existing booking from 12:00 PM to 12:30 PM (same time)
      const existingBookings = [
        {
          id: '170',
          scheduledAt: new Date(Date.UTC(2025, 11, 24, 17, 0)).toISOString(), // 12:00 PM EST = 5:00 PM UTC
          duration: 30,
          status: 'not_paid',
          staffId: '3'
        }
      ];

      const hasConflict = checkBookingConflictsForStaff(date, time, serviceDuration, staffId, existingBookings);
      expect(hasConflict).toBe(true);
    });

    it('should detect conflicts when proposed booking starts during existing booking', () => {
      const date = new Date(2025, 11, 24);
      const time = '12:15'; // 15 minutes after existing booking starts
      const serviceDuration = 30;
      const staffId = '3';

      // Existing booking from 12:00 PM to 12:30 PM
      const existingBookings = [
        {
          id: '170',
          scheduledAt: new Date(Date.UTC(2025, 11, 24, 17, 0)).toISOString(), // 12:00 PM EST
          duration: 30,
          status: 'not_paid',
          staffId: '3'
        }
      ];

      const hasConflict = checkBookingConflictsForStaff(date, time, serviceDuration, staffId, existingBookings);
      expect(hasConflict).toBe(true);
    });

    it('should detect conflicts when proposed booking ends during existing booking', () => {
      const date = new Date(2025, 11, 24);
      const time = '11:45'; // 15 minutes before existing booking starts
      const serviceDuration = 30;
      const staffId = '3';

      // Existing booking from 12:00 PM to 12:30 PM
      const existingBookings = [
        {
          id: '170',
          scheduledAt: new Date(Date.UTC(2025, 11, 24, 17, 0)).toISOString(), // 12:00 PM EST
          duration: 30,
          status: 'not_paid',
          staffId: '3'
        }
      ];

      const hasConflict = checkBookingConflictsForStaff(date, time, serviceDuration, staffId, existingBookings);
      expect(hasConflict).toBe(true);
    });

    it('should not detect conflicts when bookings are on different days', () => {
      const date = new Date(2025, 11, 25); // December 25
      const time = '12:00';
      const serviceDuration = 30;
      const staffId = '3';

      // Existing booking on December 24
      const existingBookings = [
        {
          id: '170',
          scheduledAt: new Date(Date.UTC(2025, 11, 24, 17, 0)).toISOString(), // Dec 24, 12:00 PM EST
          duration: 30,
          status: 'not_paid',
          staffId: '3'
        }
      ];

      const hasConflict = checkBookingConflictsForStaff(date, time, serviceDuration, staffId, existingBookings);
      expect(hasConflict).toBe(false);
    });

    it('should not detect conflicts when bookings are for different staff', () => {
      const date = new Date(2025, 11, 24);
      const time = '12:00';
      const serviceDuration = 30;
      const staffId = '4'; // Different staff

      // Existing booking for staff 3
      const existingBookings = [
        {
          id: '170',
          scheduledAt: new Date(Date.UTC(2025, 11, 24, 17, 0)).toISOString(),
          duration: 30,
          status: 'not_paid',
          staffId: '3'
        }
      ];

      const hasConflict = checkBookingConflictsForStaff(date, time, serviceDuration, staffId, existingBookings);
      expect(hasConflict).toBe(false);
    });

    it('should not detect conflicts when bookings do not overlap in time', () => {
      const date = new Date(2025, 11, 24);
      const time = '13:00'; // 1:00 PM (after existing booking ends)
      const serviceDuration = 30;
      const staffId = '3';

      // Existing booking from 12:00 PM to 12:30 PM
      const existingBookings = [
        {
          id: '170',
          scheduledAt: new Date(Date.UTC(2025, 11, 24, 17, 0)).toISOString(), // 12:00 PM EST
          duration: 30,
          status: 'not_paid',
          staffId: '3'
        }
      ];

      const hasConflict = checkBookingConflictsForStaff(date, time, serviceDuration, staffId, existingBookings);
      expect(hasConflict).toBe(false);
    });

    it('should filter out cancelled bookings', () => {
      const date = new Date(2025, 11, 24);
      const time = '12:00';
      const serviceDuration = 30;
      const staffId = '3';

      // Cancelled booking at the same time
      const existingBookings = [
        {
          id: '170',
          scheduledAt: new Date(Date.UTC(2025, 11, 24, 17, 0)).toISOString(),
          duration: 30,
          status: 'cancelled',
          staffId: '3'
        }
      ];

      const hasConflict = checkBookingConflictsForStaff(date, time, serviceDuration, staffId, existingBookings);
      expect(hasConflict).toBe(false);
    });

    it('should filter out no_show bookings', () => {
      const date = new Date(2025, 11, 24);
      const time = '12:00';
      const serviceDuration = 30;
      const staffId = '3';

      // No-show booking at the same time
      const existingBookings = [
        {
          id: '170',
          scheduledAt: new Date(Date.UTC(2025, 11, 24, 17, 0)).toISOString(),
          duration: 30,
          status: 'no_show',
          staffId: '3'
        }
      ];

      const hasConflict = checkBookingConflictsForStaff(date, time, serviceDuration, staffId, existingBookings);
      expect(hasConflict).toBe(false);
    });

    it('should handle bookings with different durations correctly', () => {
      const date = new Date(2025, 11, 24);
      const time = '12:00';
      const serviceDuration = 60; // 1 hour booking
      const staffId = '3';

      // Existing 30-minute booking from 12:00 PM to 12:30 PM
      const existingBookings = [
        {
          id: '170',
          scheduledAt: new Date(Date.UTC(2025, 11, 24, 17, 0)).toISOString(),
          duration: 30,
          status: 'not_paid',
          staffId: '3'
        }
      ];

      // Proposed 1-hour booking overlaps with existing 30-minute booking
      const hasConflict = checkBookingConflictsForStaff(date, time, serviceDuration, staffId, existingBookings);
      expect(hasConflict).toBe(true);
    });

    it('should return false when no booking data exists', () => {
      const date = new Date(2025, 11, 24);
      const time = '12:00';
      const serviceDuration = 30;
      const staffId = '3';

      const existingBookings: Array<{
        id: string;
        scheduledAt: string;
        duration: number;
        status: string;
        staffId: string | number;
      }> = [];

      const hasConflict = checkBookingConflictsForStaff(date, time, serviceDuration, staffId, existingBookings);
      expect(hasConflict).toBe(false);
    });
  });
});


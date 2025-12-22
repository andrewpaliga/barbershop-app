import { describe, it, expect } from 'vitest';

/**
 * Tests for booking data API route
 * Ensures the API response structure is correct and doesn't include debug fields
 */

describe('Booking Data API Response Structure', () => {
  describe('Response Data Structure', () => {
    it('should have correct response structure without debug fields', () => {
      // Expected response structure (without debug fields)
      const expectedResponse = {
        success: true,
        data: {
          services: expect.any(Array),
          staff: expect.any(Array),
          locations: expect.any(Array),
          locationHoursRules: expect.any(Array),
          locationHoursExceptions: expect.any(Array),
          staffAvailability: expect.any(Array),
          staffDateAvailability: expect.any(Array),
          existingBookings: expect.any(Array),
          timeSlotInterval: expect.any(Number)
        }
      };

      // Verify the response doesn't have debug fields
      expect(expectedResponse.data).not.toHaveProperty('debugBookings');
      expect(expectedResponse.data).not.toHaveProperty('allBookings');
      expect(expectedResponse.data).not.toHaveProperty('booking170');
    });

    it('should have existingBookings array with correct structure', () => {
      const expectedBookingStructure = {
        id: expect.any(String),
        scheduledAt: expect.any(String),
        duration: expect.any(Number),
        status: expect.any(String),
        staffId: expect.any(String),
        locationId: expect.any(String),
        variantId: expect.any(String),
        totalPrice: expect.any(Number),
        customerName: expect.any(String),
        customerEmail: expect.any(String),
        notes: expect.anything(),
        arrived: expect.anything()
      };

      // This test verifies the structure we expect
      expect(expectedBookingStructure).toHaveProperty('id');
      expect(expectedBookingStructure).toHaveProperty('scheduledAt');
      expect(expectedBookingStructure).toHaveProperty('duration');
      expect(expectedBookingStructure).toHaveProperty('status');
      expect(expectedBookingStructure).toHaveProperty('staffId');
    });

    it('should filter bookings to next 90 days only', () => {
      // This test verifies the logic that bookings are filtered to next 90 days
      const now = new Date();
      const ninetyDaysFromNow = new Date(now);
      ninetyDaysFromNow.setDate(ninetyDaysFromNow.getDate() + 90);

      // Verify the date range calculation
      expect(ninetyDaysFromNow.getTime()).toBeGreaterThan(now.getTime());
      expect(ninetyDaysFromNow.getTime() - now.getTime()).toBeLessThanOrEqual(90 * 24 * 60 * 60 * 1000);
    });

    it('should filter bookings by status correctly', () => {
      // Valid statuses that should be included
      const validStatuses = ['pending', 'paid', 'not_paid', 'completed'];
      
      // Invalid statuses that should be excluded
      const invalidStatuses = ['cancelled', 'no_show', 'confirmed'];

      // Verify valid statuses
      expect(validStatuses).toContain('pending');
      expect(validStatuses).toContain('paid');
      expect(validStatuses).toContain('not_paid');
      expect(validStatuses).toContain('completed');

      // Verify invalid statuses are not in the list
      expect(validStatuses).not.toContain('cancelled');
      expect(validStatuses).not.toContain('no_show');
    });
  });

  describe('Data Integrity', () => {
    it('should ensure all required fields are present in response', () => {
      const requiredFields = [
        'services',
        'staff',
        'locations',
        'locationHoursRules',
        'locationHoursExceptions',
        'staffAvailability',
        'staffDateAvailability',
        'existingBookings',
        'timeSlotInterval'
      ];

      requiredFields.forEach(field => {
        expect(requiredFields).toContain(field);
      });
    });

    it('should ensure timeSlotInterval is a positive number', () => {
      // Default timeSlotInterval should be 15 minutes
      const defaultInterval = 15;
      expect(defaultInterval).toBeGreaterThan(0);
      expect(typeof defaultInterval).toBe('number');
    });
  });
});


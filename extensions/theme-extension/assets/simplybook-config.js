// SimplyBook App Configuration
// This file provides configuration for the booking widget to work with Shopify app proxy

window.SimplyBookConfig = {
  // App proxy configuration
  proxy: {
    prefix: 'apps',
    subpath: 'simplybook-api'
  },
  
  // API endpoints configuration
  apiEndpoints: {
    bookingData: '/api/booking-data',
    services: '/api/services',
    staff: '/api/staff',
    locations: '/api/locations',
    submitBooking: '/api/submit-booking'
  },
  
  // Widget configuration
  widget: {
    defaultTimeSlotInterval: 30,
    defaultBookingAdvanceLimit: 30
  }
};

// Backward compatibility alias
window.AppConfig = window.SimplyBookConfig;

// Configuration loaded message
console.log('SimplyBook Configuration loaded:', window.SimplyBookConfig);
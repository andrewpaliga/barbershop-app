import { RouteHandler } from "gadget-server";

const route: RouteHandler = async ({ request, reply, api, connections }) => {
  try {
    // Get shop ID from query parameters
    const shopId = request.query.shopId || connections.shopify?.currentShopId;
    
    if (!shopId) {
      reply.code(400);
      return reply.send('// Error: Shop ID is required');
    }

    // Set headers for JavaScript content
    reply.header('Content-Type', 'application/javascript');
    reply.header('Cache-Control', 'public, max-age=300');
    reply.header('Access-Control-Allow-Origin', '*');
    reply.header('Access-Control-Allow-Methods', 'GET');

    // Get shop configuration
    const config = await api.config.findFirst({
      filter: { shopId: { equals: shopId } }
    });

    // Get the first active location to determine timezone
    const location = await api.shopifyLocation.findFirst({
      filter: { 
        shopId: { equals: shopId },
        active: { equals: true }
      },
      select: {
        id: true,
        timeZone: true,
        name: true
      }
    });

    const locationTimezone = location?.timeZone || 'America/New_York'; // Default to EST if no location found
    const locationId = location?.id;

    const widgetScript = `
(function() {
  'use strict';

  // Configuration
  const SHOP_ID = '${shopId}';
  const LOCATION_ID = '${locationId || ''}';
  const LOCATION_TIMEZONE = '${locationTimezone}';
  const API_BASE = '${process.env.NODE_ENV === 'production' ? 'https://' + request.hostname : 'https://' + request.hostname}';
  const ALLOW_ONLINE_BOOKING = ${config?.allowOnlineBooking || true};
  const BUSINESS_NAME = '${config?.businessName || 'Our Barbershop'}';

  // Styles
  const styles = \`
    .booking-widget-button {
      background: #007cba;
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 6px;
      cursor: pointer;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 16px;
      font-weight: 600;
      transition: background-color 0.2s;
    }
    .booking-widget-button:hover {
      background: #005a87;
    }
    .booking-widget-button:disabled {
      background: #ccc;
      cursor: not-allowed;
    }
    .booking-modal {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      display: none;
      z-index: 10000;
      align-items: center;
      justify-content: center;
    }
    .booking-modal.show {
      display: flex;
    }
    .booking-modal-content {
      background: white;
      border-radius: 8px;
      padding: 24px;
      max-width: 500px;
      width: 90%;
      max-height: 90vh;
      overflow-y: auto;
      position: relative;
    }
    .booking-modal h2 {
      margin: 0 0 20px 0;
      color: #333;
      font-size: 24px;
    }
    .booking-form-group {
      margin-bottom: 16px;
    }
    .booking-form-label {
      display: block;
      margin-bottom: 4px;
      font-weight: 600;
      color: #333;
    }
    .booking-form-input, .booking-form-select {
      width: 100%;
      padding: 8px 12px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 16px;
      box-sizing: border-box;
    }
    .booking-form-input:focus, .booking-form-select:focus {
      outline: none;
      border-color: #007cba;
    }
    .booking-calendar {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 4px;
      margin: 16px 0;
    }
    .booking-calendar-header {
      text-align: center;
      font-weight: 600;
      padding: 8px;
      color: #666;
    }
    .booking-calendar-day {
      aspect-ratio: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1px solid #eee;
      cursor: pointer;
      border-radius: 4px;
      transition: all 0.2s;
    }
    .booking-calendar-day:hover:not(.disabled) {
      background: #f0f8ff;
      border-color: #007cba;
    }
    .booking-calendar-day.selected {
      background: #007cba;
      color: white;
      border-color: #007cba;
    }
    .booking-calendar-day.disabled {
      color: #ccc;
      cursor: not-allowed;
    }
    .booking-time-slots {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      margin: 16px 0;
    }
    .booking-time-slot {
      padding: 8px;
      border: 1px solid #ddd;
      border-radius: 4px;
      cursor: pointer;
      text-align: center;
      transition: all 0.2s;
    }
    .booking-time-slot:hover:not(.disabled) {
      background: #f0f8ff;
      border-color: #007cba;
    }
    .booking-time-slot.selected {
      background: #007cba;
      color: white;
      border-color: #007cba;
    }
    .booking-time-slot.disabled {
      background: #f5f5f5;
      color: #ccc;
      cursor: not-allowed;
    }
    .booking-form-actions {
      display: flex;
      gap: 12px;
      margin-top: 24px;
    }
    .booking-btn {
      padding: 10px 20px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 16px;
      font-weight: 600;
    }
    .booking-btn-primary {
      background: #007cba;
      color: white;
    }
    .booking-btn-primary:hover:not(:disabled) {
      background: #005a87;
    }
    .booking-btn-secondary {
      background: #f5f5f5;
      color: #333;
    }
    .booking-btn-secondary:hover {
      background: #e0e0e0;
    }
    .booking-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .booking-close {
      position: absolute;
      top: 16px;
      right: 16px;
      background: none;
      border: none;
      font-size: 24px;
      cursor: pointer;
      color: #666;
    }
    .booking-loading {
      text-align: center;
      color: #666;
      margin: 20px 0;
    }
    .booking-error {
      background: #fee;
      color: #c00;
      padding: 12px;
      border-radius: 4px;
      margin: 16px 0;
    }
    .booking-success {
      background: #efe;
      color: #060;
      padding: 12px;
      border-radius: 4px;
      margin: 16px 0;
    }
  \`;

  // Timezone utility functions
  function convertUTCToLocationTime(utcDateString) {
    if (!LOCATION_TIMEZONE || !utcDateString) return null;
    const utcDate = new Date(utcDateString);
    // Format the UTC date in the location's timezone
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: LOCATION_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    
    const parts = formatter.formatToParts(utcDate);
    const year = parseInt(parts.find(p => p.type === 'year')?.value || '0');
    const month = parseInt(parts.find(p => p.type === 'month')?.value || '1') - 1;
    const day = parseInt(parts.find(p => p.type === 'day')?.value || '1');
    const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
    const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0');
    
    return { year, month, day, hour, minute };
  }

  function convertLocationTimeToUTC(year, month, day, hour, minute) {
    if (!LOCATION_TIMEZONE) {
      // Fallback: create date in UTC
      return new Date(Date.UTC(year, month, day, hour, minute));
    }
    
    // Create a date string that represents the time in the location timezone
    // We'll use a method that calculates the timezone offset for this specific date/time
    const dateStr = \`\${year}-\${String(month + 1).padStart(2, '0')}-\${String(day).padStart(2, '0')}T\${String(hour).padStart(2, '0')}:\${String(minute).padStart(2, '0')}:00\`;
    
    // Create a date object - we'll treat this as if it's in UTC temporarily
    // Then calculate what the actual UTC time should be
    const tempDate = new Date(dateStr + 'Z'); // This is wrong, but we'll fix it
    
    // Get what this date/time would be when displayed in the location timezone
    const locationFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: LOCATION_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    
    // Find a UTC time that, when displayed in location timezone, gives us our target time
    // We'll use binary search or a more direct approach
    // Actually, a simpler approach: iterate through possible UTC times
    // Or use the fact that we know the date/time we want in the location
    
    // Better approach: Use the fact that we can format a date and see what UTC time produces it
    // Start with a reasonable UTC guess
    const yearMonthDay = \`\${year}-\${String(month + 1).padStart(2, '0')}-\${String(day).padStart(2, '0')}\`;
    const timeStr = \`\${String(hour).padStart(2, '0')}:\${String(minute).padStart(2, '0')}:\${String(0).padStart(2, '0')}\`;
    
    // Try different UTC times until we find one that formats to our target in location timezone
    // Start with the assumption that it's roughly the same, then adjust
    const baseUTC = new Date(Date.UTC(year, month, day, hour, minute));
    
    // Check what this formats to in location timezone
    let formatted = locationFormatter.format(baseUTC);
    let formattedParts = formatted.match(/(\d{2})\/(\d{2})\/(\d{4}), (\d{2}):(\d{2}):(\d{2})/);
    
    if (!formattedParts) {
      // Fallback
      return baseUTC;
    }
    
    let formattedMonth = parseInt(formattedParts[1]);
    let formattedDay = parseInt(formattedParts[2]);
    let formattedYear = parseInt(formattedParts[3]);
    let formattedHour = parseInt(formattedParts[4]);
    let formattedMinute = parseInt(formattedParts[5]);
    
    // Calculate the difference
    const targetMonth = month + 1;
    const targetDay = day;
    const targetYear = year;
    const targetHour = hour;
    const targetMinute = minute;
    
    // Calculate how many hours/minutes to adjust
    const hourDiff = targetHour - formattedHour;
    const minuteDiff = targetMinute - formattedMinute;
    const dayDiff = targetDay - formattedDay;
    
    // Adjust the UTC time
    const adjustment = (dayDiff * 24 * 60 + hourDiff * 60 + minuteDiff) * 60 * 1000;
    const adjustedUTC = new Date(baseUTC.getTime() + adjustment);
    
    // Verify it's correct by checking one more time
    formatted = locationFormatter.format(adjustedUTC);
    formattedParts = formatted.match(/(\d{2})\/(\d{2})\/(\d{4}), (\d{2}):(\d{2}):(\d{2})/);
    
    if (formattedParts) {
      const checkMonth = parseInt(formattedParts[1]);
      const checkDay = parseInt(formattedParts[2]);
      const checkYear = parseInt(formattedParts[3]);
      const checkHour = parseInt(formattedParts[4]);
      const checkMinute = parseInt(formattedParts[5]);
      
      if (checkYear === targetYear && checkMonth === targetMonth && 
          checkDay === targetDay && checkHour === targetHour && checkMinute === targetMinute) {
        return adjustedUTC;
      }
    }
    
    // If verification failed, return the adjusted time anyway (close enough)
    return adjustedUTC;
  }

  function formatDateInLocationTimezone(date) {
    if (!LOCATION_TIMEZONE) {
      return date.toISOString().split('T')[0];
    }
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: LOCATION_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    return formatter.format(date);
  }

  function getTimeInLocationTimezone(utcDateString) {
    if (!LOCATION_TIMEZONE || !utcDateString) return null;
    const utcDate = new Date(utcDateString);
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: LOCATION_TIMEZONE,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    return formatter.format(utcDate);
  }

  // Utility functions
  function formatDate(date) {
    // Use location timezone for date formatting
    return formatDateInLocationTimezone(date);
  }

  function formatTime(time) {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return \`\${displayHour}:\${minutes} \${ampm}\`;
  }

  function generateTimeSlots(startTime, endTime, duration, buffer) {
    const slots = [];
    const start = new Date(\`1970-01-01T\${startTime}:00\`);
    const end = new Date(\`1970-01-01T\${endTime}:00\`);
    const slotDuration = (duration + buffer) * 60 * 1000;
    
    let current = start;
    while (current < end) {
      const timeStr = current.toTimeString().substring(0, 5);
      slots.push(timeStr);
      current = new Date(current.getTime() + slotDuration);
    }
    
    return slots;
  }

  // API functions
  async function apiRequest(endpoint, options = {}) {
    const url = \`\${API_BASE}/api/graphql\`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      body: JSON.stringify(options.body)
    });
    
    if (!response.ok) {
      throw new Error(\`API request failed: \${response.statusText}\`);
    }
    
    return response.json();
  }

  async function loadServices() {
    const query = \`
      query {
        shopifyProducts(filter: { 
          shopId: { equals: "\${SHOP_ID}" },
          productType: { in: ["Service", "service", "SERVICE"] }
        }) {
          edges {
            node {
              id
              title
              body
            }
          }
        }
      }
    \`;
    
    const response = await apiRequest('', { body: { query } });
    return response.data?.shopifyProducts?.edges?.map(edge => edge.node) || [];
  }

  async function loadStaff() {
    const query = \`
      query {
        staff(filter: { 
          shopId: { equals: "\${SHOP_ID}" },
          isActive: { equals: true }
        }) {
          edges {
            node {
              id
              name
              title
            }
          }
        }
      }
    \`;
    
    const response = await apiRequest('', { body: { query } });
    return response.data?.staff?.edges?.map(edge => edge.node) || [];
  }

  async function loadStaffAvailability(staffId, date) {
    const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][new Date(date).getDay()];
    
    const query = \`
      query {
        staffAvailabilities(filter: { 
          staffId: { equals: "\${staffId}" },
          shopId: { equals: "\${SHOP_ID}" },
          dayOfWeek: { equals: "\${dayOfWeek}" }
        }) {
          edges {
            node {
              startTime
              endTime
              isAvailable
            }
          }
        }
      }
    \`;
    
    const response = await apiRequest('', { body: { query } });
    return response.data?.staffAvailabilities?.edges?.map(edge => edge.node) || [];
  }

  async function loadBookings(date) {
    // Convert the selected date (in location timezone) to UTC range for querying
    // We need to find the UTC range that covers the entire day in the location timezone
    if (LOCATION_TIMEZONE) {
      // Get start of day in location timezone, convert to UTC
      const startOfDay = convertLocationTimeToUTC(
        parseInt(date.split('-')[0]),
        parseInt(date.split('-')[1]) - 1,
        parseInt(date.split('-')[2]),
        0, 0
      );
      
      // Get end of day in location timezone, convert to UTC
      const endOfDay = convertLocationTimeToUTC(
        parseInt(date.split('-')[0]),
        parseInt(date.split('-')[1]) - 1,
        parseInt(date.split('-')[2]),
        23, 59
      );
      
      const startISO = startOfDay.toISOString();
      const endISO = endOfDay.toISOString();
      
      const query = \`
        query {
          bookings(filter: { 
            shopId: { equals: "\${SHOP_ID}" },
            scheduledAt: { 
              greaterThanOrEqual: "\${startISO}",
              lessThanOrEqual: "\${endISO}"
            }
          }) {
            edges {
              node {
                id
                scheduledAt
                duration
                staffId
                status
              }
            }
          }
        }
      \`;
      
      const response = await apiRequest('', { body: { query } });
      return response.data?.bookings?.edges?.map(edge => edge.node) || [];
    } else {
      // Fallback to old method if no timezone
      const query = \`
        query {
          bookings(filter: { 
            shopId: { equals: "\${SHOP_ID}" },
            scheduledAt: { 
              greaterThanOrEqual: "\${date}T00:00:00.000Z",
              lessThan: "\${date}T23:59:59.999Z"
            }
          }) {
            edges {
              node {
                id
                scheduledAt
                duration
                staffId
                status
              }
            }
          }
        }
      \`;
      
      const response = await apiRequest('', { body: { query } });
      return response.data?.bookings?.edges?.map(edge => edge.node) || [];
    }
  }

  async function createBooking(bookingData) {
    const mutation = \`
      mutation CreateBooking($booking: BookingInput!) {
        createBooking(booking: $booking) {
          success
          booking {
            id
            status
          }
          errors {
            message
          }
        }
      }
    \`;
    
    const response = await apiRequest('', { 
      body: { 
        query: mutation, 
        variables: { booking: bookingData }
      }
    });
    
    return response.data?.createBooking;
  }

  // Widget class
  class BookingWidget {
    constructor(container) {
      this.container = container;
      this.services = [];
      this.staff = [];
      this.selectedDate = null;
      this.selectedTime = null;
      this.selectedService = null;
      this.selectedStaff = null;
      this.availableSlots = [];
      this.bookings = [];
      
      this.init();
    }

    async init() {
      this.injectStyles();
      this.createButton();
      this.createModal();
      
      try {
        await this.loadData();
      } catch (error) {
        console.error('Failed to load booking data:', error);
      }
    }

    injectStyles() {
      const styleElement = document.createElement('style');
      styleElement.textContent = styles;
      document.head.appendChild(styleElement);
    }

    createButton() {
      const button = document.createElement('button');
      button.className = 'booking-widget-button';
      button.textContent = 'Book Appointment';
      button.disabled = !ALLOW_ONLINE_BOOKING;
      
      if (!ALLOW_ONLINE_BOOKING) {
        button.textContent = 'Online Booking Unavailable';
      }
      
      button.addEventListener('click', () => {
        if (ALLOW_ONLINE_BOOKING) {
          this.openModal();
        }
      });
      
      this.container.appendChild(button);
      this.button = button;
    }

    createModal() {
      const modal = document.createElement('div');
      modal.className = 'booking-modal';
      modal.innerHTML = \`
        <div class="booking-modal-content">
          <button class="booking-close">&times;</button>
          <h2>Book Your Appointment</h2>
          <div class="booking-error" style="display: none;"></div>
          <div class="booking-success" style="display: none;"></div>
          <div class="booking-form">
            <div class="booking-form-group">
              <label class="booking-form-label">Service</label>
              <select class="booking-form-select" id="booking-service">
                <option value="">Select a service...</option>
              </select>
            </div>
            <div class="booking-form-group">
              <label class="booking-form-label">Staff Member</label>
              <select class="booking-form-select" id="booking-staff">
                <option value="">Select staff member...</option>
              </select>
            </div>
            <div class="booking-form-group">
              <label class="booking-form-label">Date</label>
              <div id="booking-calendar"></div>
            </div>
            <div class="booking-form-group">
              <label class="booking-form-label">Time</label>
              <div id="booking-time-slots" class="booking-time-slots">
                <div class="booking-loading">Select a date first</div>
              </div>
            </div>
            <div class="booking-form-group">
              <label class="booking-form-label">Your Name</label>
              <input type="text" class="booking-form-input" id="booking-name" required>
            </div>
            <div class="booking-form-group">
              <label class="booking-form-label">Email</label>
              <input type="email" class="booking-form-input" id="booking-email" required>
            </div>
            <div class="booking-form-group">
              <label class="booking-form-label">Notes (Optional)</label>
              <textarea class="booking-form-input" id="booking-notes" rows="3"></textarea>
            </div>
            <div class="booking-form-actions">
              <button type="button" class="booking-btn booking-btn-secondary" id="booking-cancel">Cancel</button>
              <button type="button" class="booking-btn booking-btn-primary" id="booking-submit">Book Appointment</button>
            </div>
          </div>
        </div>
      \`;
      
      document.body.appendChild(modal);
      this.modal = modal;
      
      this.setupEventListeners();
    }

    setupEventListeners() {
      // Close modal
      this.modal.querySelector('.booking-close').addEventListener('click', () => this.closeModal());
      this.modal.querySelector('#booking-cancel').addEventListener('click', () => this.closeModal());
      
      // Form interactions
      this.modal.querySelector('#booking-service').addEventListener('change', (e) => {
        this.selectedService = e.target.value;
        this.updateAvailability();
      });
      
      this.modal.querySelector('#booking-staff').addEventListener('change', (e) => {
        this.selectedStaff = e.target.value;
        this.updateAvailability();
      });
      
      // Submit booking
      this.modal.querySelector('#booking-submit').addEventListener('click', () => this.submitBooking());
      
      // Click outside to close
      this.modal.addEventListener('click', (e) => {
        if (e.target === this.modal) {
          this.closeModal();
        }
      });
    }

    async loadData() {
      try {
        this.services = await loadServices();
        this.staff = await loadStaff();
        this.populateSelects();
        this.createCalendar();
      } catch (error) {
        this.showError('Failed to load appointment data. Please try again later.');
      }
    }

    populateSelects() {
      const serviceSelect = this.modal.querySelector('#booking-service');
      const staffSelect = this.modal.querySelector('#booking-staff');
      
      // Populate services
      serviceSelect.innerHTML = '<option value="">Select a service...</option>';
      this.services.forEach(service => {
        const option = document.createElement('option');
        option.value = service.id;
        option.textContent = service.title;
        serviceSelect.appendChild(option);
      });
      
      // Populate staff
      staffSelect.innerHTML = '<option value="">Select staff member...</option>';
      this.staff.forEach(staff => {
        const option = document.createElement('option');
        option.value = staff.id;
        option.textContent = staff.name;
        staffSelect.appendChild(option);
      });
    }

    createCalendar() {
      const calendarDiv = this.modal.querySelector('#booking-calendar');
      // Get today's date in the location's timezone
      const now = new Date();
      const todayInLocation = formatDateInLocationTimezone(now);
      const [todayYear, todayMonth, todayDay] = todayInLocation.split('-').map(Number);
      
      const currentMonth = new Date(todayYear, todayMonth - 1, 1);
      
      let calendarHtml = '<div class="booking-calendar">';
      
      // Headers
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      days.forEach(day => {
        calendarHtml += \`<div class="booking-calendar-header">\${day}</div>\`;
      });
      
      // Days
      const firstDay = currentMonth.getDay();
      const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
      
      // Empty cells for days before month starts
      for (let i = 0; i < firstDay; i++) {
        calendarHtml += '<div class="booking-calendar-day disabled"></div>';
      }
      
      // Month days
      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
        const dateStr = formatDate(date);
        const [year, month, dayOfMonth] = dateStr.split('-').map(Number);
        
        // Check if this date is today or in the past (in location timezone)
        const isToday = year === todayYear && month === todayMonth && dayOfMonth === todayDay;
        const isPast = dateStr < todayInLocation;
        
        calendarHtml += \`<div class="booking-calendar-day\${isPast ? ' disabled' : ''}" data-date="\${dateStr}">\${day}</div>\`;
      }
      
      calendarHtml += '</div>';
      calendarDiv.innerHTML = calendarHtml;
      
      // Add click listeners
      calendarDiv.querySelectorAll('.booking-calendar-day:not(.disabled)').forEach(dayEl => {
        dayEl.addEventListener('click', () => {
          calendarDiv.querySelectorAll('.booking-calendar-day').forEach(el => el.classList.remove('selected'));
          dayEl.classList.add('selected');
          this.selectedDate = dayEl.dataset.date;
          this.updateAvailability();
        });
      });
    }

    async updateAvailability() {
      if (!this.selectedDate || !this.selectedStaff) {
        const timeSlotsDiv = this.modal.querySelector('#booking-time-slots');
        timeSlotsDiv.innerHTML = '<div class="booking-loading">Select a staff member and date</div>';
        return;
      }
      
      const timeSlotsDiv = this.modal.querySelector('#booking-time-slots');
      timeSlotsDiv.innerHTML = '<div class="booking-loading">Loading available times...</div>';
      
      try {
        const availability = await loadStaffAvailability(this.selectedStaff, this.selectedDate);
        const bookings = await loadBookings(this.selectedDate);
        
        let availableSlots = [];
        
        availability.forEach(avail => {
          if (avail.isAvailable) {
            const slots = generateTimeSlots(avail.startTime, avail.endTime, 30, 15); // 30 min service, 15 min buffer
            availableSlots = availableSlots.concat(slots);
          }
        });
        
        // Remove booked slots - convert UTC times to location timezone for comparison
        const bookedTimes = bookings
          .filter(booking => booking.staffId === this.selectedStaff && booking.status !== 'cancelled')
          .map(booking => {
            const locationTime = getTimeInLocationTimezone(booking.scheduledAt);
            return locationTime; // Returns "HH:MM" format
          })
          .filter(Boolean); // Remove nulls
        
        availableSlots = availableSlots.filter(slot => !bookedTimes.includes(slot));
        
        this.renderTimeSlots(availableSlots);
        
      } catch (error) {
        timeSlotsDiv.innerHTML = '<div class="booking-error">Failed to load availability</div>';
      }
    }

    renderTimeSlots(slots) {
      const timeSlotsDiv = this.modal.querySelector('#booking-time-slots');
      
      if (slots.length === 0) {
        timeSlotsDiv.innerHTML = '<div class="booking-loading">No available times for this date</div>';
        return;
      }
      
      timeSlotsDiv.innerHTML = '';
      timeSlotsDiv.className = 'booking-time-slots';
      
      slots.forEach(slot => {
        const slotEl = document.createElement('div');
        slotEl.className = 'booking-time-slot';
        slotEl.textContent = formatTime(slot);
        slotEl.dataset.time = slot;
        
        slotEl.addEventListener('click', () => {
          timeSlotsDiv.querySelectorAll('.booking-time-slot').forEach(el => el.classList.remove('selected'));
          slotEl.classList.add('selected');
          this.selectedTime = slot;
        });
        
        timeSlotsDiv.appendChild(slotEl);
      });
    }

    async submitBooking() {
      const name = this.modal.querySelector('#booking-name').value.trim();
      const email = this.modal.querySelector('#booking-email').value.trim();
      const notes = this.modal.querySelector('#booking-notes').value.trim();
      
      // Validation
      if (!this.selectedService || !this.selectedStaff || !this.selectedDate || !this.selectedTime || !name || !email) {
        this.showError('Please fill in all required fields and select a service, staff member, date, and time.');
        return;
      }
      
      const submitBtn = this.modal.querySelector('#booking-submit');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Booking...';
      
      try {
        // Parse the selected date and time (which are in location timezone)
        const [year, month, day] = this.selectedDate.split('-').map(Number);
        const [hour, minute] = this.selectedTime.split(':').map(Number);
        
        // Convert from location timezone to UTC
        const scheduledAtUTC = convertLocationTimeToUTC(year, month - 1, day, hour, minute);
        
        const bookingData = {
          shopId: SHOP_ID,
          productId: this.selectedService,
          staffId: this.selectedStaff,
          scheduledAt: scheduledAtUTC.toISOString(),
          duration: 30, // Default 30 minutes
          customerName: name,
          customerEmail: email,
          notes: notes || null,
          status: 'pending',
          totalPrice: 0 // Will be set based on service price
        };
        
        // Include location ID if available
        if (LOCATION_ID) {
          bookingData.locationId = LOCATION_ID;
        }
        
        const result = await createBooking(bookingData);
        
        if (result.success) {
          this.showSuccess('Your appointment has been booked successfully! You will receive a confirmation email shortly.');
          setTimeout(() => this.closeModal(), 3000);
        } else {
          const errorMsg = result.errors?.map(e => e.message).join(', ') || 'Failed to book appointment';
          this.showError(errorMsg);
        }
        
      } catch (error) {
        this.showError('Failed to book appointment. Please try again later.');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Book Appointment';
      }
    }

    openModal() {
      this.modal.classList.add('show');
      document.body.style.overflow = 'hidden';
    }

    closeModal() {
      this.modal.classList.remove('show');
      document.body.style.overflow = '';
      this.resetForm();
    }

    resetForm() {
      this.modal.querySelectorAll('input, select, textarea').forEach(input => {
        if (input.type === 'checkbox') {
          input.checked = false;
        } else {
          input.value = '';
        }
      });
      
      this.modal.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
      
      this.selectedDate = null;
      this.selectedTime = null;
      this.selectedService = null;
      this.selectedStaff = null;
      
      this.hideMessages();
    }

    showError(message) {
      const errorDiv = this.modal.querySelector('.booking-error');
      errorDiv.textContent = message;
      errorDiv.style.display = 'block';
      this.hideSuccess();
    }

    showSuccess(message) {
      const successDiv = this.modal.querySelector('.booking-success');
      successDiv.textContent = message;
      successDiv.style.display = 'block';
      this.hideError();
    }

    hideError() {
      const errorDiv = this.modal.querySelector('.booking-error');
      errorDiv.style.display = 'none';
    }

    hideSuccess() {
      const successDiv = this.modal.querySelector('.booking-success');
      successDiv.style.display = 'none';
    }

    hideMessages() {
      this.hideError();
      this.hideSuccess();
    }
  }

  // Auto-initialize widgets
  function initializeWidgets() {
    const containers = document.querySelectorAll('[data-booking-widget]');
    containers.forEach(container => {
      if (!container.bookingWidget) {
        container.bookingWidget = new BookingWidget(container);
      }
    });
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeWidgets);
  } else {
    initializeWidgets();
  }

  // Expose for manual initialization
  window.BookingWidget = BookingWidget;
  window.initBookingWidget = initializeWidgets;

})();
`;

    reply.send(widgetScript);
    
  } catch (error) {
    console.error('Error generating booking widget:', error);
    reply.code(500);
    reply.send('// Error generating booking widget');
  }
};

export default route;
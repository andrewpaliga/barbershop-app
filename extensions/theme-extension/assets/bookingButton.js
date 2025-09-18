// Ensure API client is available
if (!window.api && window.BarbershopClient) {
  window.api = new BarbershopClient();
}

// Global variables to store booking data and current selection
let bookingData = null;
let currentSelection = {
  type: null,
  serviceId: null,
  staffId: null,
  variantId: null,
  selectedDate: null,
  selectedTime: null,
  locationId: null
};
let currentWeekStart = null;

// Utility functions for UI manipulation
function setLoading(show) {
  const loadingElement = document.getElementById('booking-loading');
  const selectionElement = document.getElementById('booking-selection');
  const formElement = document.getElementById('booking-form-container');
  
  if (loadingElement) {
    loadingElement.style.display = show ? 'block' : 'none';
  }
  if (selectionElement) {
    selectionElement.style.display = show ? 'none' : (formElement && formElement.style.display !== 'none' ? 'none' : 'block');
  }
  if (formElement) {
    formElement.style.display = show ? 'none' : 'none';
  }
}

function hideMessage(type) {
  const messageElement = document.getElementById(`booking-${type}`);
  if (messageElement) {
    messageElement.style.display = 'none';
  }
}

// Compute a user-facing title for a variant. If Shopify uses
// "Default Title" or the title doesn't contain a duration, fall back
// to the parsed duration minutes.
function getVariantDisplayTitle(service, variant) {
  // Always show just the service title. Duration appears in the subtitle.
  return service.title;
}

function showMessage(type, message) {
  const messageElement = document.getElementById(`booking-${type}`);
  if (messageElement) {
    messageElement.textContent = message;
    messageElement.style.display = 'block';
  }
}

function closeBookingModal() {
  const modal = document.getElementById('barbershop-modal');
  if (modal) {
    modal.style.display = 'none';
  }
  
  // Reset selection state
  currentSelection = {
    type: null,
    serviceId: null,
    staffId: null,
    variantId: null,
    selectedDate: null,
    selectedTime: null,
    locationId: null
  };
  
  showSelectionScreen();
  
  // Hide confirmation modal
  const confirmation = document.getElementById('booking-confirmation');
  if (confirmation) {
    confirmation.style.display = 'none';
  }
  
  // Clear selected time slot
  document.querySelectorAll('.barbershop-time-slot.selected').forEach(slot => {
    slot.classList.remove('selected');
  });
  
  hideMessage('error');
  hideMessage('success');
}

function closeConfirmationView() {
  const confirmation = document.getElementById('booking-confirmation');
  if (confirmation) {
    confirmation.style.display = 'none';
  }
  
  const formContainer = document.getElementById('booking-form-container');
  if (formContainer) {
    formContainer.style.display = 'block';
  }
  
  const mainCloseButton = document.getElementById('main-close-button');
  if (mainCloseButton) {
    mainCloseButton.style.display = 'flex';
  }
  
  document.querySelectorAll('.barbershop-time-slot.selected').forEach(slot => {
    slot.classList.remove('selected');
  });
  
  currentSelection.selectedTime = null;
  currentSelection.selectedDate = null;
  
  hideMessage('error');
  hideMessage('success');
}

function showSelectionScreen() {
  const selectionElement = document.getElementById('booking-selection');
  const formElement = document.getElementById('booking-form-container');
  
  if (selectionElement) {
    selectionElement.style.display = 'block';
  }
  if (formElement) {
    formElement.style.display = 'none';
  }
  
  hideMessage('error');
  hideMessage('success');
}

function showBookingForm() {
  const selectionElement = document.getElementById('booking-selection');
  const formElement = document.getElementById('booking-form-container');
  
  if (selectionElement) {
    selectionElement.style.display = 'none';
  }
  if (formElement) {
    formElement.style.display = 'block';
  }
  
  hideMessage('error');
  hideMessage('success');
  
  initializeCalendar();
  updateSelectedBarberInfo();
  populateServiceMenu();
  
  const forceMode = (bookingData?.locations?.length === 1) ? 'single' : null;
  populateLocationDropdown(forceMode);
}

function updateSelectedBarberInfo() {
  const container = document.getElementById('selected-barber-info');
  if (!container || !bookingData) return;
  
  if (currentSelection.staffId) {
    const staff = bookingData.staff.find(s => s.id === currentSelection.staffId);
    if (staff) {
      const avatarHtml = staff.avatar?.url 
        ? `<img src="${staff.avatar.url}" alt="${staff.name}" class="barbershop-selected-barber-avatar">` 
        : `<div class="barbershop-selected-barber-avatar" style="background: #f0f0f0; display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: bold; color: #666;">${staff.name.charAt(0)}</div>`;
      
      container.innerHTML = `
        <div class="barbershop-selected-barber-info">
          ${avatarHtml}
          <div class="barbershop-selected-barber-details">
            <h4>${staff.name}</h4>
            <p>${staff.bio || 'Professional barber'}</p>
          </div>
        </div>
      `;
    }
  } else if (currentSelection.serviceId) {
    const service = bookingData.services.find(s => s.id === currentSelection.serviceId);
    const variant = service?.variants.find(v => v.id === currentSelection.variantId);
    const serviceName = service && variant ? getVariantDisplayTitle(service, variant) : 'this service';
    
    container.innerHTML = `
      <div style="text-align: center; color: #666; padding: 20px;">
        <h4 style="margin-bottom: 10px; color: #333;">Any Available Barber</h4>
        <p>Showing availability for ${serviceName} from all qualified barbers</p>
      </div>
    `;
  } else {
    container.innerHTML = `
      <div style="text-align: center; color: #666; padding: 20px;">
        <p>Select a service to view availability</p>
      </div>
    `;
  }
}

function populateServiceMenu() {
  const container = document.getElementById('service-menu-list');
  if (!container || !bookingData) return;
  
  container.innerHTML = '';
  
  bookingData.services.forEach(service => {
    if (service.variants && service.variants.length > 0) {
      service.variants.forEach(variant => {
        const serviceItem = document.createElement('div');
        serviceItem.className = 'barbershop-service-menu-item';
        serviceItem.onclick = () => selectServiceFromMenuVariant(service.id, variant.id);
        
        if (currentSelection.serviceId === service.id && currentSelection.variantId === variant.id) {
          serviceItem.classList.add('selected');
        }
        
        const durationText = (variant && variant.duration) ? ` • ${variant.duration} minutes` : ` • ${(bookingData?.timeSlotInterval || 60)} minutes`;
        const priceHtml = variant.price ? `<div class="price">$${variant.price}</div>` : '';
        
        serviceItem.innerHTML = `
          <h4>${getVariantDisplayTitle(service, variant)}</h4>
          <p>${service.body || 'Professional service'}${durationText}</p>
          ${priceHtml}
        `;
        
        container.appendChild(serviceItem);
      });
    }
  });
}

function selectServiceFromMenuVariant(serviceId, variantId) {
  document.querySelectorAll('.barbershop-service-menu-item').forEach(item => {
    item.classList.remove('selected');
  });
  
  event.target.closest('.barbershop-service-menu-item').classList.add('selected');
  
  currentSelection.serviceId = serviceId;
  currentSelection.variantId = variantId;

  if (currentSelection.type !== 'staff') {
    currentSelection.staffId = null;
    currentSelection.type = 'service';
  }
  
  updateSelectedBarberInfo();
  updateCalendar();
  
  document.querySelectorAll('.barbershop-time-slot.selected').forEach(slot => {
    slot.classList.remove('selected');
  });
  currentSelection.selectedTime = null;
  currentSelection.selectedDate = null;
}

function populateLocationDropdown(forceDisplayMode = null) {
  const locationSelect = document.getElementById('location-select');
  const singleLocationDisplay = document.getElementById('single-location-display');
  const singleLocationName = document.getElementById('single-location-name');
  const singleLocationAddress = document.getElementById('single-location-address');
  
  if (!locationSelect || !bookingData?.locations) {
    return;
  }
  
  locationSelect.innerHTML = '';
  
  const serviceLocations = bookingData.locations.filter(location => {
    return location.offersServices !== false;
  });
  
  if (serviceLocations.length === 0) {
    locationSelect.innerHTML = '<option value="">No locations available for booking</option>';
    locationSelect.style.display = 'block';
    if (singleLocationDisplay) singleLocationDisplay.style.display = 'none';
    return;
  }
  
  const shouldShowAsSingle = serviceLocations.length === 1;
  
  if (shouldShowAsSingle) {
    const location = serviceLocations[0];
    currentSelection.locationId = location.id;
    
    if (singleLocationName) {
      singleLocationName.textContent = location.name;
    }
    if (singleLocationAddress) {
      const addressParts = [];
      if (location.address1) addressParts.push(location.address1);
      if (location.city) addressParts.push(location.city);
      if (location.province) addressParts.push(location.province);
      const fullAddress = addressParts.join(', ');
      singleLocationAddress.textContent = fullAddress;
    }
    
    if (singleLocationDisplay) {
      singleLocationDisplay.style.display = 'block';
    }
    locationSelect.style.display = 'none';
    
    updateCalendar();
  } else {
    locationSelect.innerHTML = '<option value="">Select a location</option>';
    serviceLocations.forEach(location => {
      const option = document.createElement('option');
      option.value = location.id;
      option.textContent = `${location.name} - ${location.address1}, ${location.city}`;
      locationSelect.appendChild(option);
    });
    
    locationSelect.style.display = 'block';
    if (singleLocationDisplay) {
      singleLocationDisplay.style.display = 'none';
    }
    
    const firstLocation = serviceLocations[0];
    locationSelect.value = firstLocation.id;
    currentSelection.locationId = firstLocation.id;
    updateCalendar();
  }
}

function initializeCalendar() {
  const today = new Date();
  currentWeekStart = getWeekStart(today);
  updateCalendar();
  
  document.getElementById('prev-week').addEventListener('click', () => {
    currentWeekStart = new Date(currentWeekStart.getTime() - 7 * 24 * 60 * 60 * 1000);
    updateCalendar();
  });
  
  document.getElementById('next-week').addEventListener('click', () => {
    currentWeekStart = new Date(currentWeekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
    updateCalendar();
  });
  
  document.getElementById('location-select').addEventListener('change', (e) => {
    currentSelection.locationId = e.target.value;
    updateCalendar();
  });
}

function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day;
  return new Date(d.setDate(diff));
}

function updateCalendar() {
  updateCalendarHeader();
  renderCalendarDays();
}

function updateCalendarHeader() {
  const monthYear = document.getElementById('calendar-month-year');
  if (monthYear && currentWeekStart) {
    const options = { month: 'long', year: 'numeric' };
    monthYear.textContent = currentWeekStart.toLocaleDateString('en-US', options);
  }
}

function renderCalendarDays() {
  const calendarBody = document.getElementById('calendar-body');
  if (!calendarBody || !currentWeekStart) return;
  
  calendarBody.innerHTML = '';
  
  for (let i = 0; i < 7; i++) {
    const date = new Date(currentWeekStart.getTime() + i * 24 * 60 * 60 * 1000);
    const dayElement = createCalendarDay(date);
    calendarBody.appendChild(dayElement);
  }
}

function createCalendarDay(date) {
  const dayElement = document.createElement('div');
  dayElement.className = 'barbershop-calendar-day';
  
  const today = new Date();
  const isPast = date < today.setHours(0, 0, 0, 0);
  
  if (isPast) {
    dayElement.classList.add('disabled');
  }
  
  const dayNumber = document.createElement('div');
  dayNumber.className = 'barbershop-day-number';
  dayNumber.textContent = date.getDate();
  dayElement.appendChild(dayNumber);
  
  if (!isPast && currentSelection.serviceId && currentSelection.locationId) {
    const timeSlots = generateTimeSlots(date);
    timeSlots.forEach(slot => {
      const timeSlotElement = createTimeSlot(slot, date);
      dayElement.appendChild(timeSlotElement);
    });
  }
  
  return dayElement;
}

function generateTimeSlots(date) {
  if (!currentSelection.serviceId || !currentSelection.locationId || !bookingData) {
    return [];
  }
  
  const qualifiedStaff = getQualifiedStaffForService(currentSelection.serviceId);
  if (qualifiedStaff.length === 0) {
    return [];
  }
  
  const dayOfWeek = getDayOfWeek(date);
  const aggregatedSlots = new Set();
  
  // Generate time slots for the given date
  
  qualifiedStaff.forEach(staffId => {
    // First, try to find specific date availability for the exact date being checked
    const dateAvailability = bookingData.staffDateAvailability.find(avail => {
      if (avail.staffId !== staffId || (avail.locationId && avail.locationId !== currentSelection.locationId)) {
        return false;
      }
      
      const availDate = new Date(avail.date);
      const availDateLocal = new Date(
        availDate.getUTCFullYear(),
        availDate.getUTCMonth(),
        availDate.getUTCDate()
      );
      
      const currentDate = new Date(
        date.getFullYear(),
        date.getMonth(), 
        date.getDate()
      );
      
      return currentDate.getTime() === availDateLocal.getTime();
    });
    
    // If no specific date availability, fall back to weekly availability for the correct day
    const staffAvailability = bookingData.staffAvailability.find(avail => 
      avail.staffId === staffId &&
      (avail.locationId === currentSelection.locationId || !avail.locationId) &&
      avail.dayOfWeek && Array.isArray(avail.dayOfWeek) && avail.dayOfWeek.includes(dayOfWeek) &&
      avail.isAvailable
    );
    
    // Use specific date availability if available, otherwise fall back to weekly availability
    const availability = dateAvailability || staffAvailability;
    
    // Use specific date availability if available, otherwise fall back to weekly availability
    
    if (availability) {
      const startTime = parseTime(availability.startTime);
      const endTime = parseTime(availability.endTime);
      const timeSlotInterval = bookingData.timeSlotInterval || 30;
      
      // Generate time slots that align with the interval
      for (let minutes = startTime; minutes < endTime; minutes += timeSlotInterval) {
        const time = formatTime(minutes);
        aggregatedSlots.add(time);
      }
    }
  });
  
  const sortedSlots = Array.from(aggregatedSlots).sort();
  return sortedSlots;
}

function getDayOfWeek(date) {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return days[date.getDay()];
}

function parseTime(timeString) {
  if (!timeString) return 0;
  const [hours, minutes] = timeString.split(':').map(Number);
  return hours * 60 + minutes;
}

function formatTime(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

function createTimeSlot(time, date) {
  const timeSlotElement = document.createElement('button');
  timeSlotElement.className = 'barbershop-time-slot';
  timeSlotElement.textContent = time;
  timeSlotElement.type = 'button';
  
  const isAvailable = isTimeSlotAvailable(time, date);
  
  if (!isAvailable) {
    timeSlotElement.classList.add('unavailable');
    timeSlotElement.disabled = true;
  } else {
    timeSlotElement.addEventListener('click', () => {
      selectTimeSlot(time, date, timeSlotElement);
    });
  }
  return timeSlotElement;
}

function isTimeSlotAvailable(time, date) {
  if (!currentSelection.serviceId || !currentSelection.locationId || !bookingData) {
    return false;
  }
  
  const qualifiedStaff = getQualifiedStaffForService(currentSelection.serviceId);
  if (qualifiedStaff.length === 0) {
    return false;
  }
  
  const availableStaff = qualifiedStaff.filter(staffId => {
    return isTimeSlotAvailableForStaff(time, date, staffId);
  });
  
  return availableStaff.length > 0;
}

function isTimeSlotAvailableForStaff(time, date, staffId) {
  if (!staffId || !currentSelection.locationId || !bookingData) {
    return false;
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const appointmentDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  
  if (appointmentDate.getTime() === today.getTime()) {
    const currentTime = now.getHours() * 60 + now.getMinutes();
    const slotTime = parseTime(time);
    const gracePeriod = 15;
    
    if (currentTime > slotTime + gracePeriod) {
      console.log(`Time slot ${time} is in the past (current: ${currentTime}, slot: ${slotTime})`);
      return false;
    }
  }

  const dayOfWeek = getDayOfWeek(date);
  
  // First, try to find specific date availability for the exact date being checked
  const dateAvailability = bookingData.staffDateAvailability.find(avail => {
    if (avail.staffId !== staffId || (avail.locationId && avail.locationId !== currentSelection.locationId)) {
      return false;
    }
    
    const availDate = new Date(avail.date);
    const availDateLocal = new Date(
      availDate.getUTCFullYear(),
      availDate.getUTCMonth(),
      availDate.getUTCDate()
    );
    
    const currentDate = new Date(
      date.getFullYear(),
      date.getMonth(), 
      date.getDate()
    );
    
    const isMatch = currentDate.getTime() === availDateLocal.getTime();
    // Found specific date availability
    
    return isMatch;
  });
  
  // If no specific date availability, fall back to weekly availability for the correct day
  const staffAvailability = bookingData.staffAvailability.find(avail => 
    avail.staffId === staffId &&
    (avail.locationId === currentSelection.locationId || !avail.locationId) &&
    avail.dayOfWeek && avail.dayOfWeek.includes(dayOfWeek) &&
    avail.isAvailable
  );
  
  // Use specific date availability if available, otherwise fall back to weekly availability
  const availability = dateAvailability || staffAvailability;
  
  if (!availability || !availability.isAvailable) {
    return false;
  }
  
  const slotTime = parseTime(time);
  const startTime = parseTime(availability.startTime);
  const endTime = parseTime(availability.endTime);
  
  const serviceDuration = getServiceDuration();
  const slotEndTime = slotTime + serviceDuration;
  
  if (!(slotTime >= startTime && slotEndTime <= endTime)) {
    return false;
  }
  
  const hasConflict = checkBookingConflictsForStaff(date, time, serviceDuration, staffId);
  return !hasConflict;
}

function getServiceDuration() {
  if (!currentSelection.serviceId || !bookingData) return bookingData.timeSlotInterval || 60;
  
  const service = bookingData.services.find(s => s.id === currentSelection.serviceId);
  if (!service || !service.variants || service.variants.length === 0) return bookingData.timeSlotInterval || 60;
  
  const variant = currentSelection.variantId 
    ? service.variants.find(v => v.id === currentSelection.variantId)
    : service.variants[0];
  
  return (variant && variant.duration) ? variant.duration : (bookingData.timeSlotInterval || 60);
}

function getQualifiedStaffForService(serviceId) {
  if (!bookingData || !bookingData.staff || !Array.isArray(bookingData.staff)) {
    return [];
  }
  
  if (currentSelection.staffId) {
    const selectedStaff = bookingData.staff.find(staff => staff.id === currentSelection.staffId);
    if (selectedStaff && selectedStaff.isActive !== false) {
      return [selectedStaff.id];
    } else {
      return [];
    }
  }
  
  const filteredStaff = bookingData.staff.filter(staff => {
    return staff.isActive !== false;
  });
  
  return filteredStaff.map(staff => staff.id);
}

function checkBookingConflictsForStaff(date, time, serviceDuration, staffId) {
  if (!bookingData.existingBookings || !Array.isArray(bookingData.existingBookings)) {
    return false;
  }
  
  const proposedDate = new Date(date);
  const [hours, minutes] = time.split(':').map(Number);
  const proposedStart = new Date(
    proposedDate.getFullYear(),
    proposedDate.getMonth(),
    proposedDate.getDate(),
    hours,
    minutes
  );
  
  const proposedEnd = new Date(proposedStart.getTime() + (serviceDuration * 60 * 1000));
  
  const targetStaffId = String(staffId);
  
  // Check for booking conflicts
  
  const conflictingBookings = bookingData.existingBookings.filter(booking => {
    const bookingStaffId = String(booking.staffId);
    
    if (bookingStaffId !== targetStaffId) {
      return false;
    }
    
    const existingStart = new Date(booking.scheduledAt);
    const existingDuration = booking.duration || 60;
    const existingEnd = new Date(existingStart.getTime() + (existingDuration * 60 * 1000));
    
    const hasOverlap = (proposedStart < existingEnd) && (proposedEnd > existingStart);
    
    // Conflict detected
    
    return hasOverlap;
  });
  
  return conflictingBookings.length > 0;
}

function selectTimeSlot(time, date, element) {
  document.querySelectorAll('.barbershop-time-slot.selected').forEach(slot => {
    slot.classList.remove('selected');
  });
  
  element.classList.add('selected');
  
  currentSelection.selectedTime = time;
  currentSelection.selectedDate = date;
  
  if (currentSelection.serviceId && !currentSelection.staffId) {
    showBarberSelectionForTimeSlot(time, date);
  } else {
    showBookingConfirmation();
  }
}

function showBarberSelectionForTimeSlot(time, date) {
  const barberModal = document.getElementById('barber-selection-modal');
  const formContainer = document.getElementById('booking-form-container');
  if (!barberModal || !formContainer) return;
  
  const qualifiedStaff = getQualifiedStaffForService(currentSelection.serviceId);
  
  const availableStaff = qualifiedStaff.filter(staffId => {
    return isTimeSlotAvailableForStaff(time, date, staffId);
  });
  
  if (availableStaff.length === 0) {
    showMessage('error', 'No barbers are available at this time. Please select a different time slot.');
    return;
  }
  
  const barbersList = document.getElementById('available-barbers-list');
  barbersList.innerHTML = '';
  
  availableStaff.forEach(staffId => {
    const staff = bookingData.staff.find(s => s.id === staffId);
    if (!staff) return;
    
    const barberChoice = document.createElement('div');
    barberChoice.className = 'barbershop-barber-choice';
    barberChoice.onclick = () => selectBarberForTimeSlot(staffId);
    
    const avatarHtml = staff.avatar?.url 
      ? `<img src="${staff.avatar.url}" alt="${staff.name}" class="barbershop-barber-choice-avatar">` 
      : `<div class="barbershop-barber-choice-avatar" style="background: #f0f0f0; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: bold; color: #666;">${staff.name.charAt(0)}</div>`;
    
    barberChoice.innerHTML = `
      ${avatarHtml}
      <div class="barbershop-barber-choice-name">${staff.name}</div>
      <div class="barbershop-barber-choice-bio">${staff.bio || 'Professional barber'}</div>
    `;
    
    barbersList.appendChild(barberChoice);
  });
  
  formContainer.style.display = 'none';
  barberModal.style.display = 'block';
}

function selectBarberForTimeSlot(staffId) {
  currentSelection.staffId = staffId;
  
  const barberModal = document.getElementById('barber-selection-modal');
  if (barberModal) {
    barberModal.style.display = 'none';
  }
  
  showBookingConfirmation();
}

function cancelBarberSelection() {
  const barberModal = document.getElementById('barber-selection-modal');
  const formContainer = document.getElementById('booking-form-container');
  
  if (barberModal) {
    barberModal.style.display = 'none';
  }
  
  if (formContainer) {
    formContainer.style.display = 'block';
  }
  
  document.querySelectorAll('.barbershop-time-slot.selected').forEach(slot => {
    slot.classList.remove('selected');
  });
  
  currentSelection.selectedTime = null;
  currentSelection.selectedDate = null;
  
  hideMessage('error');
  hideMessage('success');
}

function showBookingConfirmation() {
  const confirmation = document.getElementById('booking-confirmation');
  const formContainer = document.getElementById('booking-form-container');
  
  if (!confirmation || !formContainer) {
    return;
  }
  
  const service = bookingData.services.find(s => s.id === currentSelection.serviceId);
  const staff = bookingData.staff.find(s => s.id === currentSelection.staffId);
  const location = bookingData.locations.find(l => l.id === currentSelection.locationId);
  const variant = service?.variants.find(v => v.id === currentSelection.variantId);
  
  if (!service || !staff || !location || !variant) return;
  
  const details = document.getElementById('booking-details');
  const notes = document.getElementById('notes').value;
  
  details.innerHTML = `
    <div class="barbershop-booking-detail-row">
      <span class="barbershop-booking-detail-label">Service:</span>
      <span class="barbershop-booking-detail-value">${service.title} - ${variant.title}</span>
    </div>
    <div class="barbershop-booking-detail-row">
      <span class="barbershop-booking-detail-label">Barber:</span>
      <span class="barbershop-booking-detail-value">${staff.name}</span>
    </div>
    <div class="barbershop-booking-detail-row">
      <span class="barbershop-booking-detail-label">Date & Time:</span>
      <span class="barbershop-booking-detail-value">${currentSelection.selectedDate.toLocaleDateString()} at ${currentSelection.selectedTime}</span>
    </div>
    <div class="barbershop-booking-detail-row">
      <span class="barbershop-booking-detail-label">Location:</span>
      <span class="barbershop-booking-detail-value">${location.name}</span>
    </div>
    <div class="barbershop-booking-detail-row">
      <span class="barbershop-booking-detail-label">Duration:</span>
      <span class="barbershop-booking-detail-value">${variant.duration || 60} minutes</span>
    </div>
    ${notes ? `<div class="barbershop-booking-detail-row">
      <span class="barbershop-booking-detail-label">Notes:</span>
      <span class="barbershop-booking-detail-value">${notes}</span>
    </div>` : ''}
    <div class="barbershop-booking-detail-row">
      <span class="barbershop-booking-detail-label">Total:</span>
      <span class="barbershop-booking-detail-value">$${variant.price || 'N/A'}</span>
    </div>
  `;
  
  formContainer.style.display = 'none';
  confirmation.style.display = 'block';
  
  const mainCloseButton = document.getElementById('main-close-button');
  if (mainCloseButton) {
    mainCloseButton.style.display = 'none';
  }
}

function cancelBooking() {
  const confirmation = document.getElementById('booking-confirmation');
  const formContainer = document.getElementById('booking-form-container');
  const barberModal = document.getElementById('barber-selection-modal');
  
  if (confirmation) {
    confirmation.style.display = 'none';
  }
  
  if (barberModal) {
    barberModal.style.display = 'none';
  }
  
  if (formContainer) {
    formContainer.style.display = 'block';
  }
  
  const mainCloseButton = document.getElementById('main-close-button');
  if (mainCloseButton) {
    mainCloseButton.style.display = 'flex';
  }
  
  document.querySelectorAll('.barbershop-time-slot.selected').forEach(slot => {
    slot.classList.remove('selected');
  });
  
  currentSelection.selectedTime = null;
  currentSelection.selectedDate = null;
  
  hideMessage('error');
  hideMessage('success');
}

async function confirmBooking() {
  const confirmBtn = document.getElementById('confirm-booking-btn');
  const originalText = confirmBtn.textContent;
  
  try {
    confirmBtn.textContent = 'Adding...';
    confirmBtn.disabled = true;
    
    const service = bookingData.services.find(s => s.id === currentSelection.serviceId);
    const staff = bookingData.staff.find(s => s.id === currentSelection.staffId);
    const location = bookingData.locations.find(l => l.id === currentSelection.locationId);
    const variant = service?.variants.find(v => v.id === currentSelection.variantId);
    const notes = document.getElementById('notes').value;
    
    const selectedDate = new Date(currentSelection.selectedDate);
    const [timeHours, timeMinutes] = currentSelection.selectedTime.split(':').map(Number);
    
    const scheduledAt = new Date(
      selectedDate.getFullYear(),
      selectedDate.getMonth(),
      selectedDate.getDate(),
      timeHours,
      timeMinutes,
      0,
      0
    );
    
    const shopifyVariantId = variant.shopifyVariantId || variant.variantId;
    
    if (shopifyVariantId) {
      const cartItemData = {
        id: shopifyVariantId,
        quantity: 1,
        properties: {
          'Booking Time': formatTime12Hour(currentSelection.selectedTime),
          'Booking Date': currentSelection.selectedDate.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          }),
          'Barber Name': staff.name,
          'Notes': notes || '',
          // hidden private metadata so it doesn't render in cart
          '_staff_id': currentSelection.staffId,
          '_location_id': currentSelection.locationId,
          // Show location name only if there are multiple locations
          ...(bookingData.locations && bookingData.locations.length > 1 ? {
            'Location Name': location.name
          } : {
            '_location_name': location.name
          })
        }
      };
      
      confirmBtn.innerHTML = '<span class="spinner"></span> Adding to Cart...';
      confirmBtn.disabled = true;
      
      // Adding booking to cart
      
      try {
        const cartResponse = await fetch('/cart/add.js', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(cartItemData)
        });
        
        if (cartResponse.ok) {
          window.location.href = '/cart';
        } else {
          const cartError = await cartResponse.text();
          
          let errorMessage = 'Failed to add booking to cart. Please try again.';
          
          // Parse the error response to provide better error messages
          try {
            const errorData = JSON.parse(cartError);
            if (errorData.description === 'Cannot find variant') {
              errorMessage = 'This service is not available for online booking. Please contact us directly to book this service.';
            } else if (errorData.description) {
              errorMessage = `Booking error: ${errorData.description}`;
            }
          } catch (parseError) {
            // If we can't parse the error, use the generic message
          }
          
          showMessage('error', errorMessage);
          confirmBtn.innerHTML = originalText;
          confirmBtn.disabled = false;
        }
      } catch (error) {
        showMessage('error', 'Failed to add booking to cart. Please try again.');
        confirmBtn.innerHTML = originalText;
        confirmBtn.disabled = false;
      }
      
    } else {
      showMessage('error', 'This service cannot be booked online. Please contact us directly.');
    }
    
  } catch (error) {
    showMessage('error', error.message || 'Failed to add booking to cart. Please try again.');
    confirmBtn.innerHTML = originalText;
    confirmBtn.disabled = false;
  }
}

function formatTime12Hour(timeString) {
  try {
    if (!timeString || !timeString.includes(':')) {
      return timeString;
    }
    
    const [hours, minutes] = timeString.split(':').map(Number);
    
    if (isNaN(hours) || isNaN(minutes)) {
      return timeString;
    }
    
    const timeObj = new Date();
    timeObj.setHours(hours, minutes);
    
    const formatted = timeObj.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    
    return formatted;
  } catch (error) {
    return timeString;
  }
}

function hasStaffAvailabilityInNext3Months(staffId) {
  if (!bookingData || !bookingData.staffAvailability || !bookingData.locations) {
    return false;
  }
  
  const today = new Date();
  const threeMonthsFromNow = new Date(today.getTime() + (90 * 24 * 60 * 60 * 1000));
  
  const hasRegularAvailability = bookingData.staffAvailability.some(avail => 
    avail.staffId === staffId && 
    avail.isAvailable &&
    avail.dayOfWeek && 
    Array.isArray(avail.dayOfWeek) && 
    avail.dayOfWeek.length > 0
  );
  
  if (!hasRegularAvailability) {
    if (bookingData.staffDateAvailability) {
      return bookingData.staffDateAvailability.some(dateAvail => {
        if (dateAvail.staffId !== staffId || !dateAvail.isAvailable) {
          return false;
        }
        
        const availDate = new Date(dateAvail.date);
        const availDateLocal = new Date(
          availDate.getUTCFullYear(),
          availDate.getUTCMonth(),
          availDate.getUTCDate()
        );
        return availDateLocal >= today && availDateLocal <= threeMonthsFromNow;
      });
    }
    return false;
  }
  
  if (bookingData.staffDateAvailability) {
    const unavailableDays = bookingData.staffDateAvailability.filter(dateAvail => {
      if (dateAvail.staffId !== staffId || dateAvail.isAvailable) {
        return false;
      }
      
      const availDate = new Date(dateAvail.date);
      const availDateLocal = new Date(
        availDate.getUTCFullYear(),
        availDate.getUTCMonth(),
        availDate.getUTCDate()
      );
      return availDateLocal >= today && availDateLocal <= threeMonthsFromNow;
    }).length;
    
    if (unavailableDays > 80) {
      return false;
    }
  }
  
  return true;
}

function selectService(serviceId, variantId) {
  currentSelection.type = 'service';
  currentSelection.serviceId = serviceId;
  currentSelection.variantId = variantId;
  currentSelection.staffId = null;
  showBookingForm();
}

function selectStaff(staffId) {
  currentSelection.type = 'staff';
  currentSelection.staffId = staffId;
  
  if (bookingData && bookingData.services && bookingData.services.length > 0) {
    const firstService = bookingData.services[0];
    if (firstService.variants && firstService.variants.length > 0) {
      const firstVariant = firstService.variants[0];
      currentSelection.serviceId = firstService.id;
      currentSelection.variantId = firstVariant.id;
    }
  }
  
  showBookingForm();
}

async function openBookingModal() {
  const modal = document.getElementById('barbershop-modal');
  if (!modal) {
    return;
  }
  
  modal.style.display = 'block';
  
  currentSelection = {
    type: null,
    serviceId: null,
    staffId: null,
    variantId: null,
    selectedDate: null,
    selectedTime: null,
    locationId: null
  };
  
  setLoading(true);
  
  try {
    await loadBookingData();
    
    populateServiceButtons();
    populateStaffButtons();
    
    setLoading(false);
    showSelectionScreen();
    
  } catch (error) {
    showMessage('error', `Failed to load booking options: ${error.message}`);
    setLoading(false);
  }
}

async function loadBookingData() {
  try {
    const shopDomain = window.Shopify?.shop?.myshopifyDomain || window.location.hostname;
    
    const apiUrl = `https://barbershop--development.gadget.app/api/booking-data?shop=${encodeURIComponent(shopDomain)}`;
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      mode: 'cors'
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    
    let processedData;
    if (data.success && data.data) {
      processedData = data.data;
    } else if (data.services && data.staff && data.locations) {
      processedData = data;
    } else if (data.success === false) {
      throw new Error(data.error || 'Failed to load booking data');
    } else {
      throw new Error('Invalid response format from booking API');
    }
    
    if (!processedData.services || !processedData.staff || !processedData.locations) {
      throw new Error('Invalid booking data: missing required fields');
    }
    
    if (processedData.locations && Array.isArray(processedData.locations)) {
      processedData.locations = processedData.locations.filter(location => location.offersServices !== false);
    }
    
    bookingData = processedData;
    
    // Theme customization is now handled by Liquid template
    
    // Debug: Log existing bookings
    // Load existing bookings for conflict checking
    
  } catch (error) {
    throw error;
  }
}

function populateServiceButtons() {
  const container = document.getElementById('service-selection-buttons');
  if (!container || !bookingData || !bookingData.services || !Array.isArray(bookingData.services)) {
    return;
  }
  
  const fragment = document.createDocumentFragment();
  
  bookingData.services.forEach((service) => {
    if (service.variants && service.variants.length > 0) {
      service.variants.forEach((variant) => {
        const button = document.createElement('button');
        button.className = 'barbershop-selection-btn barbershop-service-btn';
        button.onclick = () => selectService(service.id, variant.id);
        
        const hasImage = variant.image && variant.image.url && variant.image.url !== 'null';
        const imageHtml = hasImage 
          ? `<img src="${variant.image.url}" alt="${service.title} - ${variant.title}" class="barbershop-service-image" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"><div class="barbershop-service-image barbershop-service-placeholder" style="display: none;"><div class="barbershop-placeholder-icon">${service.title.charAt(0).toUpperCase()}</div></div>`
          : `<div class="barbershop-service-image barbershop-service-placeholder"><div class="barbershop-placeholder-icon">${service.title.charAt(0).toUpperCase()}</div></div>`;
        
        const durationText = variant.duration ? `${variant.duration} minutes` : '';
        const priceHtml = variant.price ? `<div class="barbershop-selection-price">$${variant.price}</div>` : '';
        
        button.innerHTML = `
          ${imageHtml}
          <div class="barbershop-service-info">
            <div class="barbershop-selection-title">${service.title}</div>
            ${durationText ? `<div class="barbershop-selection-subtitle">${durationText}</div>` : ''}
            ${priceHtml}
          </div>
        `;
        
        fragment.appendChild(button);
      });
    }
  });
  
  container.innerHTML = '';
  container.appendChild(fragment);
}

function populateStaffButtons() {
  const container = document.getElementById('staff-selection-buttons');
  if (!container || !bookingData || !bookingData.staff || !Array.isArray(bookingData.staff)) {
    return;
  }
  
  const availableStaff = bookingData.staff.filter(staff => {
    return hasStaffAvailabilityInNext3Months(staff.id);
  });
  
  if (availableStaff.length === 0) {
    container.innerHTML = '<div style="text-align: center; color: #666; padding: 40px;"><p>No barbers are currently available for booking in the next 3 months. Please check back later or contact us directly.</p></div>';
    return;
  }
  
  const fragment = document.createDocumentFragment();
  
  availableStaff.forEach((staff) => {
    const button = document.createElement('button');
    button.className = 'barbershop-selection-btn barbershop-staff-btn';
    button.onclick = () => selectStaff(staff.id);
    
    const avatarHtml = staff.avatar?.url 
      ? `<img src="${staff.avatar.url}" alt="${staff.name}" class="barbershop-staff-avatar">` 
      : `<div class="barbershop-staff-avatar" style="background: #f0f0f0; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: bold; color: #666;">${staff.name.charAt(0)}</div>`;
    
    button.innerHTML = `
      ${avatarHtml}
      <div class="barbershop-staff-info">
        <div class="barbershop-selection-title">${staff.name}</div>
        <div class="barbershop-selection-subtitle">${staff.bio || 'Professional barber'}</div>
      </div>
    `;
    
    fragment.appendChild(button);
  });
  
  container.innerHTML = '';
  container.appendChild(fragment);
}


// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  if (!window.api && window.BarbershopClient) {
    window.api = new BarbershopClient();
  }
  
  
  window.onclick = function(event) {
    const modal = document.getElementById('barbershop-modal');
    if (event.target === modal) {
      closeBookingModal();
    }
  };
});

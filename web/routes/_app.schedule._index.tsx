import { useState, useMemo, useCallback, useEffect } from "react";
import {
  Page,
  Card,
  Button,
  Modal,
  Grid,
  Text,
  BlockStack,
  InlineStack,
  Badge,
  Box,
  Select,
  TextField,
  DatePicker,
  ButtonGroup,
  Icon,
  Divider,
  Layout,
  EmptyState,
  FooterHelp,
  Link
} from "@shopify/polaris";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CalendarIcon,
  PlusIcon
} from "@shopify/polaris-icons";
import { useFindMany, useAction } from "@gadgetinc/react";
import { api } from "../api";

const useFindManyAny: any = useFindMany;
const useActionAny: any = useAction;

// Helper function to get start of week (Sunday)
const getWeekStart = (date: Date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day;
  return new Date(d.setDate(diff));
};

// Helper function to format time
const formatTime = (hour: number, minute: number) => {
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${displayHour}:${minute.toString().padStart(2, "0")} ${period}`;
};

const getTimezoneCode = (ianaTimezone: string | null | undefined): string => {
  if (!ianaTimezone) return "EST";

  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: ianaTimezone,
      timeZoneName: "short",
    });

    const parts = formatter.formatToParts(now);
    const tzName = parts.find((part) => part.type === "timeZoneName")?.value;
    if (tzName) {
      return tzName;
    }
  } catch (error) {
    // Fallback to mapping if Intl fails
  }

  const timezoneMap: Record<string, string> = {
    "America/New_York": "EST",
    "America/Chicago": "CST",
    "America/Denver": "MST",
    "America/Los_Angeles": "PST",
    "America/Phoenix": "MST",
    "America/Anchorage": "AKST",
    "Pacific/Honolulu": "HST",
    "America/Toronto": "EST",
    "America/Vancouver": "PST",
    "Europe/London": "GMT",
    "Europe/Paris": "CET",
    "Asia/Shanghai": "CST",
    "Asia/Tokyo": "JST",
    "Australia/Sydney": "AEST",
    UTC: "UTC",
  };

  return timezoneMap[ianaTimezone] || "EST";
};

// Helper function to extract duration from variant title
const extractDurationFromTitle = (title: string): number => {
  const match = title.match(/(\d+)\s*min/i);
  return match ? parseInt(match[1]) : 15; // Default to 15 minutes if no duration found
};

// Generate time slots from 8 AM to 6 PM in 30-minute intervals
const generateTimeSlots = () => {
  const slots = [];
  for (let hour = 8; hour < 18; hour++) {
    slots.push({ hour, minute: 0 });
    slots.push({ hour, minute: 30 });
  }
  return slots;
};

const formatDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatDateTimeInTimezone = (
  utcDate: Date,
  timezone?: string | null,
  options?: { includeSeconds?: boolean; hour12?: boolean }
): string => {
  const timeOptions: Intl.DateTimeFormatOptions = {
    hour: "numeric",
    minute: "2-digit",
    hour12: options?.hour12 ?? true,
  };

  if (options?.includeSeconds) {
    timeOptions.second = "2-digit";
  }

  if (!timezone) {
    return `${utcDate.toLocaleDateString()} at ${utcDate.toLocaleTimeString([], timeOptions)}`;
  }

  const dateFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });

  const timeFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    ...timeOptions,
  });

  return `${dateFormatter.format(utcDate)} at ${timeFormatter.format(utcDate)}`;
};

type ProcessedBooking = {
  original: any;
  dayKey: string;
  startMinutes: number;
  endMinutes: number;
  duration: number;
};

// Get booking status color
const getStatusColor = (status: string) => {
  switch (status) {
    case "paid":
      return "success";
    case "not_paid":
      return "warning";
    case "pending":
      return "info";
    default:
      return "subdued";
  }
};

// Helper function to convert location time to UTC
const convertLocationTimeToUTC = (localTime: Date, locationTimezone: string): Date => {
  if (!locationTimezone) {
    return localTime; // Fallback to local time if no timezone
  }
  
  // Create a date in the location timezone
  const year = localTime.getFullYear();
  const month = localTime.getMonth();
  const date = localTime.getDate();
  const hours = localTime.getHours();
  const minutes = localTime.getMinutes();
  
  // Create an Intl.DateTimeFormat for the location timezone
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: locationTimezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  
  // Create a reference date in UTC
  const referenceUTC = new Date(year, month, date, hours, minutes);
  
  // Get the formatted date parts in the target timezone
  const parts = formatter.formatToParts(referenceUTC);
  const locationDate = new Date(
    parseInt(parts.find(p => p.type === 'year')?.value || '0'),
    parseInt(parts.find(p => p.type === 'month')?.value || '1') - 1,
    parseInt(parts.find(p => p.type === 'day')?.value || '1'),
    parseInt(parts.find(p => p.type === 'hour')?.value || '0'),
    parseInt(parts.find(p => p.type === 'minute')?.value || '0')
  );
  
  // Calculate the offset between what we want and what we got
  const offset = referenceUTC.getTime() - locationDate.getTime();
  
  // Apply the offset to get UTC time
  return new Date(localTime.getTime() - offset);
};

// Helper function to convert UTC time to location time
const convertUTCToLocationTime = (utcTime: Date, locationTimezone: string): Date => {
  if (!locationTimezone) {
    return utcTime; // Fallback if no timezone
  }
  
  // Use toLocaleString to get the time in the target timezone
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: locationTimezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  
  const parts = formatter.formatToParts(utcTime);
  return new Date(
    parseInt(parts.find(p => p.type === 'year')?.value || '0'),
    parseInt(parts.find(p => p.type === 'month')?.value || '1') - 1,
    parseInt(parts.find(p => p.type === 'day')?.value || '1'),
    parseInt(parts.find(p => p.type === 'hour')?.value || '0'),
    parseInt(parts.find(p => p.type === 'minute')?.value || '0'),
    parseInt(parts.find(p => p.type === 'second')?.value || '0')
  );
};

export default function SchedulePage() {
  const [mounted, setMounted] = useState(false);
  const [currentWeek, setCurrentWeek] = useState(() => getWeekStart(new Date()));
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [selectedLocationId, setSelectedLocationId] = useState("");
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<{
    date: Date;
    hour: number;
    minute: number;
  } | null>(null);
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  const timeSlots = useMemo(() => generateTimeSlots(), []);

  // Set mounted flag after component mounts on client
  useEffect(() => {
    setMounted(true);
  }, []);

  // Form state for booking modal
  const [formData, setFormData] = useState({
    customerId: "",
    customerName: "",
    customerEmail: "",
    staffId: "",
    productId: "",
    locationId: "",
    duration: "60",
    totalPrice: "0",
    notes: "",
    variantId: "", // Track selected variant
  });

  // State for variant management
  const [availableVariants, setAvailableVariants] = useState<any[]>([]);
  const [showVariantDropdown, setShowVariantDropdown] = useState(false);

  // Generate week dates
  const weekDates = useMemo(() => {
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(currentWeek);
      date.setDate(currentWeek.getDate() + i);
      dates.push(date);
    }
    return dates;
  }, [currentWeek]);

  // Fetch bookings for the current week
  const weekStart = new Date(currentWeek);
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(currentWeek);
  weekEnd.setDate(weekEnd.getDate() + 7);
  weekEnd.setHours(23, 59, 59, 999);

  const [{ data: bookings, fetching: fetchingBookings, error: bookingsError }, refetchBookings] = useFindManyAny(api.booking, {
    filter: {
      scheduledAt: {
        greaterThanOrEqual: weekStart.toISOString(),
        lessThan: weekEnd.toISOString(),
      },
      ...(selectedStaffId && { staffId: { equals: selectedStaffId } }),
      ...(selectedServiceId && { 
        variant: {
          product: {
            id: { equals: selectedServiceId }
          }
        }
      }),
      ...(selectedLocationId && { locationId: { equals: selectedLocationId } }),
    },
    select: {
      id: true,
      scheduledAt: true,
      duration: true,
      status: true,
      customerName: true,
      customerEmail: true,
      customer: {
        id: true,
        firstName: true,
        lastName: true,
        displayName: true,
        email: true,
      },
      notes: true,
      locationId: true,
      location: {
        id: true,
        name: true,
        timeZone: true,
      },
      staff: {
        id: true,
        name: true,
      },
      variant: {
        id: true,
        title: true,
        product: {
          id: true,
          title: true,
        },
      },
      totalPrice: true,
      order: {
        id: true,
        financialStatus: true,
      },
      shop: {
        id: true,
        myshopifyDomain: true,
        domain: true,
      },
    },
  });
  const bookingsList = useMemo(() => (bookings ?? []) as any[], [bookings]);

  // Fetch staff for filters
  const [{ data: staff }] = useFindManyAny(api.staff, {
    filter: { isActive: { equals: true } },
    select: {
      id: true,
      name: true,
    },
  });
  const staffList = useMemo(() => (staff ?? []) as any[], [staff]);

  // Fetch services (products with productType "Service")
  const [{ data: services }] = useFindManyAny(api.shopifyProduct, {
    filter: { 
      productType: { 
        in: ["Service", "service", "SERVICE"] 
      } 
    },
    select: {
      id: true,
      title: true,
      variants: {
        edges: {
          node: {
            id: true,
            price: true,
            title: true,
          },
        },
      },
    },
  });
  const servicesList = useMemo(() => (services ?? []) as any[], [services]);

  // Fetch locations
  const [{ data: locations }] = useFindManyAny(api.shopifyLocation, {
    filter: { 
      active: { equals: true },
      offersServices: { equals: true }
    },
    select: {
      id: true,
      name: true,
      address1: true,
      city: true,
      timeZone: true,
    },
  });
  const locationsList = useMemo(() => (locations ?? []) as any[], [locations]);

  // Fetch customers
  const [{ data: customers, error: customersError, fetching: fetchingCustomers }] = useFindManyAny(api.shopifyCustomer, {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      displayName: true,
      email: true,
    },
    search: customerSearch
  });
  const customersList = useMemo(() => (customers ?? []) as any[], [customers]);

  // Create booking action
  const [{ fetching: creatingBooking }, createBooking] = useActionAny(api.booking.create);
  
  // Update booking action
  const [{ fetching: updatingBooking }, updateBooking] = useActionAny(api.booking.update);
  
  // Delete booking action
  const [{ fetching: deletingBooking }, deleteBooking] = useActionAny(api.booking.delete);

  const locationMap = useMemo(() => {
    const map = new Map<string, any>();
    locationsList.forEach((location: any) => {
      if (location?.id) {
        map.set(location.id, location);
      }
    });
    return map;
  }, [locationsList]);

  const scheduleTimezone = useMemo(() => {
    if (selectedLocationId) {
      const selectedLocation = locationMap.get(selectedLocationId);
      if (selectedLocation?.timeZone) {
        return selectedLocation.timeZone;
      }
    }
    return locationsList[0]?.timeZone || "America/New_York";
  }, [selectedLocationId, locationMap, locationsList]);
 
  const processedBookings = useMemo(() => {
    if (!bookingsList.length) return [] as ProcessedBooking[];

    return bookingsList
      .filter((booking) => booking?.scheduledAt)
      .map((booking) => {
        const startDateInScheduleTz = convertUTCToLocationTime(new Date(booking.scheduledAt), scheduleTimezone);
        const dayKey = formatDateKey(startDateInScheduleTz);
        const startMinutes = startDateInScheduleTz.getHours() * 60 + startDateInScheduleTz.getMinutes();
        const duration = booking.duration || 60;
        const endMinutes = startMinutes + duration;

        return {
          original: booking,
          dayKey,
          startMinutes,
          endMinutes,
          duration,
        } as ProcessedBooking;
      });
  }, [bookingsList, scheduleTimezone]);

  const bookingsByDayStart = useMemo(() => {
    const map = new Map<string, Map<number, ProcessedBooking[]>>();
    processedBookings.forEach((entry) => {
      let dayMap = map.get(entry.dayKey);
      if (!dayMap) {
        dayMap = new Map();
        map.set(entry.dayKey, dayMap);
      }
      const list = dayMap.get(entry.startMinutes);
      if (list) {
        list.push(entry);
      } else {
        dayMap.set(entry.startMinutes, [entry]);
      }
    });
    return map;
  }, [processedBookings]);

  const bookingsByDaySlot = useMemo(() => {
    const map = new Map<string, Map<number, ProcessedBooking[]>>();
    processedBookings.forEach((entry) => {
      let dayMap = map.get(entry.dayKey);
      if (!dayMap) {
        dayMap = new Map();
        map.set(entry.dayKey, dayMap);
      }
      for (let minute = entry.startMinutes; minute < entry.endMinutes; minute += 30) {
        const list = dayMap.get(minute);
        if (list) {
          list.push(entry);
        } else {
          dayMap.set(minute, [entry]);
        }
      }
    });
    return map;
  }, [processedBookings]);

  // Navigation handlers
  const goToPreviousWeek = useCallback(() => {
    const prevWeek = new Date(currentWeek);
    prevWeek.setDate(prevWeek.getDate() - 7);
    setCurrentWeek(prevWeek);
  }, [currentWeek]);

  const goToNextWeek = useCallback(() => {
    const nextWeek = new Date(currentWeek);
    nextWeek.setDate(nextWeek.getDate() + 7);
    setCurrentWeek(nextWeek);
  }, [currentWeek]);

  const goToToday = useCallback(() => {
    setCurrentWeek(getWeekStart(new Date()));
  }, []);

  // Get bookings for a specific day and time slot
  const getBookingsForSlot = useCallback(
    (date: Date, hour: number, minute: number) => {
      const dayKey = formatDateKey(date);
      const daySlots = bookingsByDaySlot.get(dayKey);
      if (!daySlots) {
        return [];
      }

      const slotStart = hour * 60 + minute;
      const entries = daySlots.get(slotStart);
      if (!entries || entries.length === 0) {
        return [];
      }

      return entries.map((entry) => entry.original);
    },
    [bookingsByDaySlot]
  );



  // Helper function to calculate how many 30-minute slots a booking spans
  const getBookingSpanCount = useCallback((duration: number) => {
    return Math.ceil(duration / 30);
  }, []);

  // Handle time slot click
  const handleTimeSlotClick = useCallback((date: Date, hour: number, minute: number) => {
    const slotBookings = getBookingsForSlot(date, hour, minute);
    if (slotBookings.length === 0) {
      // Reset customer state when opening new booking modal
      setCustomerSearch("");
      setShowCustomerSuggestions(false);
      setSelectedCustomer(null);
      setSelectedTimeSlot({ date, hour, minute });
      setShowBookingModal(true);
    }
  }, [getBookingsForSlot]);

  // Handle booking creation
  const handleCreateBooking = useCallback(async () => {
    if (!selectedTimeSlot) return;

    // Get the selected location's timezone
    const selectedLocation = locationMap.get(formData.locationId);
    const locationTimezone = selectedLocation?.timeZone;

    // Create the scheduled time in location timezone, then convert to UTC
    const scheduledAtLocal = new Date(selectedTimeSlot.date);
    scheduledAtLocal.setHours(selectedTimeSlot.hour, selectedTimeSlot.minute, 0, 0);
    
    const scheduledAtUTC = locationTimezone 
      ? convertLocationTimeToUTC(scheduledAtLocal, locationTimezone)
      : scheduledAtLocal;

    // Check if scheduling in the past (convert UTC back to location time for display)
    const now = new Date();
    const nowInLocation = locationTimezone 
      ? convertUTCToLocationTime(now, locationTimezone)
      : now;
      
    if (scheduledAtLocal < nowInLocation) {
      const confirmed = confirm(
        `You are scheduling a service in the past (${scheduledAtLocal.toLocaleDateString()} at ${scheduledAtLocal.toLocaleTimeString([], {
          hour: "numeric",
          minute: "2-digit",
        })}). Are you sure you want to proceed?`
      );
      if (!confirmed) {
        return;
      }
    }

    // Form validation
    if (!formData.customerId && !formData.customerName.trim()) {
      alert("Please select a customer or provide customer name");
      return;
    }
    if (!formData.staffId) {
      alert("Please select a staff member");
      return;
    }
    if (!formData.productId) {
      alert("Please select a service");
      return;
    }
    if (!formData.locationId) {
      alert("Please select a location");
      return;
    }



    try {
      const bookingData: any = {
        scheduledAt: scheduledAtUTC.toISOString(),
        duration: parseInt(formData.duration) || 60,
        staff: { _link: formData.staffId },
        variant: { _link: formData.variantId },
        location: { _link: formData.locationId },
        notes: formData.notes,
        status: "pending",
        totalPrice: parseInt(formData.totalPrice) || 0,
      };

      // Use existing customer or new customer data
      if (formData.customerId) {
        bookingData.customer = { _link: formData.customerId };
      } else {
        bookingData.customerName = formData.customerName;
        bookingData.customerEmail = formData.customerEmail;
      }



      await createBooking(bookingData);
      
      // Force refetch bookings after creation
      await refetchBookings();
      
      setShowBookingModal(false);
      setSelectedTimeSlot(null);
      setShowNewCustomerForm(false);
      // Clear form data
      setFormData({
        customerId: "",
        customerName: "",
        customerEmail: "",
        staffId: "",
        productId: "",
        locationId: "",
        duration: "60",
        totalPrice: "0",
        notes: "",
        variantId: "",
      });
      setAvailableVariants([]);
      setShowVariantDropdown(false);
    } catch (error) {
      // Handle error silently or show user-friendly message
    }
  }, [selectedTimeSlot, createBooking, formData, locationMap]);

  // Handle form field changes
  const handleFormChange = useCallback((field: string, value: string) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
  }, []);

  // Handle modal close
  const handleModalClose = useCallback(() => {
    setShowBookingModal(false);
    setSelectedTimeSlot(null);
    setShowNewCustomerForm(false);
    setCustomerSearch("");
    setShowCustomerSuggestions(false);
    setSelectedCustomer(null);
    // Clear form data
    setFormData({
      customerId: "",
      customerName: "",
      customerEmail: "",
      staffId: "",
      productId: "",
      locationId: "",
      duration: "60",
      totalPrice: "0",
      notes: "",
      variantId: "",
    });
    setAvailableVariants([]);
    setShowVariantDropdown(false);
  }, []);

  // Handle customer search
  const handleCustomerSearchChange = useCallback((value: string) => {
    setCustomerSearch(value);
    setShowCustomerSuggestions(value.length > 0);
    if (value.length === 0) {
      setSelectedCustomer(null);
      setFormData(prev => ({ ...prev, customerId: "", customerName: "", customerEmail: "" }));
    }
  }, []);

  // Handle customer selection from suggestions
  const handleCustomerSelect = useCallback((customer: any) => {
    setSelectedCustomer(customer);
    setCustomerSearch(customer.displayName || `${customer.firstName || ""} ${customer.lastName || ""}`.trim() || customer.email);
    setShowCustomerSuggestions(false);
    setShowNewCustomerForm(false);
    setFormData(prev => ({ ...prev, customerId: customer.id, customerName: "", customerEmail: "" }));
  }, []);

  // Handle create new customer
  const handleCreateNewCustomer = useCallback(() => {
    setShowNewCustomerForm(true);
    setShowCustomerSuggestions(false);
    setSelectedCustomer(null);
    setFormData(prev => ({ ...prev, customerId: "", customerName: customerSearch, customerEmail: "" }));
  }, [customerSearch]);

  // Handle cancel new customer form
  const handleCancelNewCustomer = useCallback(() => {
    setShowNewCustomerForm(false);
    setCustomerSearch("");
    setSelectedCustomer(null);
    setFormData(prev => ({ ...prev, customerId: "", customerName: "", customerEmail: "" }));
  }, []);

  // Handle booking click for editing
  const handleBookingClick = useCallback((booking: any) => {
    setSelectedBooking(booking);
    setShowEditModal(true);
  }, []);

  // Handle booking update
  const handleUpdateBooking = useCallback(async (updatedData: any) => {
    if (!selectedBooking) return;

    try {
      await updateBooking({
        id: selectedBooking.id,
        ...updatedData,
      });
      
      // Force refetch bookings after update
      await refetchBookings();
      
      setShowEditModal(false);
      setSelectedBooking(null);
    } catch (error) {
      // Handle error silently or show user-friendly message
    }
  }, [selectedBooking, updateBooking]);

  // Handle booking deletion
  const handleDeleteBooking = useCallback(async () => {
    if (!selectedBooking) return;

    if (confirm("Are you sure you want to delete this booking?")) {
      try {
        await deleteBooking({ id: selectedBooking.id });
        
        // Force refetch bookings after deletion
        await refetchBookings();
        
        setShowEditModal(false);
        setSelectedBooking(null);
      } catch (error) {
        // Handle error silently or show user-friendly message
      }
    }
  }, [selectedBooking, deleteBooking]);

  // Handle edit modal close
  const handleEditModalClose = useCallback(() => {
    setShowEditModal(false);
    setSelectedBooking(null);
  }, []);

  // Staff and service options for filters
  const staffOptions = [
    { label: "All Staff", value: "" },
    ...staffList.map((s: any) => ({ label: s.name, value: s.id })),
  ];

  const serviceOptions = [
    { label: "All Services", value: "" },
    ...servicesList.map((s: any) => {
      const firstVariant = s.variants?.edges?.[0]?.node;
      const price = firstVariant?.price ? `$${firstVariant.price}` : 'Price TBD';
      return { label: `${s.title} - ${price}`, value: s.id };
    }),
  ];

  const locationFilterOptions = [
    { label: "All Locations", value: "" },
    ...locationsList.map((l: any) => ({
      label: l.name + (l.address1 || l.city ? ` (${[l.address1, l.city].filter(Boolean).join(", ")})` : ""),
      value: l.id,
    })),
  ];

  const locationOptions = [
    { label: "Select location", value: "" },
    ...locationsList.map((l: any) => ({
      label: l.name + (l.address1 || l.city ? ` (${[l.address1, l.city].filter(Boolean).join(", ")})` : ""),
      value: l.id,
    })),
  ];

  // Helper function to get service price
  const getServicePrice = useCallback((serviceId: string, variantId?: string) => {
    if (!serviceId) return 0;
    const service = servicesList.find((s: any) => s.id === serviceId);
    if (!service?.variants?.edges) return 0;
    
    const variant = variantId 
      ? service.variants.edges.find((edge: any) => edge.node.id === variantId)?.node
      : service.variants.edges[0]?.node;
    
    return variant?.price ? parseFloat(variant.price) : 0;
  }, [servicesList]);

  // Helper function to get variant duration
  const getVariantDuration = useCallback((serviceId: string, variantId: string) => {
    if (!serviceId || !variantId) return 15;
    const service = servicesList.find((s: any) => s.id === serviceId);
    const variant = service?.variants?.edges?.find((edge: any) => edge.node.id === variantId)?.node;
    return variant?.title ? extractDurationFromTitle(variant.title) : 15;
  }, [servicesList]);

  // Handle service selection and variant management
  const handleServiceChange = useCallback((serviceId: string) => {
    handleFormChange("productId", serviceId);
    
    if (!serviceId) {
      setAvailableVariants([]);
      setShowVariantDropdown(false);
      handleFormChange("variantId", "");
      handleFormChange("duration", "15");
      handleFormChange("totalPrice", "0");
      return;
    }

    const service = servicesList.find((s: any) => s.id === serviceId);
    const variants = service?.variants?.edges?.map((edge: any) => edge.node) || [];
    
    setAvailableVariants(variants);
    
    if (variants.length === 0) {
      // No variants found, use defaults
      setShowVariantDropdown(false);
      handleFormChange("variantId", "");
      handleFormChange("duration", "15");
      handleFormChange("totalPrice", "0");
    } else if (variants.length === 1) {
      // Single variant, auto-select it
      const variant = variants[0];
      setShowVariantDropdown(false);
      handleFormChange("variantId", variant.id);
      handleFormChange("duration", extractDurationFromTitle(variant.title || "").toString());
      const price = getServicePrice(serviceId, variant.id);
      handleFormChange("totalPrice", price.toString());
    } else {
      // Multiple variants, show dropdown
      setShowVariantDropdown(true);
      handleFormChange("variantId", "");
      handleFormChange("duration", "15");
      handleFormChange("totalPrice", "0");
    }
  }, [servicesList, handleFormChange, getServicePrice]);

  // Handle variant selection
  const handleVariantChange = useCallback((variantId: string) => {
    handleFormChange("variantId", variantId);
    
    if (!variantId || !formData.productId) {
      handleFormChange("duration", "15");
      handleFormChange("totalPrice", "0");
      return;
    }

    const duration = getVariantDuration(formData.productId, variantId);
    const price = getServicePrice(formData.productId, variantId);
    
    handleFormChange("duration", duration.toString());
    handleFormChange("totalPrice", price.toString());
  }, [formData.productId, getVariantDuration, getServicePrice, handleFormChange]);

  // Auto-select first service when services are loaded
  useEffect(() => {
    if (servicesList.length > 0 && !formData.productId) {
      const firstService = servicesList[0];
      handleServiceChange(firstService.id);
    }
  }, [servicesList, formData.productId, handleServiceChange]);

  // Auto-select single location when modal opens
  useEffect(() => {
    if (locationsList.length === 1 && !formData.locationId && showBookingModal) {
      handleFormChange("locationId", locationsList[0].id);
    }
  }, [locationsList, formData.locationId, showBookingModal, handleFormChange]);

  // Auto-select single staff when modal opens
  useEffect(() => {
    if (staffList.length === 1 && !formData.staffId && showBookingModal) {
      handleFormChange("staffId", staffList[0].id);
    }
  }, [staffList, formData.staffId, showBookingModal, handleFormChange]);

  return (
    <Page
      title="Schedule"
      primaryAction={{
        content: "New Booking",
        icon: PlusIcon as any,
        onAction: () => {
          // Reset customer state when opening new booking modal
          setCustomerSearch("");
          setShowCustomerSuggestions(false);
          setSelectedCustomer(null);
          setShowBookingModal(true);
        },
      }}
    >
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              {/* Header with navigation and filters */}
              <InlineStack align="space-between" blockAlign="center">
                <InlineStack gap="200">
                  <ButtonGroup>
                    <Button icon={ChevronLeftIcon as any} onClick={goToPreviousWeek} />
                    <Button onClick={goToToday}>Today</Button>
                    <Button icon={ChevronRightIcon as any} onClick={goToNextWeek} />
                  </ButtonGroup>
                  <Text as="h2" variant="headingMd">
                    {mounted ? `${weekDates[0].toLocaleDateString()} - ${weekDates[6].toLocaleDateString()}` : 'Loading...'}
                  </Text>
                </InlineStack>
                <InlineStack gap="200">
                  <Box minWidth="120px">
                    <Select
                      label=""
                      placeholder="Filter by staff"
                      options={staffOptions}
                      value={selectedStaffId}
                      onChange={setSelectedStaffId}
                    />
                  </Box>
                  <Box minWidth="120px">
                    <Select
                      label=""
                      placeholder="Filter by service"
                      options={serviceOptions}
                      value={selectedServiceId}
                      onChange={setSelectedServiceId}
                    />
                  </Box>
                  {locations && locations.length > 1 && (
                    <Box minWidth="120px">
                      <Select
                        label=""
                        placeholder="Filter by location"
                        options={locationFilterOptions}
                        value={selectedLocationId}
                        onChange={setSelectedLocationId}
                      />
                    </Box>
                  )}
                </InlineStack>
              </InlineStack>



              {/* Calendar Grid */}
              <Box padding="200">
                <div style={{ backgroundColor: "#e1e3e5" }}>
                  {/* Header row */}
                  <div style={{ display: "flex", gap: "1px", marginBottom: "1px" }}>
                    <div style={{ width: "80px", backgroundColor: "white", padding: "8px", fontWeight: "bold", position: "relative" }}>
                      Time
                      {mounted && (
                        <div
                          style={{
                            fontSize: "0.7em",
                            color: "#666",
                            fontWeight: "normal",
                            marginTop: "2px",
                          }}
                        >
                          {getTimezoneCode(scheduleTimezone)}
                        </div>
                      )}
                    </div>
                    <div style={{ display: "flex", flex: 1, gap: "1px" }}>
                      {weekDates.map((date) => (
                        <div
                          key={date.toDateString()}
                          style={{
                            flex: 1,
                            minWidth: 0,
                            backgroundColor: "white",
                            padding: "8px",
                            textAlign: "center",
                            fontWeight: "bold",
                          }}
                        >
                          <div>{mounted ? date.toLocaleDateString("en-US", { weekday: "short" }) : 'Loading...'}</div>
                          <div style={{ fontSize: "0.9em", color: "#666" }}>{mounted ? date.getDate().toString() : '...'}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Main calendar body */}
                  <div style={{ display: "flex", gap: "1px" }}>
                    {/* Time labels column */}
                    <div style={{ width: "80px", display: "flex", flexDirection: "column", gap: "1px" }}>
                      {timeSlots.map(({ hour, minute }) => (
                        <div
                          key={`${hour}-${minute}`}
                          style={{
                            height: "50px",
                            backgroundColor: "white",
                            border: "1px solid transparent",
                            padding: "8px",
                            fontSize: "0.8em",
                            color: "#666",
                            textAlign: "right",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "flex-end",
                            boxSizing: "border-box",
                          }}
                        >
                          {formatTime(hour, minute)}
                        </div>
                      ))}
                    </div>

                    {/* Day columns container */}
                    <div style={{ display: "flex", flex: 1, gap: "1px" }}>
                      {weekDates.map((date) => {
                        // Helper function to render slots for this specific day
                        const renderDaySlots = () => {
                          const daySlots: JSX.Element[] = [];
                          const occupiedSlots = new Set<number>();
                          const dayKey = formatDateKey(date);
                          const startingMap = bookingsByDayStart.get(dayKey);
                          const slotMap = bookingsByDaySlot.get(dayKey);

                          for (let i = 0; i < timeSlots.length; i++) {
                            const { hour, minute } = timeSlots[i];
                            const slotStart = hour * 60 + minute;

                            if (occupiedSlots.has(i)) {
                              continue;
                            }

                            const startingEntries = startingMap?.get(slotStart) || [];

                            if (startingEntries.length > 0) {
                              startingEntries.forEach((entry) => {
                                const slotsToOccupy = Math.ceil(entry.duration / 30);
                                for (let j = 1; j < slotsToOccupy && i + j < timeSlots.length; j++) {
                                  occupiedSlots.add(i + j);
                                }
                              });

                              const maxSlotsSpanned = Math.max(
                                ...startingEntries.map((entry) => Math.ceil(entry.duration / 30))
                              );
                              const height = (maxSlotsSpanned * 50) + (maxSlotsSpanned - 1);

                              daySlots.push(
                                <div
                                  key={`${date.toDateString()}-${hour}-${minute}`}
                                  style={{
                                    height: `${height}px`,
                                    display: "flex",
                                    gap: "2px",
                                    boxSizing: "border-box",
                                    overflow: "hidden",
                                  }}
                                >
                                  {startingEntries.map((entry, index) => {
                                    const booking = entry.original;
                                    const bookingSlotsSpanned = Math.ceil(entry.duration / 30);
                                    const bookingHeight = (bookingSlotsSpanned * 50) + (bookingSlotsSpanned - 1);

                                    return (
                                      <div
                                        key={`${booking.id}-${index}`}
                                        style={{
                                          height: `${bookingHeight}px`,
                                          backgroundColor: "#e3f2fd",
                                          border: "1px solid #0070f3",
                                          borderRadius: "4px",
                                          cursor: "pointer",
                                          overflow: "hidden",
                                          boxSizing: "border-box",
                                          flex: 1,
                                          minWidth: 0,
                                        }}
                                        onClick={() => handleBookingClick(booking)}
                                        title={`${date.toDateString()} ${formatTime(hour, minute)} - ${booking?.variant?.product?.title} (${booking?.duration}min)`}
                                      >
                                        <Box padding={"50" as any}>
                                          <BlockStack gap={"25" as any}>
                                            {(() => {
                                              const paymentStatus = booking.order?.financialStatus
                                                ? (booking.order.financialStatus === "paid" ? "paid" : "not_paid")
                                                : booking.status;
                                              return (
                                                <Badge tone={getStatusColor(paymentStatus) as any}>
                                                  {paymentStatus}
                                                </Badge>
                                              );
                                            })()}
                                            <Text as="p" variant="bodyXs" fontWeight="bold">
                                              {booking.variant?.product?.title}
                                            </Text>
                                            <Text as="p" variant="bodyXs">
                                              {booking.customer?.displayName ||
                                                (booking.customer?.firstName && booking.customer?.lastName
                                                  ? `${booking.customer.firstName} ${booking.customer.lastName}`
                                                  : "") ||
                                                booking.customerName ||
                                                "No customer"}
                                            </Text>
                                            <Text as="p" variant="bodyXs" tone="subdued">
                                              {booking.staff?.name}
                                            </Text>
                                            <Text as="p" variant="bodyXs" tone="subdued">
                                              {booking.duration}min
                                            </Text>
                                          </BlockStack>
                                        </Box>
                                      </div>
                                    );
                                  })}
                                </div>
                              );

                              continue;
                            }

                            const continuingEntries = slotMap?.get(slotStart);
                            if (continuingEntries && continuingEntries.length > 0) {
                              continue;
                            }

                            daySlots.push(
                              <div
                                key={`${date.toDateString()}-${hour}-${minute}`}
                                style={{
                                  height: "50px",
                                  backgroundColor: "white",
                                  cursor: "pointer",
                                  border: "1px solid transparent",
                                  boxSizing: "border-box",
                                }}
                                onClick={() => handleTimeSlotClick(date, hour, minute)}
                                title={`${date.toDateString()} ${formatTime(hour, minute)} - Click to book`}
                              />
                            );
                          }

                          return daySlots;
                        };

                        return (
                          <div
                            key={date.toDateString()}
                            style={{
                              flex: 1,
                              minWidth: 0,
                              display: "flex",
                              flexDirection: "column",
                              gap: "1px",
                              overflow: "hidden",
                            }}
                          >
                            {renderDaySlots()}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </Box>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>

      {/* Booking Modal */}
      <Modal
        open={showBookingModal}
        onClose={handleModalClose}
        title="New Booking"
        primaryAction={{
          content: creatingBooking ? "Creating..." : "Create Booking",
          loading: creatingBooking,
          onAction: handleCreateBooking,
        }}
        secondaryActions={[
          {
            content: "Cancel",
            onAction: handleModalClose,
          },
        ]}
      >
        <Modal.Section>
          <BlockStack gap="400">
            {selectedTimeSlot && (
              <Card>
                <Text as="p" variant="bodyMd" fontWeight="bold">
                  {mounted ? selectedTimeSlot.date.toLocaleDateString() : 'Loading...'} at{" "}
                  {formatTime(selectedTimeSlot.hour, selectedTimeSlot.minute)}
                </Text>
              </Card>
            )}

            {!showNewCustomerForm ? (
              <Box position="relative">
                <TextField
                  label="Search for customer"
                  value={customerSearch}
                  onChange={handleCustomerSearchChange}
                  placeholder="Type to search customers..."
                  autoComplete="off"
                  requiredIndicator
                />

                {/* Selected Customer Display */}
                {selectedCustomer && (
                  <Box paddingBlockStart="200">
                    <Card>
                      <BlockStack gap="100">
                        <Text as="p" variant="bodyMd" fontWeight="bold">
                          Selected: {selectedCustomer.displayName || `${selectedCustomer.firstName || ""} ${selectedCustomer.lastName || ""}`.trim()}
                        </Text>
                        {selectedCustomer.email && (
                          <Text as="p" variant="bodyMd" tone="subdued">
                            {selectedCustomer.email}
                          </Text>
                        )}
                      </BlockStack>
                    </Card>
                  </Box>
                )}

                {/* Customer Suggestions */}
                {showCustomerSuggestions && (
                  <Box paddingBlockStart="100">
                    <div
                      style={{
                        position: "absolute",
                        top: "100%",
                        left: 0,
                        right: 0,
                        zIndex: 1000,
                        backgroundColor: "white",
                        border: "1px solid #ccc",
                        borderRadius: "4px",
                        maxHeight: "200px",
                        overflowY: "auto",
                      }}
                    >
                    {customersList.length ? (
                      <BlockStack gap="0">
                        {customersList.slice(0, 5).map((customer: any) => (
                          <div
                            key={customer.id}
                            style={{
                              padding: "var(--p-space-200)",
                              cursor: "pointer",
                              borderBottom: "1px solid #f0f0f0",
                            }}
                            onClick={() => handleCustomerSelect(customer)}
                          >
                            <BlockStack gap="100">
                              <Text as="p" variant="bodyMd">
                                {customer.displayName || `${customer.firstName || ""} ${customer.lastName || ""}`.trim() || "Unnamed Customer"}
                              </Text>
                              {customer.email && (
                                <Text as="p" variant="bodyMd" tone="subdued">
                                  {customer.email}
                                </Text>
                              )}
                            </BlockStack>
                          </div>
                        ))}
                        <div
                          style={{
                            padding: "var(--p-space-200)",
                            cursor: "pointer",
                            backgroundColor: "#f9f9f9",
                          }}
                          onClick={handleCreateNewCustomer}
                        >
                          <Text as="p" variant="bodyMd">
                            + Create new customer
                          </Text>
                        </div>
                      </BlockStack>
                    ) : (
                      <div style={{ padding: "var(--p-space-200)" }}>
                        <BlockStack gap="200">
                          <Text as="p" variant="bodyMd">
                            No customers found
                          </Text>
                          <Button fullWidth onClick={handleCreateNewCustomer}>
                            Create new customer
                          </Button>
                        </BlockStack>
                      </div>
                    )}
                    </div>
                  </Box>
                )}
              </Box>
            ) : (
              <BlockStack gap="300">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h3" variant="headingSm">New Customer</Text>
                  <Button variant="plain" onClick={handleCancelNewCustomer}>Cancel</Button>
                </InlineStack>
                <InlineStack gap="200">
                  <Box width="50%">
                    <TextField
                      label="Customer Name"
                      value={formData.customerName}
                      onChange={(value) => handleFormChange("customerName", value)}
                      autoComplete="off"
                      requiredIndicator
                    />
                  </Box>
                  <Box width="50%">
                    <TextField
                      label="Customer Email"
                      value={formData.customerEmail}
                      onChange={(value) => handleFormChange("customerEmail", value)}
                      type="email"
                      autoComplete="off"
                    />
                  </Box>
                </InlineStack>
              </BlockStack>
            )}

            <InlineStack gap="200">
              <Box width="50%">
                <Select
                  label="Staff Member"
                  value={formData.staffId}
                  onChange={(value) => {
                    handleFormChange("staffId", value);
                  }}
                  options={[
                    { label: "Select staff member", value: "" },
                    ...staffList.map((s: any) => ({ label: s.name, value: s.id })),
                  ]}
                  requiredIndicator
                />
              </Box>
              <Box width="50%">
                <Select
                  label="Service"
                  value={formData.productId}
                  onChange={handleServiceChange}
                  options={[
                    { label: "Select service", value: "" },
                    ...servicesList.map((s: any) => {
                      const firstVariant = s.variants?.edges?.[0]?.node;
                      const price = firstVariant?.price ? `$${firstVariant.price}` : "Price TBD";
                      return { label: `${s.title} - ${price}`, value: s.id };
                    }),
                  ]}
                  requiredIndicator
                />
              </Box>
            </InlineStack>

            <Select
              label="Location"
              value={formData.locationId}
              onChange={(value) => handleFormChange("locationId", value)}
              options={locationOptions}
              requiredIndicator
            />

            {/* Variant Selection or Duration Display */}
            {showVariantDropdown ? (
              <Select
                label="Service Duration"
                value={formData.variantId}
                onChange={handleVariantChange}
                options={[
                  { label: "Select duration", value: "" },
                  ...availableVariants.map((variant: any) => {
                    const duration = extractDurationFromTitle(variant.title || "");
                    return { 
                      label: variant.title || `${duration} min`, 
                      value: variant.id 
                    };
                  })
                ]}
                requiredIndicator
                helpText="Select the duration variant for this service"
              />
            ) : (
              <InlineStack gap="200">
                <Box width="50%">
                  <TextField
                    label="Duration (minutes)"
                    value={formData.duration}
                    readOnly
                    disabled
                    autoComplete="off"
                    helpText="Duration is set based on selected service variant"
                  />
                </Box>
                <Box width="50%">
                  <TextField
                    label="Total Price"
                    value={`$${formData.totalPrice}`}
                    readOnly
                    disabled
                    autoComplete="off"
                    helpText="Price is automatically calculated based on selected service"
                  />
                </Box>
              </InlineStack>
            )}

            {/* Show price separately if variant dropdown is shown */}
            {showVariantDropdown && (
              <TextField
                label="Total Price"
                value={`$${formData.totalPrice}`}
                readOnly
                disabled
                autoComplete="off"
                helpText="Price will be set when you select a duration variant"
              />
            )}

            <TextField
              label="Notes"
              value={formData.notes}
              onChange={(value) => handleFormChange("notes", value)}
              multiline={3}
              autoComplete="off"
              placeholder="Any special requirements or notes..."
            />
          </BlockStack>
        </Modal.Section>
      </Modal>

      {/* Edit Booking Modal */}
      <Modal
        open={showEditModal}
        onClose={handleEditModalClose}
        title="Edit Booking"
        primaryAction={{
          content: updatingBooking ? "Updating..." : "Update Booking",
          loading: updatingBooking,
          onAction: () => {
            if (selectedBooking) {
              handleUpdateBooking({
                status: selectedBooking.status,
                notes: selectedBooking.notes,
                totalPrice: selectedBooking.totalPrice,
              });
            }
          },
        }}
        secondaryActions={[
          {
            content: deletingBooking ? "Deleting..." : "Delete",
            loading: deletingBooking,
            destructive: true,
            onAction: handleDeleteBooking,
          },
          {
            content: "Cancel",
            onAction: handleEditModalClose,
          },
        ]}
      >
        <Modal.Section>
          {selectedBooking && (
            <BlockStack gap="400">
              {/* Booking Details */}
              <Card>
                <BlockStack gap="300">
                  <Text as="h3" variant="headingSm">Booking Details</Text>
                  <InlineStack gap="400">
                    <BlockStack gap="100">
                      <Text as="p" variant="bodyMd" fontWeight="bold">Date & Time</Text>
                      <Text as="p" variant="bodyMd">
                        {mounted
                          ? (() => {
                              const utcDate = new Date(selectedBooking.scheduledAt);
                              const bookingLocation = locationMap.get(selectedBooking.location?.id || selectedBooking.locationId);
                              const locationTimezone = bookingLocation?.timeZone;
                              return formatDateTimeInTimezone(utcDate, locationTimezone);
                            })()
                          : "Loading..."}
                      </Text>
                    </BlockStack>
                    <BlockStack gap="100">
                      <Text as="p" variant="bodyMd" fontWeight="bold">Duration</Text>
                      <Text as="p" variant="bodyMd">{selectedBooking.duration} minutes</Text>
                    </BlockStack>
                  </InlineStack>
                  <InlineStack gap="400">
                    <BlockStack gap="100">
                      <Text as="p" variant="bodyMd" fontWeight="bold">Service</Text>
                      <Text as="p" variant="bodyMd">{selectedBooking.variant?.product?.title}</Text>
                    </BlockStack>
                    <BlockStack gap="100">
                      <Text as="p" variant="bodyMd" fontWeight="bold">Staff</Text>
                      <Text as="p" variant="bodyMd">{selectedBooking.staff?.name}</Text>
                    </BlockStack>
                  </InlineStack>
                  <InlineStack gap="400">
                    <BlockStack gap="100">
                      <Text as="p" variant="bodyMd" fontWeight="bold">Customer</Text>
                      <Text as="p" variant="bodyMd">
                        {selectedBooking.customer?.displayName || 
                         (selectedBooking.customer?.firstName && selectedBooking.customer?.lastName ? 
                          `${selectedBooking.customer.firstName} ${selectedBooking.customer.lastName}` : '') || 
                         selectedBooking.customerName || 'No customer'}
                      </Text>
                      {(selectedBooking.customer?.email || selectedBooking.customerEmail) && (
                        <Text as="p" variant="bodyMd" tone="subdued">
                          {selectedBooking.customer?.email || selectedBooking.customerEmail}
                        </Text>
                      )}
                    </BlockStack>
                    <BlockStack gap="100">
                      <Text as="p" variant="bodyMd" fontWeight="bold">Total Price</Text>
                      <Text as="p" variant="bodyMd">${selectedBooking.totalPrice}</Text>
                    </BlockStack>
                  </InlineStack>
                  {locations && locations.length > 1 && (
                    <InlineStack gap="400">
                      <BlockStack gap="100">
                        <Text as="p" variant="bodyMd" fontWeight="bold">Location</Text>
                        <Text as="p" variant="bodyMd">
                          {selectedBooking.location?.name || 'No location'}
                        </Text>
                      </BlockStack>
                    </InlineStack>
                  )}
                </BlockStack>
              </Card>

              {/* Editable Fields */}
              <BlockStack gap="300">
                <Text as="h3" variant="headingSm">Edit Booking</Text>
                
                {selectedBooking?.order ? (
                  <BlockStack gap="200">
                    <Text as="p" variant="bodyMd" fontWeight="bold">Payment Status</Text>
                    <Text as="p" variant="bodyMd">
                      This booking's payment status is linked to its Shopify order and can't be edited here.
                    </Text>
                    <Button
                      url={`https://admin.shopify.com/store/${(() => {
                        const domain = selectedBooking.shop?.myshopifyDomain || selectedBooking.shop?.domain;
                        if (!domain) return 'admin.shopify.com';
                        // Remove .myshopify.com suffix if present
                        return domain.replace('.myshopify.com', '');
                      })()}/orders/${selectedBooking.order?.legacyResourceId || selectedBooking.order?.id}`}
                      target="_blank"
                    >
                      View Order
                    </Button>
                  </BlockStack>
                ) : (
                  <Select
                    label="Payment Status"
                    value={selectedBooking.status}
                    onChange={(value) => setSelectedBooking((prev: any) => ({ ...prev, status: value }))}
                    options={[
                      { label: "Pending", value: "pending" },
                      { label: "Paid", value: "paid" },
                      { label: "Not Paid", value: "not_paid" },
                    ]}
                  />
                )}

                <TextField
                  label="Notes"
                  value={selectedBooking.notes || ""}
                  onChange={(value) => setSelectedBooking((prev: any) => ({ ...prev, notes: value }))}
                  multiline={3}
                  autoComplete="off"
                  placeholder="Any special requirements or notes..."
                />
              </BlockStack>
            </BlockStack>
          )}
        </Modal.Section>
      </Modal>
      <FooterHelp>
        Learn more about <Link url="https://thesimplybookapp.com/docs/#schedule-management">SimplyBook schedule management</Link>.
      </FooterHelp>
    </Page>
  );
}

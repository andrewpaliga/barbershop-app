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
  EmptyState
} from "@shopify/polaris";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CalendarIcon,
  PlusIcon
} from "@shopify/polaris-icons";
import { useFindMany, useAction } from "@gadgetinc/react";
import { api } from "../api";

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

// Get booking status color
const getStatusColor = (status: string) => {
  switch (status) {
    case "confirmed":
      return "success";
    case "pending":
      return "warning";
    case "completed":
      return "info";
    case "cancelled":
      return "critical";
    case "no_show":
      return "critical";
    default:
      return "info";
  }
};

export default function SchedulePage() {
  const [currentWeek, setCurrentWeek] = useState(() => getWeekStart(new Date()));
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [selectedServiceId, setSelectedServiceId] = useState("");
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

  const [{ data: bookings, fetching: fetchingBookings }] = useFindMany(api.booking, {
    filter: {
      scheduledAt: {
        greaterThanOrEqual: weekStart.toISOString(),
        lessThan: weekEnd.toISOString(),
      },
      ...(selectedStaffId && { staffId: { equals: selectedStaffId } }),
      ...(selectedServiceId && { productId: { equals: selectedServiceId } }),
    },
    select: {
      id: true,
      scheduledAt: true,
      duration: true,
      status: true,
      customerName: true,
      customerEmail: true,
      notes: true,
      staff: {
        id: true,
        name: true,
      },
      product: {
        id: true,
        title: true,
      },
      totalPrice: true,
    },
  });

  // Fetch staff for filters
  const [{ data: staff }] = useFindMany(api.staff, {
    filter: { isActive: { equals: true } },
    select: {
      id: true,
      name: true,
      location: {
        id: true,
        name: true,
      },
    },
  });

  // Fetch services (products marked as barber services)
  const [{ data: services }] = useFindMany(api.shopifyProduct, {
    filter: { isBarberService: { equals: true } },
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

  // Fetch locations
  const [{ data: locations }] = useFindMany(api.shopifyLocation, {
    filter: { active: { equals: true } },
    select: {
      id: true,
      name: true,
      address1: true,
      city: true,
    },
  });

  // Fetch customers
  const [{ data: customers, error: customersError, fetching: fetchingCustomers }] = useFindMany(api.shopifyCustomer, {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      displayName: true,
      email: true,
    },
    search: customerSearch
  });

  // Debug logging for customers data
  useEffect(() => {
    console.log("=== CUSTOMER DEBUG INFO ===");
    console.log("Customers data:", customers);
    console.log("Customers count:", customers?.length || 0);
    console.log("Customers error:", customersError);
    console.log("Fetching customers:", fetchingCustomers);
    if (customers && customers.length > 0) {
      console.log("Sample customer structure:", customers[0]);
      console.log("All customers detailed:", customers.map(c => ({
        id: c.id,
        firstName: c.firstName,
        lastName: c.lastName,
        displayName: c.displayName,
        email: c.email
      })));
    }
    console.log("=== END CUSTOMER DEBUG ===");
  }, [customers, customersError, fetchingCustomers]);

  // Create booking action
  const [{ fetching: creatingBooking }, createBooking] = useAction(api.booking.create);
  
  // Update booking action
  const [{ fetching: updatingBooking }, updateBooking] = useAction(api.booking.update);
  
  // Delete booking action
  const [{ fetching: deletingBooking }, deleteBooking] = useAction(api.booking.delete);

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
      if (!bookings) return [];

      return bookings.filter((booking) => {
        const bookingDate = new Date(booking.scheduledAt);
        return (
          bookingDate.getDate() === date.getDate() &&
          bookingDate.getMonth() === date.getMonth() &&
          bookingDate.getFullYear() === date.getFullYear() &&
          bookingDate.getHours() === hour &&
          bookingDate.getMinutes() === minute
        );
      });
    },
    [bookings]
  );

  // Handle time slot click
  const handleTimeSlotClick = useCallback((date: Date, hour: number, minute: number) => {
    const slotBookings = getBookingsForSlot(date, hour, minute);
    if (slotBookings.length === 0) {
      setSelectedTimeSlot({ date, hour, minute });
      setShowBookingModal(true);
    }
  }, [getBookingsForSlot]);

  // Handle booking creation
  const handleCreateBooking = useCallback(async () => {
    if (!selectedTimeSlot) return;

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

    const scheduledAt = new Date(selectedTimeSlot.date);
    scheduledAt.setHours(selectedTimeSlot.hour, selectedTimeSlot.minute, 0, 0);

    try {
      const bookingData: any = {
        scheduledAt: scheduledAt.toISOString(),
        duration: parseInt(formData.duration) || 60,
        staff: { _link: formData.staffId },
        product: { _link: formData.productId },
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
      console.error("Failed to create booking:", error);
    }
  }, [selectedTimeSlot, createBooking, formData]);

  // Handle form field changes
  const handleFormChange = useCallback((field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
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
    console.log("=== CUSTOMER SEARCH CHANGE ===");
    console.log("Search value:", value);
    console.log("Current customers:", customers);

    try {
      setCustomerSearch(value);
      setShowCustomerSuggestions(value.length > 0);
      if (value.length === 0) {
        setSelectedCustomer(null);
        setFormData(prev => ({ ...prev, customerId: "", customerName: "", customerEmail: "" }));
      }
      console.log("Search change completed successfully");
    } catch (error) {
      console.error("Error in handleCustomerSearchChange:", error);
    }
    console.log("=== END SEARCH CHANGE ===");
  }, [customers]);

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
      setShowEditModal(false);
      setSelectedBooking(null);
    } catch (error) {
      console.error("Failed to update booking:", error);
    }
  }, [selectedBooking, updateBooking]);

  // Handle booking deletion
  const handleDeleteBooking = useCallback(async () => {
    if (!selectedBooking) return;

    if (confirm("Are you sure you want to delete this booking?")) {
      try {
        await deleteBooking({ id: selectedBooking.id });
        setShowEditModal(false);
        setSelectedBooking(null);
      } catch (error) {
        console.error("Failed to delete booking:", error);
      }
    }
  }, [selectedBooking, deleteBooking]);

  // Handle edit modal close
  const handleEditModalClose = useCallback(() => {
    setShowEditModal(false);
    setSelectedBooking(null);
  }, []);

  const timeSlots = generateTimeSlots();

  // Staff and service options for filters
  const staffOptions = [
    { label: "All Staff", value: "" },
    ...(staff?.map((s) => ({ label: s.name, value: s.id })) || []),
  ];

  const serviceOptions = [
    { label: "All Services", value: "" },
    ...(services?.map((s) => {
      const firstVariant = s.variants?.edges?.[0]?.node;
      const price = firstVariant?.price ? `$${firstVariant.price}` : 'Price TBD';
      return { label: `${s.title} - ${price}`, value: s.id };
    }) || []),
  ];

  const locationOptions = [
    { label: "Select location", value: "" },
    ...(locations?.map((l) => ({ 
      label: l.name + (l.address1 || l.city ? ` (${[l.address1, l.city].filter(Boolean).join(", ")})` : ""), 
      value: l.id 
    })) || []),
  ];

  // Helper function to get service price
  const getServicePrice = useCallback((serviceId: string, variantId?: string) => {
    if (!services || !serviceId) return 0;
    const service = services.find(s => s.id === serviceId);
    if (!service?.variants?.edges) return 0;
    
    const variant = variantId 
      ? service.variants.edges.find(edge => edge.node.id === variantId)?.node
      : service.variants.edges[0]?.node;
    
    return variant?.price ? parseFloat(variant.price) : 0;
  }, [services]);

  // Helper function to get variant duration
  const getVariantDuration = useCallback((serviceId: string, variantId: string) => {
    if (!services || !serviceId || !variantId) return 15;
    const service = services.find(s => s.id === serviceId);
    const variant = service?.variants?.edges?.find(edge => edge.node.id === variantId)?.node;
    return variant?.title ? extractDurationFromTitle(variant.title) : 15;
  }, [services]);

  // Handle service selection and variant management
  const handleServiceChange = useCallback((serviceId: string) => {
    handleFormChange("productId", serviceId);
    
    if (!services || !serviceId) {
      setAvailableVariants([]);
      setShowVariantDropdown(false);
      handleFormChange("variantId", "");
      handleFormChange("duration", "15");
      handleFormChange("totalPrice", "0");
      return;
    }

    const service = services.find(s => s.id === serviceId);
    const variants = service?.variants?.edges?.map(edge => edge.node) || [];
    
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
  }, [services, handleFormChange, getServicePrice]);

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
    if (services && services.length > 0 && !formData.productId) {
      const firstService = services[0];
      handleServiceChange(firstService.id);
    }
  }, [services, formData.productId, handleServiceChange]);

  return (
    <Page
      title="Schedule"
      primaryAction={{
        content: "New Booking",
        icon: PlusIcon,
        onAction: () => setShowBookingModal(true),
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
                    <Button icon={ChevronLeftIcon} onClick={goToPreviousWeek} />
                    <Button onClick={goToToday}>Today</Button>
                    <Button icon={ChevronRightIcon} onClick={goToNextWeek} />
                  </ButtonGroup>
                  <Text as="h2" variant="headingMd">
                    {weekDates[0].toLocaleDateString()} - {weekDates[6].toLocaleDateString()}
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
                </InlineStack>
              </InlineStack>

              {/* Debug Info - Temporary */}
              <Card>
                <BlockStack gap="200">
                  <Text as="h3" variant="headingSm">Debug Info (Temporary)</Text>
                  <InlineStack gap="400">
                    <Text as="p" variant="bodyMd">
                      Customers Loaded: {customers?.length || 0}
                    </Text>
                    <Text as="p" variant="bodyMd">
                      Fetching: {fetchingCustomers ? "Yes" : "No"}
                    </Text>
                    <Text as="p" variant="bodyMd">
                      Error: {customersError ? "Yes" : "No"}
                    </Text>
                  </InlineStack>
                  {customersError && (
                    <Text as="p" variant="bodyMd" tone="critical">
                      Error: {customersError.toString()}
                    </Text>
                  )}
                  {customers && customers.length > 0 && (
                    <Box>
                      <Text as="p" variant="bodyMd" fontWeight="bold">
                        Sample Customer Data:
                      </Text>
                      <Text as="p" variant="bodyMd" tone="subdued">
                        {JSON.stringify(customers[0], null, 2)}
                      </Text>
                    </Box>
                  )}
                </BlockStack>
              </Card>

              <Divider />

              {/* Calendar Grid */}
              <Box padding="200">
                <div style={{ display: "grid", gridTemplateColumns: "80px repeat(7, 1fr)", gap: "1px", backgroundColor: "#e1e3e5" }}>
                  {/* Header row - time column + days */}
                  <div style={{ backgroundColor: "white", padding: "8px", fontWeight: "bold" }}>Time</div>
                  {weekDates.map((date) => (
                    <div
                      key={date.toDateString()}
                      style={{
                        backgroundColor: "white",
                        padding: "8px",
                        textAlign: "center",
                        fontWeight: "bold",
                      }}
                    >
                      <div>{date.toLocaleDateString("en-US", { weekday: "short" })}</div>
                      <div style={{ fontSize: "0.9em", color: "#666" }}>{date.getDate()}</div>
                    </div>
                  ))}

                  {/* Time slots */}
                  {timeSlots.map(({ hour, minute }) => (
                    <div key={`${hour}-${minute}`} style={{ display: "contents" }}>
                      {/* Time label */}
                      <div
                        style={{
                          backgroundColor: "white",
                          padding: "8px",
                          fontSize: "0.8em",
                          color: "#666",
                          textAlign: "right",
                        }}
                      >
                        {formatTime(hour, minute)}
                      </div>

                      {/* Day columns */}
                      {weekDates.map((date) => {
                        const slotBookings = getBookingsForSlot(date, hour, minute);
                        const hasBooking = slotBookings.length > 0;

                        return (
                          <div
                            key={`${date.toDateString()}-${hour}-${minute}`}
                            style={{
                              backgroundColor: hasBooking ? "#f0f8ff" : "white",
                              padding: "4px",
                              minHeight: "40px",
                              cursor: hasBooking ? "default" : "pointer",
                              border: hasBooking ? "1px solid #0070f3" : "none",
                              position: "relative",
                            }}
                            onClick={() => !hasBooking && handleTimeSlotClick(date, hour, minute)}
                          >
                            {slotBookings.map((booking) => (
                              <Box 
                                key={booking.id} 
                                padding="100"
                                style={{ cursor: "pointer" }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleBookingClick(booking);
                                }}
                              >
                                <BlockStack gap="50">
                                  <Badge tone={getStatusColor(booking.status) as any}>
                                    {booking.status}
                                  </Badge>
                                  <Text as="p" variant="bodyXs" fontWeight="bold">
                                    {booking.product?.title}
                                  </Text>
                                  <Text as="p" variant="bodyXs">
                                    {booking.customerName}
                                  </Text>
                                  <Text as="p" variant="bodyXs" tone="subdued">
                                    {booking.staff?.name}
                                  </Text>
                                </BlockStack>
                              </Box>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  ))}
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
                  {selectedTimeSlot.date.toLocaleDateString()} at{" "}
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
                  <Box
                    paddingBlockStart="100"
                    style={{
                      position: "absolute",
                      top: "100%",
                      left: 0,
                      right: 0,
                      zIndex: 10,
                      backgroundColor: "white",
                      border: "1px solid #ccc",
                      borderRadius: "4px",
                      maxHeight: "200px",
                      overflowY: "auto",
                    }}
                  >
                    {customers?.length ? (
                      <BlockStack gap="0">
                        {customers?.slice(0, 5).map((customer) => (
                          <Box
                            key={customer.id}
                            padding="200"
                            style={{
                              cursor: "pointer",
                              borderBottom: "1px solid #f0f0f0",
                            }}
                            onClick={() => handleCustomerSelect(customer)}
                          >
                            <BlockStack gap="50">
                              <Text as="p" variant="bodyMd">
                                {customer.displayName || `${customer.firstName || ""} ${customer.lastName || ""}`.trim() || "Unnamed Customer"}
                              </Text>
                              {customer.email && (
                                <Text as="p" variant="bodyMd" tone="subdued">
                                  {customer.email}
                                </Text>
                              )}
                            </BlockStack>
                          </Box>
                        ))}
                        <Box
                          padding="200"
                          style={{
                            cursor: "pointer",
                            backgroundColor: "#f9f9f9",
                          }}
                          onClick={handleCreateNewCustomer}
                        >
                          <Text as="p" variant="bodyMd">
                            + Create new customer
                          </Text>
                        </Box>
                      </BlockStack>
                    ) : (
                      <Box padding="200">
                        <BlockStack gap="200">
                          <Text as="p" variant="bodyMd">
                            No customers found
                          </Text>
                          <Button
                            fullWidth
                            onClick={handleCreateNewCustomer}
                          >
                            Create new customer
                          </Button>
                        </BlockStack>
                      </Box>
                    )}
                  </Box>
                )}
              </Box>
            ) : (
              <BlockStack gap="300">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h3" variant="headingSm">New Customer</Text>
                  <Button plain onClick={handleCancelNewCustomer}>Cancel</Button>
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
                    // Auto-select staff member's location if available
                    const selectedStaff = staff?.find(s => s.id === value);
                    if (selectedStaff?.location?.id && !formData.locationId) {
                      handleFormChange("locationId", selectedStaff.location.id);
                    }
                  }}
                  options={[
                    { label: "Select staff member", value: "" },
                    ...(staff?.map((s) => ({ label: s.name, value: s.id })) || [])
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
                    ...(services?.map((s) => {
                      const firstVariant = s.variants?.edges?.[0]?.node;
                      const price = firstVariant?.price ? `$${firstVariant.price}` : 'Price TBD';
                      return { label: `${s.title} - ${price}`, value: s.id };
                    }) || [])
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
                  ...availableVariants.map((variant) => {
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
                    helpText="Duration is set based on selected service variant"
                  />
                </Box>
                <Box width="50%">
                  <TextField
                    label="Total Price"
                    value={`$${formData.totalPrice}`}
                    readOnly
                    disabled
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
                        {new Date(selectedBooking.scheduledAt).toLocaleDateString()} at{" "}
                        {new Date(selectedBooking.scheduledAt).toLocaleTimeString([], {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
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
                      <Text as="p" variant="bodyMd">{selectedBooking.product?.title}</Text>
                    </BlockStack>
                    <BlockStack gap="100">
                      <Text as="p" variant="bodyMd" fontWeight="bold">Staff</Text>
                      <Text as="p" variant="bodyMd">{selectedBooking.staff?.name}</Text>
                    </BlockStack>
                  </InlineStack>
                  <InlineStack gap="400">
                    <BlockStack gap="100">
                      <Text as="p" variant="bodyMd" fontWeight="bold">Customer</Text>
                      <Text as="p" variant="bodyMd">{selectedBooking.customerName}</Text>
                      {selectedBooking.customerEmail && (
                        <Text as="p" variant="bodyMd" tone="subdued">{selectedBooking.customerEmail}</Text>
                      )}
                    </BlockStack>
                    <BlockStack gap="100">
                      <Text as="p" variant="bodyMd" fontWeight="bold">Total Price</Text>
                      <Text as="p" variant="bodyMd">${selectedBooking.totalPrice}</Text>
                    </BlockStack>
                  </InlineStack>
                </BlockStack>
              </Card>

              {/* Editable Fields */}
              <BlockStack gap="300">
                <Text as="h3" variant="headingSm">Edit Booking</Text>
                
                <Select
                  label="Status"
                  value={selectedBooking.status}
                  onChange={(value) => setSelectedBooking(prev => ({ ...prev, status: value }))}
                  options={[
                    { label: "Pending", value: "pending" },
                    { label: "Confirmed", value: "confirmed" },
                    { label: "Completed", value: "completed" },
                    { label: "Cancelled", value: "cancelled" },
                    { label: "No Show", value: "no_show" },
                  ]}
                />

                <TextField
                  label="Total Price"
                  value={selectedBooking.totalPrice?.toString() || "0"}
                  onChange={(value) => setSelectedBooking(prev => ({ ...prev, totalPrice: parseInt(value) || 0 }))}
                  type="number"
                  prefix="$"
                  autoComplete="off"
                />

                <TextField
                  label="Notes"
                  value={selectedBooking.notes || ""}
                  onChange={(value) => setSelectedBooking(prev => ({ ...prev, notes: value }))}
                  multiline={3}
                  autoComplete="off"
                  placeholder="Any special requirements or notes..."
                />
              </BlockStack>
            </BlockStack>
          )}
        </Modal.Section>
      </Modal>
    </Page>
  );
}
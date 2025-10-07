import React, { useState, useEffect } from 'react';
import {
  Navigator,
  Screen,
  ScrollView,
  Text,
  Box,
  Button,
  reactExtension,
  useApi,
  Stack,
  Selectable,
  Badge,
  Icon,
  Section,
} from '@shopify/ui-extensions-react/point-of-sale';

// Environment-aware configuration
const getAppConfig = () => {
  // In production, use the production domain; in development, use development domain
  // This could be enhanced to read from build-time environment variables
  const isDevelopment = true; // TODO: Make this configurable via build process
  const appDomain = isDevelopment 
    ? 'simplybook--development.gadget.app'
    : 'simplybook.gadget.app';
  
  return {
    apiBaseUrl: `https://${appDomain}`,
    isDevelopment
  };
};

type Appointment = {
  id: string;
  customerName: string;
  scheduledAt: string;
  serviceName: string;
  price: number;
  staffName: string;
  status: string;
  source: string;
  orderFinancialStatus?: string;
  arrived: boolean;
  customerId?: string;
  variantId?: string;
  orderId?: string;
  lineItems?: Array<{
    id: string;
    title: string;
    price: string;
    quantity: number;
    variantId?: string;
  }>;
};

const Modal = () => {
  const [recentAppointments, setRecentAppointments] = useState<Appointment[]>([]);
  const [upcomingAppointments, setUpcomingAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [currentScreen, setCurrentScreen] = useState<'list' | 'detail'>('list');
  const [updatingArrival, setUpdatingArrival] = useState(false);
  const [arrivalError, setArrivalError] = useState<string | null>(null);
  const [addingToCart, setAddingToCart] = useState(false);
  const [addToCartError, setAddToCartError] = useState<string | null>(null);

  const api = useApi();
  
  // 1) Get Session API
  const {session} = useApi<'pos.home.modal.render'>();
  const {currentSession, getSessionToken} = session;

  // 2) Store current location from session
  const [currentLocation, setCurrentLocation] = useState<{id: string, name: string} | null>(null);

  // 3) Get configuration
  const config = getAppConfig();
  if (config.isDevelopment) {
    console.log('POS Extension: Using development configuration', config);
  }

  useEffect(() => {
    const fetchLocationAndBookings = async () => {
      try {
        const locId = String(currentSession.locationId);
        console.log('POS current locationId:', locId);
        
        // Get session token for authentication
        const token = await getSessionToken();
        console.log('POS token acquired:', token ? `length=${String(token).length}` : 'MISSING');
        
        // Fetch location name and bookings together
        const url = `${config.apiBaseUrl}/api/pos-bookings?locationId=${locId}`;
        console.log('POS fetching (initial):', url);
        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        if (response.ok) {
          const data = await response.json();
          
          // Set location name from backend response
          if (data.locationName) {
            setCurrentLocation({
              id: locId,
              name: data.locationName
            });
            console.log('Found location name from backend:', data.locationName);
          } else {
            setCurrentLocation({
              id: locId,
              name: `Location ${locId}`
            });
          }

          // Map bookings from backend response
          const recent = (data.recentBookings || []).map((booking: any) => ({
            id: booking.id,
            customerName: booking.customerName,
            scheduledAt: booking.scheduledAt,
            serviceName: booking.serviceName,
            price: booking.price,
            staffName: booking.staffName,
            status: booking.status,
            source: booking.source,
            orderFinancialStatus: booking.orderFinancialStatus,
            arrived: booking.arrived,
            customerId: booking.customerId,
            variantId: booking.variantId,
            orderId: booking.orderId,
            lineItems: booking.lineItems,
          }));

          const upcoming = (data.upcomingBookings || []).map((booking: any) => ({
            id: booking.id,
            customerName: booking.customerName,
            scheduledAt: booking.scheduledAt,
            serviceName: booking.serviceName,
            price: booking.price,
            staffName: booking.staffName,
            status: booking.status,
            source: booking.source,
            orderFinancialStatus: booking.orderFinancialStatus,
            arrived: booking.arrived,
            customerId: booking.customerId,
            variantId: booking.variantId,
            orderId: booking.orderId,
            lineItems: booking.lineItems,
          }));

          setRecentAppointments(recent);
          setUpcomingAppointments(upcoming);
        } else {
          setCurrentLocation({
            id: locId,
            name: `Location ${locId}`
          });
          setRecentAppointments([]);
          setUpcomingAppointments([]);
        }
      } catch (e) {
        console.error('Failed to read session.currentSession.locationId', e);
        setRecentAppointments([]);
        setUpcomingAppointments([]);
      } finally {
        setLoading(false);
      }
    };

    // start loading state before fetch
    setLoading(true);
    setError(null);
    fetchLocationAndBookings();
  }, [currentSession.locationId]);

  const formatDateTime = (scheduledAt: string) => {
    const date = new Date(scheduledAt);
    const timeStr = date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
    
    // Format date with day of week and formatted date
    const dateStr = date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
    
    return { dateStr, timeStr };
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(price);
  };

  const getPaymentStatusBadge = (booking: Appointment) => {
    // Use order financial status as the source of truth for payment status
    if (booking.orderFinancialStatus) {
      switch (booking.orderFinancialStatus) {
        case 'paid':
          return { text: 'Paid', variant: 'success' as const };
        case 'partially_paid':
          return { text: 'Partially Paid', variant: 'warning' as const };
        case 'refunded':
          return { text: 'Refunded', variant: 'critical' as const };
        case 'partially_refunded':
          return { text: 'Partially Refunded', variant: 'warning' as const };
        case 'pending':
          return { text: 'Pending', variant: 'warning' as const };
        case 'authorized':
          return { text: 'Authorized', variant: 'highlight' as const };
        case 'voided':
          return { text: 'Voided', variant: 'critical' as const };
        default:
          return { text: 'Pending', variant: 'warning' as const };
      }
    }

    // Fall back to booking status for other cases
    switch (booking.status) {
      case 'paid':
        return { text: 'Paid', variant: 'success' as const };
      case 'pending':
        return { text: 'Pending', variant: 'warning' as const };
      case 'not_paid':
        return { text: 'Not Paid', variant: 'critical' as const };
      case 'completed':
        return { text: 'Completed', variant: 'highlight' as const };
      default:
        return { text: 'Pending', variant: 'warning' as const };
    }
  };

  const getArrivalStatusBadge = (booking: Appointment) => {
    return booking.arrived
      ? { text: 'Arrived', variant: 'success' as const }
      : { text: 'Not Arrived', variant: 'neutral' as const };
  };

  const isBookingPaid = (booking: Appointment) => {
    // Use order financial status as the source of truth for payment status
    if (booking.orderFinancialStatus) {
      return booking.orderFinancialStatus === 'paid';
    }
    // Fall back to booking status if no order financial status
    return booking.status === 'paid';
  };

  useEffect(() => {
    const fetchBookingsData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Get session token for authentication
        const token = await getSessionToken();
        console.log('POS token (refresh):', token ? `length=${String(token).length}` : 'MISSING');

        const url = `${config.apiBaseUrl}/api/pos-bookings${currentLocation ? `?locationId=${currentLocation.id}` : ''}`;
        console.log('POS fetching (refresh):', url);
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          console.warn('POS fetch non-OK:', response.status, response.statusText);
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('POS fetch success. recentBookings:', Array.isArray(data?.recentBookings) ? data.recentBookings.length : 'n/a', 'upcoming:', Array.isArray(data?.upcomingBookings) ? data.upcomingBookings.length : 'n/a');

        // Map the data directly from the backend response
        const recentBookings = data.recentBookings.map((booking: any) => {
          console.log(`DEBUG: Recent booking data:`, {
            id: booking.id,
            orderId: booking.orderId,
            source: booking.source,
            orderFinancialStatus: booking.orderFinancialStatus
          });
          return {
            id: booking.id,
            customerName: booking.customerName,
            scheduledAt: booking.scheduledAt,
            serviceName: booking.serviceName,
            price: booking.price,
            staffName: booking.staffName,
            status: booking.status,
            source: booking.source,
            orderFinancialStatus: booking.orderFinancialStatus,
            arrived: booking.arrived,
            customerId: booking.customerId,
            variantId: booking.variantId,
            orderId: booking.orderId,
            lineItems: booking.lineItems,
          };
        });

        const upcomingBookings = data.upcomingBookings.map((booking: any) => {
          console.log(`DEBUG: Upcoming booking data:`, {
            id: booking.id,
            orderId: booking.orderId,
            source: booking.source,
            orderFinancialStatus: booking.orderFinancialStatus
          });
          return {
            id: booking.id,
            customerName: booking.customerName,
            scheduledAt: booking.scheduledAt,
            serviceName: booking.serviceName,
            price: booking.price,
            staffName: booking.staffName,
            status: booking.status,
            source: booking.source,
            orderFinancialStatus: booking.orderFinancialStatus,
            arrived: booking.arrived,
            customerId: booking.customerId,
            variantId: booking.variantId,
            orderId: booking.orderId,
            lineItems: booking.lineItems,
          };
        });

        setRecentAppointments(recentBookings);
        setUpcomingAppointments(upcomingBookings);
      } catch (err) {
        console.error('Failed to fetch booking data:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch booking data');
        setRecentAppointments([]);
        setUpcomingAppointments([]);
      } finally {
        setLoading(false);
      }
    };

    fetchBookingsData();
  }, [api, currentLocation]);

  const handleAppointmentSelect = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setCurrentScreen('detail');
  };

  const handleBackToList = () => {
    setSelectedAppointment(null);
    setCurrentScreen('list');
  };

  const handleMarkAsArrived = async (appointmentId: string) => {
    try {
      setUpdatingArrival(true);
      setArrivalError(null);

      // Get session token for authentication
      const token = await getSessionToken();

      const url = `${config.apiBaseUrl}/api/pos-booking-arrived`;
      console.log('POS mark arrived POST:', url, 'bookingId:', appointmentId);
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ bookingId: appointmentId, arrived: true }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Update local state
      const updateAppointment = (appointment: Appointment) =>
        appointment.id === appointmentId ? { ...appointment, arrived: true } : appointment;

      setRecentAppointments(prev => prev.map(updateAppointment));
      setUpcomingAppointments(prev => prev.map(updateAppointment));

      // Update selected appointment if it's the one being updated
      if (selectedAppointment && selectedAppointment.id === appointmentId) {
        setSelectedAppointment({ ...selectedAppointment, arrived: true });
      }

      // Return to list view
      handleBackToList();
    } catch (err) {
      console.error('Error marking as arrived:', err);
      setArrivalError(err instanceof Error ? err.message : 'Failed to mark as arrived');
    } finally {
      setUpdatingArrival(false);
    }
  };

  const handleUnmarkAsArrived = async (appointmentId: string) => {
    try {
      setUpdatingArrival(true);
      setArrivalError(null);

      // Get session token for authentication
      const token = await getSessionToken();

      const url = `${config.apiBaseUrl}/api/pos-booking-arrived`;
      console.log('POS unmark arrived POST:', url, 'bookingId:', appointmentId);
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ bookingId: appointmentId, arrived: false }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Update local state
      const updateAppointment = (appointment: Appointment) =>
        appointment.id === appointmentId ? { ...appointment, arrived: false } : appointment;

      setRecentAppointments(prev => prev.map(updateAppointment));
      setUpcomingAppointments(prev => prev.map(updateAppointment));

      // Update selected appointment if it's the one being updated
      if (selectedAppointment && selectedAppointment.id === appointmentId) {
        setSelectedAppointment({ ...selectedAppointment, arrived: false });
      }

      // Return to list view
      handleBackToList();
    } catch (err) {
      console.error('Error unmarking as arrived:', err);
      setArrivalError(err instanceof Error ? err.message : 'Failed to unmark as arrived');
    } finally {
      setUpdatingArrival(false);
    }
  };

  const handleAddToCart = async (appointment: Appointment) => {
    try {
      setAddingToCart(true);
      setAddToCartError(null);

      // Set customer on cart if we have customer information
      if (appointment.customerId) {
        // Convert customerId from string to number for POS API
        const customerIdNumber = parseInt(appointment.customerId, 10);
        if (!isNaN(customerIdNumber)) {
          await api.cart.setCustomer({
            id: customerIdNumber,
          });
        } else {
          console.warn(`Skipping customer assignment - invalid customer ID: ${appointment.customerId}`);
        }
      }

      // Pass the original order ID as cart properties (will become order note attributes)
      console.log(`DEBUG: appointment.orderId = ${appointment.orderId}`);
      
      // Set cart properties for order tracking
      const cartProperties: Record<string, string> = {};
      
      if (appointment.orderId) {
        cartProperties.original_order_id = String(appointment.orderId);
        console.log(`DEBUG: Will set original_order_id = ${appointment.orderId}`);
      }
      
      // Always set the original booking ID for tracking
      if (appointment.id) {
        cartProperties.original_booking_id = String(appointment.id);
        console.log(`DEBUG: Will set original_booking_id = ${appointment.id}`);
      }
      
      if (Object.keys(cartProperties).length > 0) {
        try {
          await api.cart.addCartProperties(cartProperties);
          console.log(`SUCCESS: Set cart properties:`, cartProperties);
        } catch (error) {
          console.error(`ERROR: Failed to set cart properties:`, error);
          // Continue with adding items even if property setting fails
        }
      }

      let itemsAdded = 0;
      let itemsSkipped = 0;

      if (appointment.lineItems && appointment.lineItems.length > 0) {
        // Booking with line items
        // Try to add products to cart (only if they have variant IDs)
        for (const lineItem of appointment.lineItems) {
          if (lineItem.variantId) {
            // Convert variantId from string to number
            const variantIdNumber = parseInt(lineItem.variantId, 10);
            
            if (isNaN(variantIdNumber)) {
              console.warn(`Skipping line item "${lineItem.title}" - invalid variant ID: ${lineItem.variantId}`);
              itemsSkipped++;
              continue;
            }
            
            // Ensure quantity is an integer
            const quantity = parseInt(lineItem.quantity.toString(), 10);
            
            // Add line item to cart (original order ID is set as cart property above)
            await api.cart.addLineItem(variantIdNumber, quantity);
            itemsAdded++;
          } else {
            console.warn(`Skipping line item "${lineItem.title}" - no valid variant ID`);
            itemsSkipped++;
          }
        }
      } else {
        // Manually created booking - use booking's variantId as fallback
        if (appointment.variantId) {
          // Convert variantId from string to number
          const variantIdNumber = parseInt(appointment.variantId, 10);
          
          if (isNaN(variantIdNumber)) {
            console.warn(`Skipping booking "${appointment.serviceName}" - invalid variant ID: ${appointment.variantId}`);
            itemsSkipped = 1;
          } else {
            // Ensure quantity is an integer
            const quantity = 1; // Hardcoded to 1 for manually created bookings
            
            // Add line item to cart (original order ID is set as cart property above)
            await api.cart.addLineItem(variantIdNumber, quantity);
            itemsAdded = 1;
          }
        } else {
          // No variant ID available
          itemsSkipped = 1;
          console.warn(`Cannot add service booking "${appointment.serviceName}" to cart - no variant ID available`);
        }
      }

      // Provide feedback to user about what was added/skipped
      if (itemsAdded === 0 && itemsSkipped > 0) {
        throw new Error(`Cannot add items to cart. ${itemsSkipped} item(s) don't have valid product variant IDs. Only Shopify products can be added to cart.`);
      } else if (itemsAdded > 0 && itemsSkipped > 0) {
        setAddToCartError(`Added ${itemsAdded} item(s) to cart. ${itemsSkipped} item(s) were skipped (no valid product variant IDs).`);
      } else if (itemsAdded > 0) {
        // Success case - items were added
        console.log(`Successfully added ${itemsAdded} item(s) to cart`);
        
        // Dismiss the modal after successful cart addition
        try {
          await api.navigation.dismiss();
        } catch (dismissError) {
          console.warn('Failed to dismiss modal:', dismissError);
        }
      }
      
    } catch (err) {
      console.error('Error adding to cart:', err);
      setAddToCartError(err instanceof Error ? err.message : 'Failed to add items to cart');
    } finally {
      setAddingToCart(false);
    }
  };



  if (loading) {
    return (
      <Navigator>
        <Screen name="appointments" title="Appointments">
          <ScrollView>
            <Box padding="400">
              <Text variant="headingSmall">Loading appointments...</Text>
            </Box>
          </ScrollView>
        </Screen>
      </Navigator>
    );
  }

  if (error) {
    return (
      <Navigator>
        <Screen name="appointments" title="Appointments">
          <ScrollView>
            <Box padding="400">
              <Text variant="headingSmall">Error loading appointments</Text>
              <Text>{error}</Text>
            </Box>
          </ScrollView>
        </Screen>
      </Navigator>
    );
  }

  return (
    <Navigator>
      <Screen name="appointments" title={currentScreen === 'list' ? `Appointments${currentLocation ? ` (${currentLocation.name})` : ''}` : "Appointment Details"}>
        <ScrollView>
          {currentScreen === 'list' ? (
            <>

              <Section title="Upcoming Appointments">
                {upcomingAppointments.length > 0 ? (
                  upcomingAppointments.map(appointment => {
                    const { dateStr, timeStr } = formatDateTime(appointment.scheduledAt);
                    return (
                      <Selectable key={appointment.id} onPress={() => handleAppointmentSelect(appointment)}>
                        <Stack direction="vertical" paddingHorizontal="Small" paddingVertical="Small">
                          <Stack
                            direction="inline"
                            gap="200"
                            justifyContent="space-between"
                            alignItems="center"
                            alignContent="center"
                          >
                            <Stack direction="block" gap="200" inlineSize="80%">
                              <Stack direction="horizontal" gap="200">
                                <Text variant="headingSmall">{appointment.customerName}</Text>
                                <Badge
                                  text={getPaymentStatusBadge(appointment).text}
                                  variant={getPaymentStatusBadge(appointment).variant}
                                />
                                <Badge
                                  text={getArrivalStatusBadge(appointment).text}
                                  variant={getArrivalStatusBadge(appointment).variant}
                                />
                              </Stack>
                              <Text variant="body">{dateStr} at {timeStr}</Text>
                              <Text variant="body">Service: {appointment.serviceName}</Text>
                              <Text variant="body">👤 Barber: {appointment.staffName}</Text>
                            </Stack>
                            <Icon name="chevron-right" />
                          </Stack>
                        </Stack>
                      </Selectable>
                    );
                  })
                ) : (
                  <Box padding="400">
                    <Text>No upcoming appointments found</Text>
                  </Box>
                )}
              </Section>

              <Section title="Recent Appointments">
                {recentAppointments.length > 0 ? (
                  recentAppointments.map(appointment => {
                    const { dateStr, timeStr } = formatDateTime(appointment.scheduledAt);
                    return (
                      <Selectable key={appointment.id} onPress={() => handleAppointmentSelect(appointment)}>
                        <Stack direction="vertical" paddingHorizontal="Small" paddingVertical="Small">
                          <Stack
                            direction="inline"
                            gap="200"
                            justifyContent="space-between"
                            alignItems="center"
                            alignContent="center"
                          >
                            <Stack direction="block" gap="200" inlineSize="80%">
                              <Stack direction="horizontal" gap="200">
                                <Text variant="headingSmall">{appointment.customerName}</Text>
                                <Badge
                                  text={getPaymentStatusBadge(appointment).text}
                                  variant={getPaymentStatusBadge(appointment).variant}
                                />
                                <Badge
                                  text={getArrivalStatusBadge(appointment).text}
                                  variant={getArrivalStatusBadge(appointment).variant}
                                />
                              </Stack>
                              <Text variant="body">{dateStr} at {timeStr}</Text>
                              <Text variant="body">Service: {appointment.serviceName}</Text>
                              <Text variant="body">👤 Barber: {appointment.staffName}</Text>
                            </Stack>
                            <Icon name="chevron-right" />
                          </Stack>
                        </Stack>
                      </Selectable>
                    );
                  })
                ) : (
                  <Box padding="400">
                    <Text>No recent appointments found</Text>
                  </Box>
                )}
              </Section>
            </>
          ) : (
            selectedAppointment && (
              <>
                <Box padding="200">
                  <Selectable onPress={handleBackToList}>
                    <Stack
                      direction="inline"
                      gap="300"
                      alignItems="center"
                      alignContent="center"
                      paddingInline="400"
                      paddingBlock="400"
                    >
                      <Icon name="chevron-left" />
                      <Text variant="body">Back</Text>
                    </Stack>
                  </Selectable>
                </Box>

                <Box padding="200">
                  <Text variant="headingLarge">{selectedAppointment.customerName}</Text>
                </Box>

                <Box padding="200">
                  <Text variant="headingLarge">{selectedAppointment.serviceName}</Text>
                  <Text variant="headingSmall">{formatPrice(selectedAppointment.price)}</Text>
                </Box>

                <Box padding="200">
                  <Text variant="body">📅 {formatDateTime(selectedAppointment.scheduledAt).dateStr}</Text>
                  <Text variant="body">🕒 {formatDateTime(selectedAppointment.scheduledAt).timeStr}</Text>
                </Box>

                <Box padding="200">
                  <Text variant="body">👤 Barber: {selectedAppointment.staffName}</Text>
                  {selectedAppointment.lineItems && selectedAppointment.lineItems.length > 0 ? (
                    <Box padding="100">
                      <Text variant="body">📦 Line Items:</Text>
                      {selectedAppointment.lineItems.map((item, index) => (
                        <Text key={item.id} variant="body">
                          • {item.title} (Qty: {item.quantity})
                        </Text>
                      ))}
                    </Box>
                  ) : null}
                </Box>

                <Box padding="200">
                  <Stack direction="horizontal">
                    <Badge
                      text={selectedAppointment.source === 'web' ? 'Web' : 'Manual'}
                      variant={selectedAppointment.source === 'web' ? 'highlight' : 'neutral'}
                    />
                    <Badge
                      text={getPaymentStatusBadge(selectedAppointment).text}
                      variant={getPaymentStatusBadge(selectedAppointment).variant}
                    />
                    <Badge
                      text={getArrivalStatusBadge(selectedAppointment).text}
                      variant={getArrivalStatusBadge(selectedAppointment).variant}
                    />
                  </Stack>
                </Box>

                {arrivalError && (
                  <Box padding="200">
                    <Text variant="body">{arrivalError}</Text>
                  </Box>
                )}

                {addToCartError && (
                  <Box padding="200">
                    <Text variant="body">{addToCartError}</Text>
                  </Box>
                )}


                <Box padding="400">
                  <Stack direction="inline" gap="200" flexChildren>
                    {!selectedAppointment.arrived ? (
                      <Button
                        title={updatingArrival ? "Marking as Arrived..." : "Mark as Arrived"}
                        onPress={() => handleMarkAsArrived(selectedAppointment.id)}
                        type="primary"
                        isDisabled={updatingArrival}
                      />
                    ) : (
                      <Button
                        title={updatingArrival ? "Unmarking as Arrived..." : "Unmark as Arrived"}
                        onPress={() => handleUnmarkAsArrived(selectedAppointment.id)}
                        isDisabled={updatingArrival}
                      />
                    )}
                    {!isBookingPaid(selectedAppointment) && (
                      <Button
                        title={addingToCart ? "Adding to Cart..." : "Add to Cart"}
                        onPress={() => handleAddToCart(selectedAppointment)}
                        isDisabled={addingToCart}
                        type={selectedAppointment.arrived ? "primary" : undefined}
                      />
                    )}
                  </Stack>
                </Box>
              </>
            )
          )}
        </ScrollView>
      </Screen>
    </Navigator>
  );
};

export default reactExtension('pos.home.modal.render', () => <Modal />);

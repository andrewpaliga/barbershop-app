import { useEffect } from "react";
import { Page, Card, Text, BlockStack, InlineStack, Banner, Button, ProgressBar, Icon, Badge, Layout, Box, FooterHelp, Link } from "@shopify/polaris";
import { CheckIcon } from "@shopify/polaris-icons";
import { useFindMany, useFindFirst, useFindOne, useAction } from "@gadgetinc/react";
import { useNavigate } from "@remix-run/react";
import { api } from "../api";

export default function Index() {
  const navigate = useNavigate();

  // Get config data and update action
  const [{ data: config, fetching: fetchingConfig, error: configError }, refetchConfig] = useFindFirst(api.config);
  const [{ fetching: updatingConfig }, updateConfig] = useAction(api.config.update);
  
  // Get shop data - useFindFirst works, useFindOne with "current" doesn't
  const [{ data: currentShop, fetching: fetchingShop, error: shopError }] = useFindFirst(api.shopifyShop);

  // Define dates first
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);

  // Check completion status with API calls
  const [{ data: staffData }] = useFindMany(api.staff);
  const [{ data: servicesData }] = useFindMany(api.shopifyProduct, {
    filter: {
      productType: {
        in: ["service", "Service", "SERVICE"]
      }
    }
  });
  const [{ data: bookingsData }] = useFindMany(api.booking, {
    filter: {
      scheduledAt: {
        greaterThanOrEqual: tomorrow.toISOString()
      }
    }
  });

  const [{ data: todaysBookings }] = useFindMany(api.booking, { 
    first: 10,
    filter: {
      scheduledAt: {
        greaterThanOrEqual: today.toISOString(),
        lessThan: tomorrow.toISOString()
      }
    },
    sort: { scheduledAt: "Ascending" },
    select: {
      id: true,
      customerName: true,
      scheduledAt: true,
      status: true,
      staff: {
        name: true
      }
    }
  });

  const [{ data: upcomingBookings }] = useFindMany(api.booking, { 
    first: 10,
    filter: {
      scheduledAt: {
        greaterThanOrEqual: tomorrow.toISOString(),
        lessThan: nextWeek.toISOString()
      }
    },
    sort: { scheduledAt: "Ascending" },
    select: {
      id: true,
      customerName: true,
      scheduledAt: true,
      status: true,
      staff: {
        name: true
      }
    }
  });

  // Calculate completion status
  const steps = [
    {
      title: "Add a service",
      description: "Add a bookable service to your store",
      completed: (servicesData?.length || 0) > 0,
      action: () => navigate("/services"),
      buttonText: "Add Service"
    },
    {
      title: "Add a staff member",
      description: "Add team members who can provide services",
      completed: (staffData?.length || 0) > 0,
      action: () => navigate("/staff/new"),
      buttonText: "Add Staff"
    },
    {
      title: "Add Booking Button",
      description: "Allow your customers to book appointments from your online store",
      completed: config?.themeExtensionUsed || false,
      action: () => {
        if (fetchingShop) {
          alert('Please wait while shop data is loading...');
          return;
        }
        
        if (shopError) {
          console.error('Shop fetch error:', shopError);
          alert('Error loading shop data. Please try refreshing the page.');
          return;
        }
        
        const domain = currentShop?.myshopifyDomain;
        
        if (!domain) {
          console.error('Theme Editor: No myshopifyDomain found in currentShop:', currentShop);
          alert('Unable to open Theme Editor: Shop domain not found. Please try refreshing the page.');
          return;
        }
        
        const store = domain.replace(/\.myshopify\.com$/i, "");
        const href = `https://admin.shopify.com/store/${store}/themes/current/editor`;
        console.log('Opening Theme Editor:', href);
        window.open(href, "_blank");
      },
      buttonText: "Open Theme Editor"
    },
    {
      title: "Enable POS extension",
      description: "Allow staff to manage bookings from Shopify POS",
      completed: config?.posExtensionUsed || false,
      action: () => window.open("https://help.shopify.com/en/manual/pos", "_blank"),
      buttonText: "Setup POS"
    }
  ];

  // Auto-dismiss onboarding if complete
  useEffect(() => {
    const completedSteps = steps.filter(step => step.completed).length;
    const isOnboardingComplete = completedSteps === steps.length;
    const isDismissed = config?.onboardingSkipped || false;
    
    if (isOnboardingComplete && !isDismissed) {
      const timer = setTimeout(async () => {
        try {
          if (config?.id) {
            await updateConfig({ id: config.id, onboardingSkipped: true });
          } else {
            await api.config.create({ onboardingSkipped: true });
          }
          // Refetch config to get updated data
          await refetchConfig();
        } catch (error) {
          console.error('Failed to auto-dismiss onboarding:', error);
        }
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [config, updateConfig, refetchConfig]);

  // Show loading spinner while config is being fetched
  if (fetchingConfig) {
    return (
      <Page title="Dashboard">
        <Layout>
          <Layout.Section>
            <Card>
              <div style={{ padding: "40px", textAlign: "center" }}>
                <Text variant="bodyMd" as="p">Loading dashboard...</Text>
              </div>
            </Card>
          </Layout.Section>
          
          {/* Footer Help - Always visible */}
          <Layout.Section>
            <FooterHelp>
              Learn more about <Link url="https://shopifybookingapp.com/docs/">SimplyBook documentation</Link>.
            </FooterHelp>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  const completedSteps = steps.filter(step => step.completed).length;
  const progressPercentage = (completedSteps / steps.length) * 100;
  const isOnboardingComplete = completedSteps === steps.length;
  const isDismissed = config?.onboardingSkipped || false;



  // Skip setup handler
  const handleSkipSetup = async () => {
    try {
      if (config?.id) {
        await updateConfig({ id: config.id, onboardingSkipped: true });
      } else {
        await api.config.create({ onboardingSkipped: true });
      }
      await refetchConfig();
    } catch (error) {
      console.error('Failed to skip onboarding:', error);
    }
  };



  const welcomeMessage = completedSteps === 0 
    ? "Welcome to your SimplyBook booking app! Let's get you set up."
    : completedSteps === steps.length
    ? "🎉 Congratulations! Your SimplyBook app is fully configured and ready to take bookings."
    : `Great progress! You've completed ${completedSteps} of ${steps.length} setup steps.`;

  return (
    <Page title="Dashboard">
      <Layout>
        {/* Welcome Banner */}
        {(!isOnboardingComplete && !isDismissed) && (
          <Layout.Section>
            <Banner 
              tone={completedSteps === 0 ? "info" : completedSteps === steps.length ? "success" : "warning"}
              onDismiss={isOnboardingComplete ? handleSkipSetup : undefined}
            >
              <Text variant="bodyMd" as="p">
                {welcomeMessage}
              </Text>
            </Banner>
          </Layout.Section>
        )}

        {/* Onboarding Section */}
        {(!isOnboardingComplete && !isDismissed) && (
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="center">
                  <Text variant="headingLg" as="h2">
                    Setup Progress
                  </Text>
                  <InlineStack gap="200" blockAlign="center">
                    <Badge tone={isOnboardingComplete ? "success" : "attention"}>
                      {`${completedSteps}/${steps.length} Complete`}
                    </Badge>
                    <Button 
                      variant="plain" 
                      size="slim" 
                      loading={updatingConfig}
                      onClick={handleSkipSetup}
                    >
                      Skip setup
                    </Button>
                  </InlineStack>
                </InlineStack>
                
                <ProgressBar progress={progressPercentage} size="small" />
                
                <BlockStack gap="300">
                  {steps.map((step, index) => (
                    <Card key={index} background={step.completed ? "bg-surface-success" : "bg-surface"}>
                      <InlineStack align="space-between" blockAlign="center">
                        <InlineStack gap="300" blockAlign="center">
                          {step.completed && <Icon source={CheckIcon as any} tone="success" />}
                          {!step.completed && <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: '2px solid #ccc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}></div>}
                          <BlockStack gap="100">
                            <Text variant="headingMd" as="h3">
                              {step.title}
                            </Text>
                            <Text variant="bodyMd" as="p" tone="subdued">
                              {step.description}
                            </Text>
                          </BlockStack>
                        </InlineStack>
                        {!step.completed && (
                          <InlineStack gap="200">
                            {step.title === "Add Booking Button" && (
                              <Button 
                                variant="secondary" 
                                onClick={() => {
                                  window.open("https://www.shopifybookingapp.com/docs/#adding-the-booking-button-to-your-store", "_blank");
                                }}
                              >
                                View Instructions
                              </Button>
                            )}
                            <Button onClick={step.action} variant="primary">
                              {step.buttonText}
                            </Button>
                          </InlineStack>
                        )}
                      </InlineStack>
                    </Card>
                  ))}
                </BlockStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        )}

        {/* Dashboard Section */}
        {(isOnboardingComplete || isDismissed) && (
          <>
            <Layout.Section>
              <InlineStack gap="400">
                <Card>
                  <BlockStack gap="200">
                    <Text variant="headingMd" as="h3">
                      Total Staff
                    </Text>
                    <Text variant="heading2xl" as="p">
                      {staffData?.length || 0}
                    </Text>
                    <Button onClick={() => navigate("/staff")} variant="plain">
                      Manage Staff
                    </Button>
                  </BlockStack>
                </Card>
                
                <Card>
                  <BlockStack gap="200">
                    <Text variant="headingMd" as="h3">
                      Active Services
                    </Text>
                    <Text variant="heading2xl" as="p">
                      {servicesData?.length || 0}
                    </Text>
                    <Button onClick={() => navigate("/services")} variant="plain">
                      Manage Services
                    </Button>
                  </BlockStack>
                </Card>
                
                <Card>
                  <BlockStack gap="200">
                    <Text variant="headingMd" as="h3">
                      Upcoming Bookings
                    </Text>
                    <Text variant="heading2xl" as="p">
                      {bookingsData?.length || 0}
                    </Text>
                    <Button onClick={() => navigate("/schedule")} variant="plain">
                      View Schedule
                    </Button>
                  </BlockStack>
                </Card>
              </InlineStack>
            </Layout.Section>

            {/* Today's Bookings */}
            <Layout.Section>
              <Card>
                <BlockStack gap="400">
                  <InlineStack align="space-between" blockAlign="center">
                    <Text variant="headingLg" as="h2">
                      Today's Bookings
                    </Text>
                    <Button onClick={() => navigate("/schedule")} variant="primary">
                      View Schedule
                    </Button>
                  </InlineStack>
                  {todaysBookings && todaysBookings.length > 0 ? (
                    <BlockStack gap="300">
                      {todaysBookings.map((booking) => (
                        <Box key={booking.id} padding="300" background="bg-surface-secondary">
                          <InlineStack align="space-between" blockAlign="center">
                            <BlockStack gap="100">
                              <Text variant="bodyMd" as="p">
                                {booking.customerName || "Walk-in Customer"}
                              </Text>
                              <Text variant="bodySm" as="p" tone="subdued">
                                with {(booking as any).staff?.name || 'Unknown Staff'} • {booking.scheduledAt ? new Date(booking.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Time TBD'}
                              </Text>
                            </BlockStack>
                            <Badge tone={
                              booking.status === "completed" ? "success" :
                              booking.status === "cancelled" ? "critical" :
                              booking.status === "pending" ? "attention" : "info"
                            }>
                              {booking.status}
                            </Badge>
                          </InlineStack>
                        </Box>
                      ))}
                    </BlockStack>
                  ) : (
                    <Box padding="400" background="bg-surface-secondary">
                      <Text variant="bodyMd" as="p" alignment="center" tone="subdued">
                        No bookings scheduled for today
                      </Text>
                    </Box>
                  )}
                </BlockStack>
              </Card>
            </Layout.Section>

            {/* Upcoming Bookings */}
            <Layout.Section>
              <Card>
                <BlockStack gap="400">
                  <InlineStack align="space-between" blockAlign="center">
                    <Text variant="headingLg" as="h2">
                      Upcoming Bookings
                    </Text>
                    <Button onClick={() => navigate("/schedule/new")} variant="primary">
                      New Booking
                    </Button>
                  </InlineStack>
                  {upcomingBookings && upcomingBookings.length > 0 ? (
                    <BlockStack gap="300">
                      {upcomingBookings.map((booking) => (
                        <Box key={booking.id} padding="300" background="bg-surface-secondary">
                          <InlineStack align="space-between" blockAlign="center">
                            <BlockStack gap="100">
                              <Text variant="bodyMd" as="p">
                                {booking.customerName || "Walk-in Customer"}
                              </Text>
                              <Text variant="bodySm" as="p" tone="subdued">
                                with {(booking as any).staff?.name || 'Unknown Staff'} • {booking.scheduledAt ? new Date(booking.scheduledAt).toLocaleDateString() : 'Date TBD'} at {booking.scheduledAt ? new Date(booking.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Time TBD'}
                              </Text>
                            </BlockStack>
                            <Badge tone={
                              booking.status === "completed" ? "success" :
                              booking.status === "cancelled" ? "critical" :
                              booking.status === "pending" ? "attention" : "info"
                            }>
                              {booking.status}
                            </Badge>
                          </InlineStack>
                        </Box>
                      ))}
                    </BlockStack>
                  ) : (
                    <Box padding="400" background="bg-surface-secondary">
                      <Text variant="bodyMd" as="p" alignment="center" tone="subdued">
                        No upcoming bookings in the next 7 days
                      </Text>
                    </Box>
                  )}
                  <Button onClick={() => navigate("/schedule")} variant="plain">
                    View All Bookings
                  </Button>
                </BlockStack>
              </Card>
            </Layout.Section>
          </>
        )}
        
        {/* Footer Help - Always visible */}
        <Layout.Section>
          <FooterHelp>
            Learn more about <Link url="https://shopifybookingapp.com/">SimplyBook</Link>.
          </FooterHelp>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

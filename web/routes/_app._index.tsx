import { useEffect, useState } from "react";
import { Page, Card, Text, BlockStack, InlineStack, Banner, Button, ProgressBar, Icon, Badge, Layout, Box, FooterHelp, Link, Modal, Select } from "@shopify/polaris";
import { CheckIcon } from "@shopify/polaris-icons";
import { useFindMany, useFindFirst, useFindOne, useAction } from "@gadgetinc/react";
import { useNavigate, useLoaderData } from "@remix-run/react";
import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { api } from "../api";

export const loader = async ({ context }: LoaderFunctionArgs) => {
  return json({
    gadgetConfig: context.gadgetConfig,
  });
};

export default function Index() {
  const navigate = useNavigate();
  const loaderData = useLoaderData<typeof loader>();
  const shopifyApiKey = loaderData?.gadgetConfig?.apiKeys?.shopify || "";

  // State for autogenerate services
  const [isAddingEssentials, setIsAddingEssentials] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState("barbershop");

  // Get config data and update action
  const [{ data: config, fetching: fetchingConfig, error: configError }, refetchConfig] = useFindFirst(api.config);
  const [{ fetching: updatingConfig }, updateConfig] = useAction(api.config.update);
  
  // Get shop data - useFindFirst works, useFindOne with "current" doesn't
  const [{ data: currentShop, fetching: fetchingShop, error: shopError }] = useFindFirst(api.shopifyShop, {
    select: {
      id: true,
      myshopifyDomain: true,
    }
  });

  // Define dates first
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);

  // Check completion status with API calls
  const [{ data: staffData }] = useFindMany(api.staff, {
    select: {
      id: true,
      name: true
    }
  });
  const [{ data: servicesData }, refetchServices] = useFindMany(api.shopifyProduct, {
    filter: {
      productType: {
        in: ["service", "Service", "SERVICE"]
      }
    }
  });

  // Function to get services based on theme
  const getServicesByTheme = (theme: string, timeSlotInterval: number) => {
    const serviceSets: Record<string, Array<{
      name: string;
      description: string;
      price?: number;
      duration?: number;
      durations?: number[];
      durationPrices?: Record<number, number>;
      mode: "single" | "multi";
    }>> = {
      "barbershop": [
        {
          name: "Haircut",
          description: "Professional haircut service",
          durations: [timeSlotInterval * 1, timeSlotInterval * 2],
          durationPrices: {
            [timeSlotInterval * 1]: 23,
            [timeSlotInterval * 2]: 45
          },
          mode: "multi"
        },
        {
          name: "Beard Trim", 
          description: "Precise beard trimming and shaping",
          price: 25,
          duration: timeSlotInterval * 1,
          mode: "single"
        },
        {
          name: "Haircut + Beard",
          description: "Complete grooming package", 
          price: 60,
          duration: timeSlotInterval * 3,
          mode: "single"
        },
        {
          name: "Hair Wash & Style",
          description: "Wash, cut, and style service",
          durations: [timeSlotInterval * 1, timeSlotInterval * 2],
          durationPrices: {
            [timeSlotInterval * 1]: 23,
            [timeSlotInterval * 2]: 46
          },
          mode: "multi"
        }
      ],
      "hair salon": [
        {
          name: "Haircut",
          description: "Professional haircut service",
          durations: [timeSlotInterval * 1, timeSlotInterval * 2],
          durationPrices: {
            [timeSlotInterval * 1]: 35,
            [timeSlotInterval * 2]: 65
          },
          mode: "multi"
        },
        {
          name: "Hair Color", 
          description: "Professional hair coloring service",
          price: 85,
          duration: timeSlotInterval * 3,
          mode: "single"
        },
        {
          name: "Cut & Color",
          description: "Complete hair transformation", 
          price: 120,
          duration: timeSlotInterval * 4,
          mode: "single"
        },
        {
          name: "Blowout & Style",
          description: "Professional styling service",
          durations: [timeSlotInterval * 1, timeSlotInterval * 2],
          durationPrices: {
            [timeSlotInterval * 1]: 45,
            [timeSlotInterval * 2]: 80
          },
          mode: "multi"
        }
      ],
      "personal trainer": [
        {
          name: "Personal Training",
          description: "One-on-one fitness training session",
          durations: [timeSlotInterval * 1, timeSlotInterval * 2],
          durationPrices: {
            [timeSlotInterval * 1]: 75,
            [timeSlotInterval * 2]: 140
          },
          mode: "multi"
        },
        {
          name: "Fitness Assessment", 
          description: "Comprehensive fitness evaluation",
          price: 60,
          duration: timeSlotInterval * 1,
          mode: "single"
        },
        {
          name: "Training Package",
          description: "Extended training session", 
          price: 180,
          duration: timeSlotInterval * 3,
          mode: "single"
        },
        {
          name: "Nutrition Consultation",
          description: "Personalized nutrition planning",
          durations: [timeSlotInterval * 1, timeSlotInterval * 2],
          durationPrices: {
            [timeSlotInterval * 1]: 50,
            [timeSlotInterval * 2]: 90
          },
          mode: "multi"
        }
      ],
      "massage clinic": [
        {
          name: "Swedish Massage",
          description: "Relaxing full-body massage",
          durations: [timeSlotInterval * 2, timeSlotInterval * 3],
          durationPrices: {
            [timeSlotInterval * 2]: 80,
            [timeSlotInterval * 3]: 115
          },
          mode: "multi"
        },
        {
          name: "Deep Tissue", 
          description: "Therapeutic deep tissue massage",
          price: 95,
          duration: timeSlotInterval * 2,
          mode: "single"
        },
        {
          name: "Hot Stone Massage",
          description: "Relaxing hot stone therapy", 
          price: 125,
          duration: timeSlotInterval * 3,
          mode: "single"
        },
        {
          name: "Sports Massage",
          description: "Targeted sports recovery massage",
          durations: [timeSlotInterval * 1, timeSlotInterval * 2],
          durationPrices: {
            [timeSlotInterval * 1]: 60,
            [timeSlotInterval * 2]: 110
          },
          mode: "multi"
        }
      ],
      "funny": [
        {
          name: "Awkward Small Talk Session",
          description: "Professional-grade uncomfortable silence and weather discussions",
          price: 15,
          duration: timeSlotInterval * 1,
          mode: "single"
        },
        {
          name: "Professional Nap Supervision",
          description: "We watch you nap and judge your sleeping posture",
          price: 75,
          duration: timeSlotInterval * 2,
          mode: "single"
        },
        {
          name: "Dad Joke Consultation",
          description: "Learn the ancient art of embarrassing your children",
          durations: [timeSlotInterval * 1, timeSlotInterval * 2],
          durationPrices: {
            [timeSlotInterval * 1]: 20,
            [timeSlotInterval * 2]: 35
          },
          mode: "multi"
        },
        {
          name: "Passive Aggressive Gift Wrapping",
          description: "We'll wrap it beautifully while silently judging your gift choice",
          price: 40,
          duration: timeSlotInterval * 1,
          mode: "single"
        },
        {
          name: "Professional Procrastination Coaching",
          description: "Learn to put things off like a true expert (starts next week)",
          price: 60,
          duration: timeSlotInterval * 1,
          mode: "single"
        }
      ]
    };

    return { services: serviceSets[theme] || serviceSets["barbershop"], actualTheme: theme };
  };

  // Function to add example services
  const addExampleServices = async () => {
    setIsAddingEssentials(true);
    setShowThemeModal(false);
    const timeSlotInterval = config?.timeSlotInterval || 30;
    
    const { services: essentials, actualTheme } = getServicesByTheme(selectedTheme, timeSlotInterval);

    try {
      for (const service of essentials) {
        if (service.mode === "multi") {
          await api.createService({
            name: service.name,
            description: service.description,
            durations: service.durations,
            durationPrices: service.durationPrices
          });
        } else {
          await api.createService({
            name: service.name,
            description: service.description,
            price: service.price,
            duration: service.duration
          });
        }
      }
      
      await refetchServices();
      alert(`${actualTheme.charAt(0).toUpperCase() + actualTheme.slice(1)} services added successfully!`);
    } catch (error) {
      console.error("Failed to add example services:", error);
      alert("Failed to add example services. Please try again.");
    } finally {
      setIsAddingEssentials(false);
    }
  };
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
      action: () => setShowThemeModal(true),
      buttonText: isAddingEssentials ? "Adding Services..." : "Autogenerate Services",
      secondaryAction: () => navigate("/services"),
      secondaryButtonText: "Add Service",
      isAddingEssentials
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
        
        if (!shopifyApiKey) {
          console.error('App Block: No Shopify API key found');
          alert('Unable to open App Block: API key not found. Please try refreshing the page.');
          return;
        }
        
        const store = domain.replace(/\.myshopify\.com$/i, "");
        
        // Deep link to App Block
        // Format: https://admin.shopify.com/store/{store}/themes/current/editor?template={template}&addAppBlockId={api_key}/{handle}&sectionId={sectionId}
        const appBlockHandle = "bookingButton"; // The handle is the filename without .liquid extension
        const template = "index"; // Homepage template
        const sectionId = "main"; // Main section for homepage
        const href = `https://admin.shopify.com/store/${store}/themes/current/editor?template=${template}&addAppBlockId=${shopifyApiKey}/${appBlockHandle}&sectionId=${sectionId}`;
        console.log('Opening App Block deep link:', href, { store, domain, shopifyApiKey, appBlockHandle, template, sectionId });
        window.open(href, "_blank");
      },
      buttonText: "Add Booking Button"
    },
    {
      title: "Enable POS extension",
      description: "Allow staff to manage bookings from Shopify POS",
      completed: config?.posExtensionUsed || false,
      action: () => window.open("https://thesimplybookapp.com/docs/#pos-integration", "_blank"),
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
              Learn more about <Link url="https://thesimplybookapp.com/docs/">SimplyBook documentation</Link>.
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
                                  window.open("https://www.thesimplybookapp.com/docs/#adding-the-booking-button-to-your-store", "_blank");
                                }}
                              >
                                View Instructions
                              </Button>
                            )}
                            {(step as any).secondaryAction && (
                              <Button 
                                variant="secondary" 
                                onClick={(step as any).secondaryAction}
                              >
                                {(step as any).secondaryButtonText}
                              </Button>
                            )}
                            <Button 
                              onClick={step.action} 
                              variant="primary"
                              disabled={(step as any).isAddingEssentials}
                            >
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
            Learn more about <Link url="https://thesimplybookapp.com/">SimplyBook</Link>.
          </FooterHelp>
        </Layout.Section>
      </Layout>

      {/* Theme Selection Modal for Autogenerate Services */}
      <Modal
        open={showThemeModal}
        onClose={() => setShowThemeModal(false)}
        title="Choose Your Business Type"
        primaryAction={{
          content: 'Add Services',
          onAction: addExampleServices,
        }}
        secondaryActions={[
          {
            content: 'Cancel',
            onAction: () => setShowThemeModal(false),
          },
        ]}
      >
        <Modal.Section>
          <BlockStack gap="400">
            <Text as="p" variant="bodyMd">
              Select a business theme to auto-generate example services. You can customize or remove them anytime.
            </Text>
            
            <Select
              label="Business Type"
              options={[
                { label: 'Barbershop', value: 'barbershop' },
                { label: 'Hair Salon', value: 'hair salon' },
                { label: 'Personal Trainer', value: 'personal trainer' },
                { label: 'Massage Clinic', value: 'massage clinic' },
                { label: 'Funny', value: 'funny' },
              ]}
              value={selectedTheme}
              onChange={(value) => setSelectedTheme(value)}
            />
          </BlockStack>
        </Modal.Section>
      </Modal>
    </Page>
  );
}

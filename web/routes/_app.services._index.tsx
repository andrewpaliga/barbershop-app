import { useState } from "react";
import { Page, Card, Text, BlockStack, InlineStack, Banner, Button, Collapsible, List, DataTable, Spinner, EmptyState, Modal, Select, FooterHelp, Link } from "@shopify/polaris";
import { useFindMany, useFindOne } from "@gadgetinc/react";
import { useNavigate } from "@remix-run/react";
import { api } from "../api";

export default function ProductsIndex() {
  const [helpSectionOpen, setHelpSectionOpen] = useState(false);
  const [isAddingEssentials, setIsAddingEssentials] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState("barber shop");
  const navigate = useNavigate();
  
  // Get the current shop's domain once for all product links
  const [{ data: currentShop }] = useFindOne(api.shopifyShop, "current");
  
  // Get config to access timeSlotInterval
  const [{ data: config, fetching: configFetching }] = useFindOne(api.config, "current");
  

  // Only show services - using productType instead of isBarberService
  const tableFilter = { 
    productType: { 
      in: ["Service", "service", "SERVICE"] 
    },
    status: { equals: "active" }
  };

  // Fetch products using useFindMany
  const [{ data: products, fetching, error }, refetch] = useFindMany(api.shopifyProduct, {
    filter: tableFilter,
    select: {
      id: true,
      title: true,
      handle: true,
      variants: {
        edges: {
          node: {
            id: true,
            price: true
          }
        }
      }
    }
  });

  // Debug: Log filter configuration
  console.log('Products filter:', tableFilter);
  console.log('Products data:', products);


  // Function to get services based on theme
  const getServicesByTheme = (theme: string, timeSlotInterval: number) => {
    const serviceSets = {
      "barber shop": [
        {
          name: "Haircut",
          description: "Professional haircut service",
          durations: [timeSlotInterval * 1, timeSlotInterval * 2],
          durationPrices: {
            [timeSlotInterval * 1]: 23,
            [timeSlotInterval * 2]: 45
          },
          mode: "multi" as const
        },
        {
          name: "Beard Trim", 
          description: "Precise beard trimming and shaping",
          price: 25,
          duration: timeSlotInterval * 1,
          mode: "single" as const
        },
        {
          name: "Haircut + Beard",
          description: "Complete grooming package", 
          price: 60,
          duration: timeSlotInterval * 3,
          mode: "single" as const
        },
        {
          name: "Hair Wash & Style",
          description: "Wash, cut, and style service",
          durations: [timeSlotInterval * 1, timeSlotInterval * 2],
          durationPrices: {
            [timeSlotInterval * 1]: 23,
            [timeSlotInterval * 2]: 46
          },
          mode: "multi" as const
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
          mode: "multi" as const
        },
        {
          name: "Hair Color", 
          description: "Professional hair coloring service",
          price: 85,
          duration: timeSlotInterval * 3,
          mode: "single" as const
        },
        {
          name: "Cut & Color",
          description: "Complete hair transformation", 
          price: 120,
          duration: timeSlotInterval * 4,
          mode: "single" as const
        },
        {
          name: "Blowout & Style",
          description: "Professional styling service",
          durations: [timeSlotInterval * 1, timeSlotInterval * 2],
          durationPrices: {
            [timeSlotInterval * 1]: 45,
            [timeSlotInterval * 2]: 80
          },
          mode: "multi" as const
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
          mode: "multi" as const
        },
        {
          name: "Fitness Assessment", 
          description: "Comprehensive fitness evaluation",
          price: 60,
          duration: timeSlotInterval * 1,
          mode: "single" as const
        },
        {
          name: "Training Package",
          description: "Extended training session", 
          price: 180,
          duration: timeSlotInterval * 3,
          mode: "single" as const
        },
        {
          name: "Nutrition Consultation",
          description: "Personalized nutrition planning",
          durations: [timeSlotInterval * 1, timeSlotInterval * 2],
          durationPrices: {
            [timeSlotInterval * 1]: 50,
            [timeSlotInterval * 2]: 90
          },
          mode: "multi" as const
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
          mode: "multi" as const
        },
        {
          name: "Deep Tissue", 
          description: "Therapeutic deep tissue massage",
          price: 95,
          duration: timeSlotInterval * 2,
          mode: "single" as const
        },
        {
          name: "Hot Stone Massage",
          description: "Relaxing hot stone therapy", 
          price: 125,
          duration: timeSlotInterval * 3,
          mode: "single" as const
        },
        {
          name: "Sports Massage",
          description: "Targeted sports recovery massage",
          durations: [timeSlotInterval * 1, timeSlotInterval * 2],
          durationPrices: {
            [timeSlotInterval * 1]: 60,
            [timeSlotInterval * 2]: 110
          },
          mode: "multi" as const
        }
      ]
    };

    // If "random" is selected, pick a random subset of services across themes
    if (theme === "random") {
      // Flatten all services
      const allServices = Object.values(serviceSets).flat();
      // Sample 4-6 unique services
      const min = 4; const max = 6;
      const count = Math.min(allServices.length, Math.floor(Math.random() * (max - min + 1)) + min);
      const picked: typeof allServices = [] as any;
      const used = new Set<number>();
      while (picked.length < count && used.size < allServices.length) {
        const idx = Math.floor(Math.random() * allServices.length);
        if (used.has(idx)) continue;
        used.add(idx);
        picked.push(allServices[idx]);
      }
      return { services: picked as (typeof serviceSets)[keyof typeof serviceSets], actualTheme: 'random' };
    }

    return { services: serviceSets[theme as keyof typeof serviceSets], actualTheme: theme };
  };

  // Function to add example services
  const addExampleServices = async () => {
    setIsAddingEssentials(true);
    setShowThemeModal(false);
    const timeSlotInterval = config?.timeSlotInterval || 30;
    
    const { services: essentials, actualTheme } = getServicesByTheme(selectedTheme, timeSlotInterval);

    try {
      let created = 0;
      for (const service of essentials) {
        // Use the existing createService action
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
        created += 1;
        // update button label to reflect progress
        setIsAddingEssentials(true);
        (window as any).__essentialsProgress = `${created}/${essentials.length}`;
      }
      
      await refetch();
      alert(`${actualTheme.charAt(0).toUpperCase() + actualTheme.slice(1)} services added successfully! You can now customize prices and durations.`);
    } catch (error) {
      console.error("Failed to add example services:", error);
      alert("Failed to add example services. Please try again.");
    } finally {
      setIsAddingEssentials(false);
      (window as any).__essentialsProgress = undefined;
    }
  };

  // Prepare table rows
  const tableRows = products ? products.map((product) => {
    const firstVariant = product.variants?.edges?.[0]?.node;
    const shopifyAdminUrl = `https://${currentShop?.myshopifyDomain || 'admin.shopify.com'}/admin/products/${product.id}`;
    
    return [
      <Text as="p" variant="bodyMd">
        <a href={shopifyAdminUrl} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'underline', color: '#0066cc' }}>
          {product.title}
        </a>
      </Text>,
      <Text as="p" variant="bodyMd">
        {firstVariant?.price ? `$${firstVariant.price}` : 'N/A'}
      </Text>,
      <Text as="p" variant="bodyMd">
        {product.variants?.edges?.length || 0}
      </Text>,
      <Button
        tone="critical"
        variant="plain"
        onClick={async () => {
          const confirmed = window.confirm(`Remove Service type from "${product.title}"? It will remain as a normal product.`);
          if (!confirmed) return;
          try {
            await api.shopifyProduct.update(product.id, { productType: "" });
            await refetch();
          } catch (err) {
            console.error("Failed to remove Service type", err);
            alert("Failed to update product. Please try again.");
          }
        }}
      >
        Remove Service
      </Button>
    ];
  }) : [];

  const ServicesTable = () => {
    if (fetching) {
      return (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
          <Spinner size="large" />
        </div>
      );
    }

    if (error) {
      return (
        <Banner tone="critical">
          <Text as="p" variant="bodyMd">
            Error loading services: {error.toString()}
          </Text>
          <Button variant="plain" onClick={() => refetch()}>
            Try Again
          </Button>
        </Banner>
      );
    }

    if (!products || products.length === 0) {
      return (
        <EmptyState
          heading="No services found"
          action={{
            content: isAddingEssentials ? 'Adding Services…' : 'Add Example Services',
            onAction: () => setShowThemeModal(true),
            disabled: isAddingEssentials
          }}
          secondaryAction={{
            content: 'Add Service',
            onAction: () => navigate('/services/new')
          }}
          image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
        >
          <Text as="p" variant="bodyMd">
            Get started quickly with our example services, or create your own custom service by adding a product with Type "Service" in your Shopify store.
          </Text>
        </EmptyState>
      );
    }

    return (
        <DataTable
          columnContentTypes={['text', 'text', 'text', 'text']}
          headings={['Title', 'Price', 'Durations', 'Actions']}
          rows={tableRows}
        />
    );
  };

  return (
    <Page title="Services" subtitle="Manage your barber services">
      <BlockStack gap="400">
        {/* Informational Banner */}
        <Banner tone="info">
          <BlockStack gap="200">
            <Text as="p" variant="bodyMd">
              Any product in your Shopify store can become a bookable service by setting its Type to "Service". Do it yourself or use the "Add Service" button.
            </Text>
            <Button
              variant="plain"
              onClick={() => setHelpSectionOpen(!helpSectionOpen)}
            >
              {helpSectionOpen ? 'Hide' : 'Show'} detailed instructions
            </Button>
          </BlockStack>
        </Banner>


        {/* Collapsible Help Section */}
        <Collapsible open={helpSectionOpen} id="help-section">
          <Card>
            <BlockStack gap="400">
              <Text as="h3" variant="headingSm">
                Step-by-Step Guide: Creating Bookable Services
              </Text>
              
              <BlockStack gap="300">
                <div>
                  <Text as="h4" variant="headingXs" tone="success">
                    Step 1: Create or Edit a Product
                  </Text>
                  <List type="number">
                    <List.Item>Go to your Shopify admin → Products</List.Item>
                    <List.Item>Create a new product or edit an existing one</List.Item>
                    <List.Item>Set the <strong>Product Type</strong> to "Service" (case-sensitive)</List.Item>
                    <List.Item>Add a title, description, and pricing</List.Item>
                  </List>
                </div>
                
                <div>
                  <Text as="h4" variant="headingXs" tone="success">
                    Step 2: Set Service Duration (Optional but Recommended)
                  </Text>
                  <List type="number">
                    <List.Item>In the product's variants section, add a new option called "Duration"</List.Item>
                    <List.Item>Set the values to your service durations (e.g., "30 min", "45 min", "60 min")</List.Item>
                    <List.Item>Create variants for each duration with appropriate pricing</List.Item>
                  </List>
                </div>
                
                <div>
                  <Text as="h4" variant="headingXs" tone="success">
                    Step 3: Your Service is Ready!
                  </Text>
                  <Text as="p" variant="bodyMd">
                    Once saved, your service will appear in this list and be available for booking through your store.
                  </Text>
                </div>
              </BlockStack>
            </BlockStack>
          </Card>
        </Collapsible>

        <InlineStack gap="400" align="end">
          <Button
            variant="primary"
            onClick={() => navigate('/services/new')}
          >
            Add Service
          </Button>
        </InlineStack>
        
        <Card>
          {isAddingEssentials ? (
            <Banner>
              <Text as="p" variant="bodyMd">
                Creating services {(window as any).__essentialsProgress ? `(${(window as any).__essentialsProgress})` : ''}...
              </Text>
            </Banner>
          ) : null}
          <ServicesTable />
        </Card>
      </BlockStack>

      {/* Theme Selection Modal */}
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
              Select a business theme to auto-generate example services. You can remove them anytime.
            </Text>
            
            <Select
              label="Business Type"
              options={[
                { label: 'Barber Shop', value: 'barber shop' },
                { label: 'Hair Salon', value: 'hair salon' },
                { label: 'Personal Trainer', value: 'personal trainer' },
                { label: 'Massage Clinic', value: 'massage clinic' },
                { label: 'Random', value: 'random' }
              ]}
              value={selectedTheme}
              onChange={(value) => setSelectedTheme(value)}
            />
            

          </BlockStack>
        </Modal.Section>
      </Modal>
      <FooterHelp>
        Learn more about <Link url="https://shopifybookingapp.com/docs/#services-management">SimplyBook services</Link>.
      </FooterHelp>
    </Page>
  );
}
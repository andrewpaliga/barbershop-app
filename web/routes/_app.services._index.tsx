import { useState } from "react";
import { Page, Card, Text, BlockStack, InlineStack, Banner, Button, Collapsible, List } from "@shopify/polaris";
import { AutoTable } from "@gadgetinc/react/auto/polaris";
import { useFindOne } from "@gadgetinc/react";
import { useNavigate } from "@remix-run/react";
import { api } from "../api";

export default function ProductsIndex() {
  const [hasProviderError, setHasProviderError] = useState(false);
  const [helpSectionOpen, setHelpSectionOpen] = useState(false);
  const navigate = useNavigate();
  
  // Get the current shop's domain once for all product links
  const [{ data: currentShop }] = useFindOne(api.shopifyShop, "current");
  
  // Only show services - using productType instead of isBarberService
  const tableFilter = { 
    productType: { 
      in: ["Service", "service", "SERVICE"] 
    },
    status: { equals: "active" }
  };

  // Debug: Log filter configuration
  console.log('Products filter:', tableFilter);

  // Error boundary component for AutoTable
  const AutoTableWithFallback = () => {
    try {
      return (
        <AutoTable
          model={api.shopifyProduct}
          filter={tableFilter}
          select={{
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
          }}
          columns={[
            {
              header: "Title",
              render: ({ record }) => {
                // Use the globally fetched shop domain
                const shopifyAdminUrl = `https://${currentShop?.myshopifyDomain || 'admin.shopify.com'}/admin/products/${record.id}`;
                
                return (
                  <Text as="p" variant="bodyMd">
                    <a href={shopifyAdminUrl} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'underline', color: '#0066cc' }}>
                      {record.title}
                    </a>
                  </Text>
                );
              }
            },
            {
              header: "Price",
              render: ({ record }) => {
                console.log('Record in Price render:', record);
                const firstVariant = record.variants?.edges?.[0]?.node;
                return (
                  <Text as="p" variant="bodyMd">
                    {firstVariant?.price ? `$${firstVariant.price}` : 'N/A'}
                  </Text>
                );
              }
            },
            {
              header: "# of Variants",
              render: ({ record }) => {
                console.log('Record in Variants render:', record);
                return (
                  <Text as="p" variant="bodyMd">
                    {record.variants?.edges?.length || 0}
                  </Text>
                );
              }
            }
          ]}
        />
      );
    } catch (error) {
      console.error('AutoTable error:', error);
      setHasProviderError(true);
      return null;
    }
  };

  // Fallback table rendering
  const FallbackTable = () => {
    return (
      <Banner status="info">
        <Text as="p" variant="bodyMd">
          AutoTable encountered an error. Please refresh the page or contact support if the issue persists.
        </Text>
      </Banner>
    );
  };

  return (
    <Page title="Services" subtitle="Manage your barber services">
      <BlockStack gap="400">
        {/* Informational Banner */}
        <Banner status="info">
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
        <Collapsible open={helpSectionOpen}>
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
        <BlockStack gap="400">
          {hasProviderError && (
            <Banner status="warning">
              <Text as="p" variant="bodyMd">
                Using fallback table view due to provider issues.
              </Text>
            </Banner>
          )}
          
          {hasProviderError ? <FallbackTable /> : <AutoTableWithFallback />}
        </BlockStack>
      </Card>
      </BlockStack>
    </Page>
  );
}
import { useState } from "react";
import { Page, Card, Text, BlockStack, InlineStack, Banner, Button } from "@shopify/polaris";
import { AutoTable } from "@gadgetinc/react/auto/polaris";
import { useAction, useFindMany } from "@gadgetinc/react";
import { useNavigate } from "@remix-run/react";
import { api } from "../api";

export default function ProductsIndex() {
  const [hasProviderError, setHasProviderError] = useState(false);
  const navigate = useNavigate();
  
  // Only show services - using productType instead of isBarberService
  const tableFilter = { 
    productType: { 
      in: ["Service", "service", "SERVICE"] 
    },
    status: { equals: "active" }
  };
    
  const [{ data: products, fetching: fetchingProducts, error: productsError }] = useFindMany(
    api.shopifyProduct,
    {
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
    }
  );

  // Debug: Log what we're getting to see the actual data structure
  console.log('Products filter:', tableFilter);
  console.log('Products returned:', products);
  console.log('First product structure:', products?.[0]);
  console.log('First product keys:', products?.[0] ? Object.keys(products[0]) : 'No products');
  console.log('Fetching state:', fetchingProducts);
  console.log('Products error:', productsError);
  console.log('Products error details:', productsError ? {
    message: productsError.message,
    name: productsError.name,
    stack: productsError.stack
  } : 'No error');

  // Error boundary component for AutoTable
  const AutoTableWithFallback = () => {
    try {
      return (
        <AutoTable
          model={api.shopifyProduct}
          filter={tableFilter}
          columns={[
            {
              header: "Title",
              render: ({ record }) => (
                <a 
                  href={`https://paliga-test-store.myshopify.com/admin/products/${record.id}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{ textDecoration: 'none', color: 'inherit' }}
                >
                  {record.title}
                </a>
              )
            },
            {
              header: "Price",
              render: ({ record }) => {
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
              render: ({ record }) => (
                <Text as="p" variant="bodyMd">
                  {record.variants?.edges?.length || 0}
                </Text>
              )
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
    if (fetchingProducts) {
      return <Text as="p" variant="bodyMd">Loading products...</Text>;
    }
    
    if (productsError) {
      return (
        <Banner status="critical">
          <Text as="p" variant="bodyMd">
            Error loading products: {productsError.toString()}
          </Text>
        </Banner>
      );
    }
    
    if (!products || products.length === 0) {
      return <Text as="p" variant="bodyMd">No products found.</Text>;
    }

    return (
      <BlockStack gap="300">
        {products.map((product) => (
          <Card key={product.id}>
            <InlineStack gap="400" align="space-between" blockAlign="center">
              <BlockStack gap="200">
                <Text as="h3" variant="headingSm">{product.title}</Text>
                <Text as="p" variant="bodyMd" tone="subdued">
                  {product.variants?.edges?.length || 0} variants
                </Text>
              </BlockStack>
              <InlineStack gap="400" align="end">
                <Text as="p" variant="bodyMd">
                  {product.variants?.edges?.[0]?.node?.price ? `$${product.variants.edges[0].node.price}` : 'N/A'}
                </Text>
                <Text as="p" variant="bodyMd">
                  {product.variants?.edges?.length || 0}
                </Text>
              </InlineStack>
            </InlineStack>
          </Card>
        ))}
      </BlockStack>
    );
  };

  return (
    <Page title="Services" subtitle="Manage your barber services">
      <BlockStack gap="400">
        <InlineStack gap="400" align="end">
          <Button
            variant="primary"
            onClick={() => navigate('/products/services/new')}
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
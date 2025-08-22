import { useState } from "react";
import { Page, Card, Tabs, Text, Checkbox, BlockStack, InlineStack, Banner, Button } from "@shopify/polaris";
import { AutoTable } from "@gadgetinc/react/auto/polaris";
import { useAction, useFindMany } from "@gadgetinc/react";
import { useNavigate } from "@remix-run/react";
import { api } from "../api";

export default function ProductsIndex() {
  const [selectedTab, setSelectedTab] = useState(0);
  const [hasProviderError, setHasProviderError] = useState(false);
  const [{ data, fetching, error }, updateProduct] = useAction(api.shopifyProduct.update);
  const navigate = useNavigate();
  
  // Fallback data fetching in case AutoTable fails
  const tableFilter = selectedTab === 1 
    ? { isBarberService: { equals: true } }
    : undefined;
    
  const [{ data: products, fetching: fetchingProducts, error: productsError }] = useFindMany(
    api.shopifyProduct,
    {
      filter: tableFilter,
      select: {
        id: true,
        title: true,
        status: true,
        productType: true,
        isBarberService: true
      }
    }
  );

  const handleServiceToggle = async (productId: string, currentValue: boolean) => {
    try {
      await updateProduct({
        id: productId,
        isBarberService: !currentValue
      });
      // Show success message if shopify global is available
      if (typeof shopify !== 'undefined') {
        shopify.toast.show(
          `Product ${!currentValue ? 'marked as service' : 'unmarked as service'}`
        );
      }
    } catch (error) {
      if (typeof shopify !== 'undefined') {
        shopify.toast.show('Failed to update product', { isError: true });
      }
      console.error('Failed to update product:', error);
    }
  };

  const tabs = [
    {
      id: 'all-products',
      content: 'All Products',
    },
    {
      id: 'services-only',
      content: 'Services Only',
    },
  ];

  // Error boundary component for AutoTable
  const AutoTableWithFallback = () => {
    try {
      return (
        <AutoTable
          model={api.shopifyProduct}
          filter={tableFilter}
          columns={[
            "title",
            "status", 
            "productType",
            {
              header: "Service Status",
              render: ({ record }) => (
                <Checkbox
                  checked={record.isBarberService || false}
                  onChange={() => handleServiceToggle(record.id, record.isBarberService || false)}
                  disabled={fetching}
                  label={record.isBarberService ? "Service" : "Product"}
                />
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
                  {product.status} • {product.productType || 'No type'}
                </Text>
              </BlockStack>
              <Checkbox
                checked={product.isBarberService || false}
                onChange={() => handleServiceToggle(product.id, product.isBarberService || false)}
                disabled={fetching}
                label={product.isBarberService ? "Service" : "Product"}
              />
            </InlineStack>
          </Card>
        ))}
      </BlockStack>
    );
  };

  return (
    <Page title="Products" subtitle="Manage your products and services">
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
          <Tabs
            tabs={tabs}
            selected={selectedTab}
            onSelect={setSelectedTab}
          />
          
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
import { useState } from "react";
import { Page, Card, Tabs, Text, Checkbox, BlockStack, InlineStack } from "@shopify/polaris";
import { AutoTable } from "@gadgetinc/react/auto/polaris";
import { useAction } from "@gadgetinc/react";
import { api } from "../api";

export default function ProductsIndex() {
  const [selectedTab, setSelectedTab] = useState(0);
  const [{ data, fetching, error }, updateProduct] = useAction(api.shopifyProduct.update);

  const handleServiceToggle = async (productId: string, currentValue: boolean) => {
    try {
      await updateProduct({
        id: productId,
        isBarberService: !currentValue
      });
      // Show success message
      shopify.toast.show(
        `Product ${!currentValue ? 'marked as service' : 'unmarked as service'}`
      );
    } catch (error) {
      shopify.toast.show('Failed to update product', { isError: true });
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

  const tableFilter = selectedTab === 1 
    ? { isBarberService: { equals: true } }
    : undefined;

  return (
    <Page title="Products" subtitle="Manage your products and services">
      <Card>
        <BlockStack gap="400">
          <Tabs
            tabs={tabs}
            selected={selectedTab}
            onSelect={setSelectedTab}
          />
          
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
        </BlockStack>
      </Card>
    </Page>
  );
}
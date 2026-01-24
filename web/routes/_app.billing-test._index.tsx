import { useState } from "react";
import {
  Page,
  Card,
  Text,
  BlockStack,
  Button,
  Banner,
  InlineStack,
  Box,
  Divider,
  Badge,
} from "@shopify/polaris";
import { useFindFirst, useGlobalAction } from "@gadgetinc/react";
import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { useAppBridge } from "@shopify/app-bridge-react";
import { Redirect } from "@shopify/app-bridge/actions";
import { api } from "../api";
import { getAppHandle } from "../utils/getAppHandle";

export const loader = async ({ context }: LoaderFunctionArgs) => {
  return json({
    gadgetConfig: context.gadgetConfig,
  });
};

export default function BillingTest() {
  const loaderData = useLoaderData<typeof loader>();
  const app = useAppBridge();
  const [syncResult, setSyncResult] = useState<any>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Get current shop with billing information
  const [{ data: shop, fetching: fetchingShop, error: shopError }, refetchShop] = useFindFirst(
    api.shopifyShop,
    {
      select: {
        id: true,
        myshopifyDomain: true,
        domain: true,
        name: true,
        billingStatus: true,
        billingPlan: true,
        isTrialActive: true,
        trialEndsAt: true,
        appSubscriptionId: true,
      },
    }
  );

  // Action to sync status from Shopify
  const [{ fetching: syncing }, syncStatus] = useGlobalAction(api.syncManagedPricingStatus);

  const handleSyncStatus = async () => {
    setIsSyncing(true);
    setSyncResult(null);
    try {
      const result = await syncStatus({});
      setSyncResult(result);
      // Refetch shop data to get updated information
      await refetchShop();
    } catch (error: any) {
      setSyncResult({
        success: false,
        error: error?.message || "Failed to sync status",
        errorDetails: error,
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // Get the managed pricing page URL
  const getManagedPricingUrl = () => {
    if (!shop?.myshopifyDomain) {
      return "#";
    }
    const storeHandle = shop.myshopifyDomain.replace(/\.myshopify\.com$/i, "");
    const appHandle = getAppHandle(loaderData?.gadgetConfig?.environment || undefined);
    return `https://admin.shopify.com/store/${storeHandle}/charges/${appHandle}/pricing_plans`;
  };

  const handleOpenManagedPricing = () => {
    if (!shop?.myshopifyDomain) {
      return;
    }

    const storeHandle = shop.myshopifyDomain.replace(/\.myshopify\.com$/i, "");
    const appHandle = getAppHandle(loaderData?.gadgetConfig?.environment || undefined);
    const adminPath = `/store/${storeHandle}/charges/${appHandle}/pricing_plans`;

    if (!app) {
      const fullUrl = `https://admin.shopify.com${adminPath}`;
      if (window.top) {
        window.top.location.href = fullUrl;
      } else {
        window.location.href = fullUrl;
      }
      return;
    }

    try {
      const redirect = Redirect.create(app as any);
      redirect.dispatch(Redirect.Action.ADMIN_PATH, adminPath);
    } catch (error) {
      console.error("Error with App Bridge redirect:", error);
      const fullUrl = `https://admin.shopify.com${adminPath}`;
      if (window.top) {
        window.top.location.href = fullUrl;
      } else {
        window.location.href = fullUrl;
      }
    }
  };

  // Determine status badge
  const getStatusBadge = () => {
    if (shop?.billingStatus === "active") {
      return <Badge tone="success">Active</Badge>;
    } else if (shop?.billingStatus === "pending") {
      return <Badge tone="attention">Pending</Badge>;
    } else if (shop?.billingStatus === "expired") {
      return <Badge tone="critical">Expired</Badge>;
    } else if (shop?.billingStatus === "cancelled") {
      return <Badge tone="critical">Cancelled</Badge>;
    } else if (shop?.isTrialActive) {
      return <Badge tone="info">Trial Active</Badge>;
    } else {
      return <Badge>No Plan</Badge>;
    }
  };

  return (
    <Page title="Billing Test" subtitle="View and sync billing information from Shopify">
      <BlockStack gap="400">
        {/* Error Banner */}
        {shopError && (
          <Banner tone="critical">
            <Text as="p" variant="bodyMd">
              Error loading shop information: {JSON.stringify(shopError, null, 2)}
            </Text>
          </Banner>
        )}

        {/* Current Billing Fields Card */}
        <Card>
          <BlockStack gap="400">
            <InlineStack align="space-between" blockAlign="center">
              <Text variant="headingMd" as="h2">
                Current Billing Fields (shopifyShop)
              </Text>
              {getStatusBadge()}
            </InlineStack>

            {fetchingShop ? (
              <Text as="p" tone="subdued">Loading...</Text>
            ) : shop ? (
              <BlockStack gap="300">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="p" variant="bodyMd">
                    <strong>Shop:</strong>
                  </Text>
                  <Text as="p" variant="bodyMd">
                    {shop.name || shop.myshopifyDomain || shop.domain || "N/A"}
                  </Text>
                </InlineStack>

                <Divider />

                <InlineStack align="space-between" blockAlign="center">
                  <Text as="p" variant="bodyMd">
                    <strong>billingStatus:</strong>
                  </Text>
                  <Text as="p" variant="bodyMd">
                    {shop.billingStatus || "Not set"}
                  </Text>
                </InlineStack>

                <Divider />

                <InlineStack align="space-between" blockAlign="center">
                  <Text as="p" variant="bodyMd">
                    <strong>billingPlan:</strong>
                  </Text>
                  <Text as="p" variant="bodyMd">
                    {shop.billingPlan ? shop.billingPlan.charAt(0).toUpperCase() + shop.billingPlan.slice(1) : "Not set"}
                  </Text>
                </InlineStack>

                <Divider />

                <InlineStack align="space-between" blockAlign="center">
                  <Text as="p" variant="bodyMd">
                    <strong>appSubscriptionId:</strong>
                  </Text>
                  <Box maxWidth="60%">
                    <Text as="p" variant="bodySm" tone="subdued" truncate>
                      {shop.appSubscriptionId || "Not set"}
                    </Text>
                  </Box>
                </InlineStack>

                <Divider />

                <InlineStack align="space-between" blockAlign="center">
                  <Text as="p" variant="bodyMd">
                    <strong>isTrialActive:</strong>
                  </Text>
                  <Text as="p" variant="bodyMd">
                    {shop.isTrialActive ? "Yes" : "No"}
                  </Text>
                </InlineStack>

                <Divider />

                <InlineStack align="space-between" blockAlign="center">
                  <Text as="p" variant="bodyMd">
                    <strong>trialEndsAt:</strong>
                  </Text>
                  <Text as="p" variant="bodyMd">
                    {shop.trialEndsAt ? new Date(shop.trialEndsAt).toLocaleString() : "Not set"}
                  </Text>
                </InlineStack>
              </BlockStack>
            ) : (
              <Text as="p" tone="subdued">No shop information available</Text>
            )}
          </BlockStack>
        </Card>

        {/* Sync Action Card */}
        <Card>
          <BlockStack gap="400">
            <Text variant="headingMd" as="h2">
              Sync from Shopify
            </Text>
            <Text as="p" variant="bodySm" tone="subdued">
              This queries Shopify's Billing API (currentAppInstallation.activeSubscriptions) and updates the billing fields above.
            </Text>
            <BlockStack gap="300">
              <Button
                variant="primary"
                onClick={handleSyncStatus}
                loading={isSyncing || syncing}
                disabled={!shop?.id}
              >
                Sync Managed Pricing Status
              </Button>
              <Button
                variant="secondary"
                onClick={handleOpenManagedPricing}
                disabled={!shop?.myshopifyDomain}
              >
                Open Managed Pricing Page
              </Button>
            </BlockStack>
            {syncResult && !syncResult.error && (
              <Banner tone="success">
                <Text as="p" variant="bodyMd">
                  Sync completed successfully! The billing fields above have been updated.
                </Text>
              </Banner>
            )}
            {syncResult?.error && (
              <Banner tone="critical">
                <Text as="p" variant="bodyMd">
                  Sync failed: {syncResult.error}
                </Text>
              </Banner>
            )}
          </BlockStack>
        </Card>

        {/* Request Sent to Shopify */}
        {syncResult?.debug?.request && (
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">
                Request Sent to Shopify
              </Text>
              <BlockStack gap="300">
                <BlockStack gap="200">
                  <Text as="p" variant="bodySm">
                    <strong>Endpoint:</strong> {syncResult.debug.request.endpoint}
                  </Text>
                  <Text as="p" variant="bodySm">
                    <strong>Operation:</strong> {syncResult.debug.request.operation}
                  </Text>
                </BlockStack>
                <Box
                  padding="400"
                  background="bg-surface-secondary"
                  borderRadius="200"
                >
                  <Text as="p" variant="bodySm" fontWeight="semibold" tone="subdued">
                    GraphQL Query:
                  </Text>
                  <pre
                    style={{
                      margin: "8px 0 0 0",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      fontFamily: "monospace",
                      fontSize: "12px",
                      backgroundColor: "transparent",
                    }}
                  >
                    {syncResult.debug.request.query}
                  </pre>
                </Box>
              </BlockStack>
            </BlockStack>
          </Card>
        )}

        {/* Response from Shopify */}
        {syncResult?.debug?.response && (
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">
                Response from Shopify
              </Text>
              <BlockStack gap="300">
                <BlockStack gap="200">
                  <Text as="p" variant="bodySm">
                    <strong>Response Shape:</strong> {syncResult.debug.response.responseShape?.hasDataProperty ? "Wrapped in 'data' property" : "Direct response"}
                  </Text>
                  <Text as="p" variant="bodySm">
                    <strong>Has currentAppInstallation:</strong> {syncResult.debug.response.responseShape?.hasCurrentAppInstallation ? "Yes" : "No"}
                  </Text>
                  <Text as="p" variant="bodySm">
                    <strong>Subscription Count:</strong> {syncResult.debug.response.responseShape?.subscriptionCount || 0}
                  </Text>
                </BlockStack>
                
                <Box
                  padding="400"
                  background="bg-surface-secondary"
                  borderRadius="200"
                >
                  <Text as="p" variant="bodySm" fontWeight="semibold" tone="subdued">
                    Full Raw Response:
                  </Text>
                  <pre
                    style={{
                      margin: "8px 0 0 0",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      fontFamily: "monospace",
                      fontSize: "11px",
                      maxHeight: "600px",
                      overflow: "auto",
                    }}
                  >
                    {JSON.stringify(syncResult.debug.response.raw, null, 2)}
                  </pre>
                </Box>

                {/* Parsed Data */}
                {syncResult.debug.response.data && (
                  <Box
                    padding="400"
                    background="bg-surface-tertiary"
                    borderRadius="200"
                  >
                    <Text as="p" variant="bodySm" fontWeight="semibold" tone="subdued">
                      Parsed Data (currentAppInstallation):
                    </Text>
                    <pre
                      style={{
                        margin: "8px 0 0 0",
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                        fontFamily: "monospace",
                        fontSize: "11px",
                        maxHeight: "400px",
                        overflow: "auto",
                      }}
                    >
                      {JSON.stringify(syncResult.debug.response.data, null, 2)}
                    </pre>
                  </Box>
                )}

                {/* Key Fields Summary */}
                {syncResult.debug.rawSubscriptions && syncResult.debug.rawSubscriptions.length > 0 && (
                  <>
                    <Divider />
                    <Text variant="headingSm" as="h3">
                      Subscription Details:
                    </Text>
                    <Box
                      padding="400"
                      background="bg-surface-tertiary"
                      borderRadius="200"
                    >
                      <pre
                        style={{
                          margin: 0,
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                          fontFamily: "monospace",
                          fontSize: "11px",
                          maxHeight: "400px",
                          overflow: "auto",
                        }}
                      >
                        {JSON.stringify(syncResult.debug.rawSubscriptions, null, 2)}
                      </pre>
                    </Box>
                  </>
                )}
              </BlockStack>
            </BlockStack>
          </Card>
        )}

        {/* Sync Result Summary */}
        {syncResult && !syncResult.error && (
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">
                Sync Result Summary
              </Text>
              <BlockStack gap="300">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="p" variant="bodyMd">
                    <strong>Status:</strong>
                  </Text>
                  <Text as="p" variant="bodyMd">
                    {syncResult.status || "N/A"}
                  </Text>
                </InlineStack>
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="p" variant="bodyMd">
                    <strong>Is Active:</strong>
                  </Text>
                  <Text as="p" variant="bodyMd">
                    {syncResult.isActive ? "Yes" : "No"}
                  </Text>
                </InlineStack>
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="p" variant="bodyMd">
                    <strong>In Trial:</strong>
                  </Text>
                  <Text as="p" variant="bodyMd">
                    {syncResult.inTrial ? "Yes" : "No"}
                  </Text>
                </InlineStack>
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="p" variant="bodyMd">
                    <strong>Current Plan:</strong>
                  </Text>
                  <Text as="p" variant="bodyMd">
                    {syncResult.currentPlan || "Not set"}
                  </Text>
                </InlineStack>
                {syncResult.daysRemainingInTrial !== null && (
                  <InlineStack align="space-between" blockAlign="center">
                    <Text as="p" variant="bodyMd">
                      <strong>Trial Days:</strong>
                    </Text>
                    <Text as="p" variant="bodyMd">
                      {syncResult.daysRemainingInTrial}
                    </Text>
                  </InlineStack>
                )}
                {syncResult.currentPeriodEnd && (
                  <InlineStack align="space-between" blockAlign="center">
                    <Text as="p" variant="bodyMd">
                      <strong>Current Period End:</strong>
                    </Text>
                    <Text as="p" variant="bodyMd">
                      {new Date(syncResult.currentPeriodEnd).toLocaleString()}
                    </Text>
                  </InlineStack>
                )}
              </BlockStack>
            </BlockStack>
          </Card>
        )}
      </BlockStack>
    </Page>
  );
}


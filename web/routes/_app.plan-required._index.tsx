import { useState, useEffect } from "react";
import {
  Page,
  Card,
  Text,
  BlockStack,
  Button,
  Banner,
  InlineStack,
  Box,
  List,
  Divider,
} from "@shopify/polaris";
import { useFindFirst, useGlobalAction } from "@gadgetinc/react";
import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
import { useAppBridge } from "@shopify/app-bridge-react";
import { Redirect } from "@shopify/app-bridge/actions";
import { api } from "../api";
import { getAppHandle } from "../utils/getAppHandle";

export const loader = async ({ context }: LoaderFunctionArgs) => {
  return json({
    gadgetConfig: context.gadgetConfig,
  });
};

export default function PlanRequired() {
  const loaderData = useLoaderData<typeof loader>();
  const app = useAppBridge();
  const navigate = useNavigate();
  const [hasSynced, setHasSynced] = useState(false);

  // Get current shop with billing status
  const [{ data: shop, fetching: fetchingShop }, refetchShop] = useFindFirst(api.shopifyShop, {
    select: {
      id: true,
      myshopifyDomain: true,
      billingStatus: true,
    },
  });

  // Sync action - force sync on this page to check for updates
  const [{ fetching: syncing }, syncStatus] = useGlobalAction(api.syncManagedPricingStatus);

  // Sync billing status on mount (force sync, bypass cache)
  useEffect(() => {
    if (!fetchingShop && shop?.id && !hasSynced) {
      // Clear the sync cache so that BillingSyncAndRedirect will sync immediately
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('billing_sync_session');
      }

      const performSync = async () => {
        try {
          await syncStatus({});
          setHasSynced(true);
          await refetchShop();
        } catch (error) {
          console.error('[PlanRequired] Error syncing billing status:', error);
          setHasSynced(true); // Mark as synced even on error to prevent infinite loops
        }
      };
      performSync();
    }
  }, [shop?.id, fetchingShop, hasSynced, syncStatus, refetchShop]);

  // Redirect away if billing status is now active/pending after sync
  useEffect(() => {
    if (hasSynced && !syncing && shop?.billingStatus && shop.billingStatus !== 'no_billing' && shop.billingStatus !== null) {
      // Plan has been selected, redirect to dashboard
      navigate('/');
    }
  }, [hasSynced, syncing, shop?.billingStatus, navigate]);

  // Get the managed pricing page URL - matches billing-test exactly
  const getManagedPricingUrl = () => {
    if (!shop?.myshopifyDomain) {
      return "#";
    }
    const storeHandle = shop.myshopifyDomain.replace(/\.myshopify\.com$/i, "");
    const appHandle = getAppHandle(loaderData?.gadgetConfig?.environment || undefined);
    return `https://admin.shopify.com/store/${storeHandle}/charges/${appHandle}/pricing_plans`;
  };

  const handleStartFreeTrial = () => {
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

  const features = [
    {
      title: "One-Click Booking",
      description: "Add a simple 'Book Now' button to your store. Customers can book any service instantly.",
    },
    {
      title: "Seamless Shopify Integration",
      description: "Every booking goes through Shopify Checkout. Upsell products, manage payments, and keep everything in one system.",
    },
    {
      title: "Built for POS",
      description: "Native Shopify POS extension shows upcoming appointments and lets you add them directly to in-store checkout.",
    },
    {
      title: "Staff Management",
      description: "Easily manage staff schedules, track performance, and monitor availability across your team.",
    },
    {
      title: "Multi-Location Support",
      description: "Manage bookings seamlessly across multiple locations, perfect for growing businesses.",
    },
    {
      title: "Flexible Booking Options",
      description: "Customers can prepay online or choose to pay when they arrive. Combine purchases with appointments.",
    },
    {
      title: "Real-Time Schedule",
      description: "View and update your schedule in the admin dashboard or Shopify POS. Make edits and stay organized.",
    },
    {
      title: "Mobile Ready",
      description: "Fully responsive design ensures your booking system works smoothly on any device.",
    },
  ];

  return (
    <Page title="Start Your Free Trial">
      <BlockStack gap="500">
        {/* Hero Section */}
        <Card>
          <BlockStack gap="400">
            <Text variant="heading2xl" as="h1" alignment="center">
              Start Your Free Trial
            </Text>
            <Text variant="headingMd" as="p" alignment="center" tone="subdued">
              Try SimplyBook free for 7 days. Cancel anytime.
            </Text>
            <Box paddingBlockStart="400">
              <InlineStack align="center">
                <Button
                  variant="primary"
                  size="large"
                  onClick={handleStartFreeTrial}
                  disabled={!shop?.myshopifyDomain}
                >
                  Start Free Trial
                </Button>
              </InlineStack>
            </Box>
          </BlockStack>
        </Card>


        {/* Who It's For */}
        <Card>
          <BlockStack gap="400">
            <Text variant="headingLg" as="h2">
              Perfect For Service-Based Businesses
            </Text>
            <Text variant="bodyMd" tone="subdued" as="p">
              SimplyBook works great for:
            </Text>
            <List type="bullet">
              <List.Item>Barber Shops & Hair Salons</List.Item>
              <List.Item>Massage & Wellness Studios</List.Item>
              <List.Item>Personal Trainers & Fitness Coaches</List.Item>
              <List.Item>Pet Groomers</List.Item>
              <List.Item>Photographers & Creatives</List.Item>
              <List.Item>Yoga & Dance Studios</List.Item>
              <List.Item>And any business that takes appointments</List.Item>
            </List>
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}


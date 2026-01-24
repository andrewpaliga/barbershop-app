import { useFindFirst } from "@gadgetinc/react";
import { Page, Card, Text, BlockStack, Button, Banner, Spinner } from "@shopify/polaris";
import { useLoaderData } from "@remix-run/react";
import { api } from "../api";
import { useEffect, useState } from "react";
import { getAppHandle } from "../utils/getAppHandle";

interface PlanRequiredGateProps {
  children: React.ReactNode;
}

// SimplyBook Demo app client_id - skip billing for this app
const DEMO_APP_CLIENT_ID = 'e3a803ffa42eb9db60f394bf72940036';

/**
 * Component that blocks access to protected routes when:
 * - No plan has been selected
 * - Trial has expired
 * 
 * Allows access to the root page (/) even when trial expires.
 * Demo app always has access (billing is skipped).
 */
export function PlanRequiredGate({ children }: PlanRequiredGateProps) {
  // Get environment from loader data if available
  const loaderData = useLoaderData<any>();
  const environment = loaderData?.gadgetConfig?.environment;
  const shopifyApiKey = loaderData?.gadgetConfig?.apiKeys?.shopify;
  
  // Skip billing for demo app even in production environment
  const isDemoApp = shopifyApiKey === DEMO_APP_CLIENT_ID;

  const [{ data: shop, fetching, error: shopError }] = useFindFirst(api.shopifyShop, {
    select: {
      id: true,
      isTrialActive: true,
      trialEndsAt: true,
      billingStatus: true,
      myshopifyDomain: true,
      billingPlan: true,
    },
  });

  const [isChecking, setIsChecking] = useState(true);

  // Demo app always has access - skip all billing checks
  if (isDemoApp) {
    return <>{children}</>;
  }

  // Check access on mount and when shop data changes
  useEffect(() => {
    const checkAccess = () => {
      if (fetching) {
        return;
      }

      setIsChecking(false);
    };

    checkAccess();
  }, [shop, fetching]);

  // Show loading state
  if (fetching || isChecking) {
    return (
      <Page>
        <Card>
          <BlockStack gap="400" align="center">
            <Spinner size="large" />
            <Text as="p" variant="bodyMd" alignment="center">
              Checking subscription status...
            </Text>
          </BlockStack>
        </Card>
      </Page>
    );
  }

  // If there's an error or no shop found, fail open (allow access)
  // This prevents blocking users if there's a temporary issue
  if (shopError || !shop) {
    console.warn("PlanRequiredGate: Unable to load shop information, allowing access", { shopError, shop });
    return <>{children}</>;
  }

  // Check if access should be blocked
  // Only block if we have clear evidence that trial expired or no plan
  const now = new Date();
  const trialEnd = shop.trialEndsAt ? new Date(shop.trialEndsAt) : null;
  // Safely check if trial is expired - only if isTrialActive is explicitly true
  const isTrialExpired = shop.isTrialActive === true && trialEnd && now > trialEnd;
  const hasActivePlan = shop.billingStatus === "active";
  const hasPendingPlan = shop.billingStatus === "pending";
  
  // Only block access if:
  // - Trial is explicitly expired (isTrialActive is true AND trialEnd is in the past)
  // - OR billing status is explicitly "expired" or "no_billing" (and not in trial)
  // Otherwise, allow access (fail open) - this handles cases where fields don't exist yet
  const needsPlan = (shop.isTrialActive === true && isTrialExpired) || 
                    (shop.billingStatus === "expired") || 
                    (shop.billingStatus === "no_billing" && shop.isTrialActive !== true);

  // If access is granted, render children
  if (!needsPlan) {
    return <>{children}</>;
  }

  // Block access - show plan selection screen
  const getPlanSelectionUrl = () => {
    if (!shop.myshopifyDomain) {
      return "#";
    }
    const storeHandle = shop.myshopifyDomain.replace(/\.myshopify\.com$/i, "");
    // Get app handle dynamically based on environment
    const appHandle = getAppHandle(environment);
    return `https://admin.shopify.com/store/${storeHandle}/charges/${appHandle}/pricing_plans`;
  };

  const handleSelectPlan = () => {
    const url = getPlanSelectionUrl();
    if (url !== "#") {
      window.open(url, "_blank");
    }
  };

  const daysRemaining = trialEnd && now < trialEnd 
    ? Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  return (
    <Page>
      <Card>
        <BlockStack gap="400">
          <Banner tone="critical" title="Plan Required">
            <Text as="p" variant="bodyMd">
              {isTrialExpired
                ? "Your trial has ended. Select a plan to continue using SimplyBook."
                : !shop.isTrialActive
                ? "Please select a plan to continue using SimplyBook."
                : `Your trial ends in ${daysRemaining} ${daysRemaining === 1 ? "day" : "days"}. Select a plan to continue.`}
            </Text>
          </Banner>

          <BlockStack gap="300">
            <Text variant="headingLg" as="h2">
              Choose Your Plan
            </Text>
            <Text as="p" variant="bodyMd" tone="subdued">
              Select a plan that works best for your business. You'll have full access to all SimplyBook features.
            </Text>
          </BlockStack>

          <Button variant="primary" size="large" onClick={handleSelectPlan}>
            View Plans & Pricing
          </Button>

          <Text as="p" variant="bodySm" tone="subdued">
            You'll be redirected to Shopify's plan selection page where you can choose and approve your plan.
          </Text>
        </BlockStack>
      </Card>
    </Page>
  );
}


import { useFindFirst, useGlobalAction } from "@gadgetinc/react";
import { Banner, Text, Button, InlineStack } from "@shopify/polaris";
import { useLoaderData } from "@remix-run/react";
import { api } from "../api";
import { useEffect, useState } from "react";
import { getAppHandle } from "../utils/getAppHandle";

interface TrialBannerProps {
  onSelectPlan: () => void;
}

// SimplyBook Demo app client_id - skip billing/trial banners for this app
const DEMO_APP_CLIENT_ID = 'e3a803ffa42eb9db60f394bf72940036';

/**
 * Trial countdown banner component.
 * Shows how many days are left in the trial with a CTA to select a plan.
 * Hidden for demo app.
 */
export function TrialBanner({ onSelectPlan }: TrialBannerProps) {
  // Get environment from loader data if available
  const loaderData = useLoaderData<any>();
  const environment = loaderData?.gadgetConfig?.environment;
  const shopifyApiKey = loaderData?.gadgetConfig?.apiKeys?.shopify;
  
  // Skip showing trial banner for demo app
  const isDemoApp = shopifyApiKey === DEMO_APP_CLIENT_ID;

  const [{ data: shop, fetching }] = useFindFirst(api.shopifyShop, {
    select: {
      id: true,
      isTrialActive: true,
      trialEndsAt: true,
      trialDaysRemaining: true,
      billingStatus: true,
      myshopifyDomain: true,
    },
  });

  const [{ fetching: syncing }, syncStatus] = useGlobalAction(api.syncManagedPricingStatus);
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null);
  const [hasSynced, setHasSynced] = useState(false);

  // Auto-sync subscription status on first load if billing fields are not set
  useEffect(() => {
    if (!shop || fetching || syncing || hasSynced) {
      return;
    }

    // If billing status is null/undefined, sync to check for existing subscription/trial
    const needsSync = !shop.billingStatus || shop.billingStatus === "no_billing";
    
    if (needsSync && shop.id) {
      setHasSynced(true);
      syncStatus({}).catch((error) => {
        console.error("Error syncing billing status:", error);
        setHasSynced(false); // Allow retry on error
      });
    } else {
      setHasSynced(true);
    }
  }, [shop, fetching, syncing, hasSynced, syncStatus]);

  // Calculate days remaining - prefer trialDaysRemaining from Shopify, fallback to calculating from trialEndsAt
  // This runs on mount and updates every minute to keep countdown accurate
  useEffect(() => {
    const calculateDaysRemaining = () => {
      // First, try to use trialDaysRemaining directly from Shopify (most accurate)
      if (shop?.trialDaysRemaining !== null && shop?.trialDaysRemaining !== undefined) {
        setDaysRemaining(Math.max(0, shop.trialDaysRemaining));
        return;
      }
      
      // Fallback: calculate from trialEndsAt if trialDaysRemaining not available
      if (shop?.trialEndsAt) {
        const now = new Date();
        const trialEnd = new Date(shop.trialEndsAt);
        const diffTime = trialEnd.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        setDaysRemaining(Math.max(0, diffDays));
      } else if (shop?.isTrialActive && !shop.trialEndsAt && !shop.trialDaysRemaining) {
        // If trial is active but no data stored, sync to get it
        if (!syncing && hasSynced) {
          syncStatus({});
        }
        setDaysRemaining(null);
      } else {
        setDaysRemaining(null);
      }
    };

    // Calculate immediately
    calculateDaysRemaining();

    // Update every minute to keep countdown accurate
    const interval = setInterval(calculateDaysRemaining, 60000);

    return () => clearInterval(interval);
  }, [shop?.trialEndsAt, shop?.trialDaysRemaining, shop?.isTrialActive, syncStatus, syncing, hasSynced]);

  // Don't show banner if:
  // - Demo app (skip all billing-related UI)
  // - Still loading shop data
  // - Still syncing and we haven't synced before
  // - Billing status is active (paid plan, not in trial)
  if (isDemoApp || fetching || (syncing && !hasSynced) || shop?.billingStatus === "active") {
    return null;
  }

  // Show banner if:
  // - Trial is active, OR
  // - No billing status set yet (hasn't selected plan), OR
  // - Billing status is "no_billing" or null
  const shouldShowBanner = 
    shop?.isTrialActive === true || 
    !shop?.billingStatus || 
    shop?.billingStatus === "no_billing" ||
    shop?.billingStatus === "pending";

  if (!shouldShowBanner) {
    return null;
  }

  // Get the plan selection URL
  const getPlanSelectionUrl = () => {
    if (!shop?.myshopifyDomain) {
      return "#";
    }
    // Extract store handle from myshopifyDomain (e.g., "store.myshopify.com" -> "store")
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
    onSelectPlan();
  };

  // Determine banner tone and message based on state
  let tone: "info" | "warning" | "critical" = "info";
  let message = "";

  // If no billing status, they haven't selected a plan yet
  if (!shop?.billingStatus || shop?.billingStatus === "no_billing") {
    message = "Select a plan to start using SimplyBook. You'll have full access during your trial period.";
  } else if (shop?.billingStatus === "pending") {
    message = "Your plan selection is pending approval. You'll have full access once approved.";
  } else if (shop?.isTrialActive) {
    // Show countdown when in trial
    if (daysRemaining === null) {
      message = "Your trial is active. Select a plan to continue using SimplyBook after your trial ends.";
    } else if (daysRemaining === 0) {
      tone = "critical";
      message = "Your trial has ended today. Select a plan to continue using SimplyBook.";
    } else if (daysRemaining === 1) {
      tone = "warning";
      message = "Your trial ends tomorrow. Select a plan to continue using SimplyBook.";
    } else if (daysRemaining <= 3) {
      tone = "warning";
      message = `Your trial ends in ${daysRemaining} days. Select a plan to continue using SimplyBook.`;
    } else {
      message = `Your trial ends in ${daysRemaining} days. Select a plan to continue using SimplyBook.`;
    }
  } else {
    message = "Select a plan to continue using SimplyBook.";
  }

  // Create title with countdown: "X Day Trial Period"
  const getBannerTitle = () => {
    if (shop?.isTrialActive && daysRemaining !== null && daysRemaining > 0) {
      return `${daysRemaining} ${daysRemaining === 1 ? "Day" : "Days"} Trial Period`;
    }
    // Fallback if trial is active but days not calculated yet
    if (shop?.isTrialActive) {
      return "Trial Period";
    }
    // If no plan selected yet
    return "Trial Period";
  };

  return (
    <Banner
      tone={tone}
      title={getBannerTitle()}
      action={{
        content: "Select a Plan",
        onAction: handleSelectPlan,
      }}
    >
      <Text as="p" variant="bodyMd">
        {message}
      </Text>
    </Banner>
  );
}


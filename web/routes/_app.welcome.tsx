import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "@remix-run/react";
import { useGlobalAction } from "@gadgetinc/react";
import { Page, Card, Spinner, Banner, BlockStack, Text } from "@shopify/polaris";
import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { api } from "../api";

export const loader = async ({ context }: LoaderFunctionArgs) => {
  return json({
    gadgetConfig: context.gadgetConfig,
  });
};

/**
 * Welcome link handler for managed pricing.
 * Shopify redirects here after a merchant approves a plan selection.
 * URL format: /welcome?charge_id=...&shop=store.myshopify.com
 * 
 * After processing, redirects to dashboard with success banner.
 */
export default function Welcome() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [{ data, error, fetching }, syncStatus] = useGlobalAction(api.syncManagedPricingStatus);
  const [isProcessing, setIsProcessing] = useState(true);
  const [showSuccess, setShowSuccess] = useState(false);

  const chargeId = searchParams.get("charge_id");
  const shop = searchParams.get("shop");

  useEffect(() => {
    const processWelcome = async () => {
      if (!chargeId) {
        setIsProcessing(false);
        // If no charge ID, just redirect to dashboard
        setTimeout(() => {
          navigate("/");
        }, 1000);
        return;
      }

      try {
        // Sync subscription status from Shopify
        await syncStatus({});
        setShowSuccess(true);
        
        // Redirect to dashboard after showing success message
        setTimeout(() => {
          navigate("/?planActivated=true");
        }, 2000);
      } catch (err) {
        console.error("Error processing welcome:", err);
        setIsProcessing(false);
        // Still redirect even on error
        setTimeout(() => {
          navigate("/");
        }, 2000);
      }
    };

    processWelcome();
  }, [chargeId, syncStatus, navigate]);

  return (
    <Page title="Welcome to SimplyBook">
      <BlockStack gap="400">
        {error && (
          <Banner tone="critical">
            <Text as="p" variant="bodyMd">
              Error processing plan selection: {error.toString()}
            </Text>
          </Banner>
        )}

        {showSuccess && (
          <Banner tone="success" title="Plan Activated Successfully!">
            <Text as="p" variant="bodyMd">
              Your plan has been activated. Redirecting to your dashboard...
            </Text>
          </Banner>
        )}

        {(fetching || isProcessing) && chargeId && !error && (
          <Card>
            <BlockStack gap="400" align="center">
              <Spinner size="large" />
              <Text as="p" variant="bodyMd" alignment="center">
                Activating your plan...
              </Text>
            </BlockStack>
          </Card>
        )}
      </BlockStack>
    </Page>
  );
}


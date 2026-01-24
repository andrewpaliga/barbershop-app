import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "@remix-run/react";
import { useGlobalAction } from "@gadgetinc/react";
import { Page, Card, Spinner, Banner, BlockStack, Text } from "@shopify/polaris";
import { api } from "../api";

export default function BillingCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [{ data, error, fetching }, confirmBillingCharge] = useGlobalAction(api.confirmBillingCharge);
  const [isProcessing, setIsProcessing] = useState(true);
  const [showSuccess, setShowSuccess] = useState(false);

  const chargeId = searchParams.get("charge_id");

  useEffect(() => {
    const processCharge = async () => {
      if (!chargeId) {
        setIsProcessing(false);
        return;
      }

      try {
        await confirmBillingCharge({ chargeId });
        setShowSuccess(true);
        
        // Redirect to home page after 2 seconds
        setTimeout(() => {
          navigate("/");
        }, 2000);
      } catch (err) {
        setIsProcessing(false);
      }
    };

    processCharge();
  }, [chargeId, confirmBillingCharge, navigate]);

  return (
    <Page title="Billing Confirmation">
      <BlockStack gap="400">
        {!chargeId && (
          <Banner tone="critical">
            <Text as="p" variant="bodyMd">
              No charge ID provided in the callback.
            </Text>
          </Banner>
        )}

        {error && (
          <Banner tone="critical">
            <Text as="p" variant="bodyMd">
              Error confirming billing charge: {error.toString()}
            </Text>
          </Banner>
        )}

        {showSuccess && data && (
          <Banner tone="success">
            <Text as="p" variant="bodyMd">
              Billing charge confirmed successfully! Redirecting to home page...
            </Text>
          </Banner>
        )}

        {(fetching || isProcessing) && chargeId && !error && (
          <Card>
            <BlockStack gap="400" align="center">
              <Spinner size="large" />
              <Text as="p" variant="bodyMd" alignment="center">
                Processing your billing approval...
              </Text>
            </BlockStack>
          </Card>
        )}
      </BlockStack>
    </Page>
  );
}
import { useEffect, useState } from "react";
import { useLoaderData } from "@remix-run/react";
import { json, type LoaderFunctionArgs } from "@remix-run/node";
import {
  Page,
  Card,
  Banner,
  Button,
  BlockStack,
  Text,
  Spinner,
} from "@shopify/polaris";
import { useAppBridge } from "@shopify/app-bridge-react";
import { Redirect } from "@shopify/app-bridge/actions";
import { useGlobalAction } from "@gadgetinc/react";
import { api } from "../api";

export async function loader({ context }: LoaderFunctionArgs) {
  const session = await context.api.session.findFirst({
    select: {
      id: true,
      shop: {
        id: true,
        myshopifyDomain: true,
        billingStatus: true,
      },
    },
  });

  if (!session?.shop) {
    throw new Response("Shop not found", { status: 404 });
  }

  return json({
    shopId: session.shop.id,
    myshopifyDomain: session.shop.myshopifyDomain,
    initialBillingStatus: session.shop.billingStatus,
  });
}

export default function BillingPage() {
  const { shopId, myshopifyDomain, initialBillingStatus } = useLoaderData<typeof loader>();
  const [billingStatus, setBillingStatus] = useState<{
    isActive: boolean;
    checked: boolean;
  } | null>(null);

  const app = useAppBridge();

  const [{ data: syncData, fetching: syncFetching, error: syncError }, syncPricing] =
    useGlobalAction(api.syncManagedPricingStatus);

  // Extract store handle from myshopifyDomain
  const storeHandle = myshopifyDomain?.replace('.myshopify.com', '') || '';
  const appHandle = 'simplybook';
  const pricingPlansUrl = `https://admin.shopify.com/store/${storeHandle}/charges/${appHandle}/pricing_plans`;

  // Sync pricing status on mount
  useEffect(() => {
    const checkBilling = async () => {
      try {
        const result = await syncPricing({ shopId });
        
        // Handle different possible result shapes
        const resultData = result?.result || result;
        
        setBillingStatus({
          isActive: resultData?.isActive || false,
          checked: true,
        });
      } catch (error) {
        // Still mark as checked even on error so we exit loading state
        setBillingStatus({
          isActive: false,
          checked: true,
        });
      }
    };

    checkBilling();
  }, [shopId, syncPricing]);

  const handleRedirect = () => {
    if (pricingPlansUrl && pricingPlansUrl !== "#" && app) {
      // Use App Bridge v4 Redirect action
      const redirect = Redirect.create(app);
      // Dispatch REMOTE redirect to navigate to the full URL (breaks out of iframe)
      redirect.dispatch(Redirect.Action.REMOTE, pricingPlansUrl);
    }
  };

  const isLoading = syncFetching || !billingStatus?.checked;
  const hasError = syncError;

  return (
    <Page title="Billing">
      <BlockStack gap="400">
        {hasError && (
          <Banner tone="critical">
            <Text as="p" variant="bodyMd">
              Error: {syncError?.message}
            </Text>
          </Banner>
        )}

        <Card>
          <BlockStack gap="400">
            {isLoading ? (
              <BlockStack gap="200" align="center">
                <Spinner size="large" />
                <Text as="p" variant="bodyMd">
                  Checking billing status...
                </Text>
              </BlockStack>
            ) : billingStatus?.isActive ? (
              <Banner tone="success">
                <Text as="p" variant="bodyMd">
                  Your billing is active and verified. Thank you for your subscription!
                </Text>
              </Banner>
            ) : (
              <BlockStack gap="400">
                <Banner tone="warning">
                  <Text as="p" variant="bodyMd">
                    Billing is not active. Please select a plan to continue using the app.
                  </Text>
                </Banner>

                <Button
                  variant="primary"
                  onClick={handleRedirect}
                >
                  Select a Plan
                </Button>
              </BlockStack>
            )}
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}
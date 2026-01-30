import { useLoaderData, Outlet } from "@remix-run/react";
import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { Page, Card, Text, Box } from "@shopify/polaris";
import { NavMenu } from "../components/NavMenu";
import { POSRedirect } from "../components/POSRedirect";
import { BillingSyncAndRedirect } from "../components/BillingSyncAndRedirect";
import { LogRocketIdentify } from "../components/LogRocketIdentify";

export const loader = async ({ context }: LoaderFunctionArgs) => {
  return json({
    gadgetConfig: context.gadgetConfig,
  });
};

export default function() {
  const { gadgetConfig } = useLoaderData<typeof loader>();

  if (gadgetConfig.shopifyInstallState) {
    return (
      <>
        <LogRocketIdentify />
        <BillingSyncAndRedirect />
        <POSRedirect />
        <NavMenu />
        <Outlet />
      </>
    );
  } else {
    return <Unauthenticated />;
  }
}

const Unauthenticated = () => {
  const { gadgetConfig } = useLoaderData<typeof loader>();

  return (
    <Page>
      <div style={{ height: "80px" }}>
        <Card padding="500">
          <Text variant="headingLg" as="h1">
            App must be viewed in the Shopify Admin
          </Text>
          <Box paddingBlockStart="200">
            <Text variant="bodyLg" as="p">
              Edit this page:{" "}
              <a
                href={`/edit/${gadgetConfig.environment}/files/web/components/App.tsx`}
              >
                web/components/App.tsx
              </a>
            </Text>
          </Box>
        </Card>
      </div>
    </Page>
  );
};

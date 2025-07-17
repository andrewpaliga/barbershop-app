import { Meta, Links, Scripts, ScrollRestoration, useLoaderData, useLocation, Outlet } from "@remix-run/react";
import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { AppProvider } from "@shopify/polaris";
import enTranslations from "@shopify/polaris/locales/en.json";
import {
  AppType,
  Provider as GadgetProvider,
} from "@gadgetinc/react-shopify-app-bridge";
import { Provider as GadgetReactProvider } from "@gadgetinc/react";
import "./app.css";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import { Suspense } from "react";
import { api } from "./api";
import { AdaptorLink } from "./components/AdaptorLink";
import { FullPageSpinner } from "./components/FullPageSpinner";
import { Component, ErrorInfo, ReactNode } from "react";

export const links = () => [
  {
    rel: "stylesheet",
    href: polarisStyles,
  },
  {
    rel: "stylesheet",
    href: "https://assets.gadget.dev/assets/reset.min.css"
  }
];

export const meta = () => [
  { charset: "utf-8" },
  {
    name: "viewport",
    content: "width=device-width, initial-scale=1",
  },
  {
    title: "Gadget Shopify Remix app",
  },
  {
    name: "shopify-api-key",
    suppressHydrationWarning: true,
    content: "%SHOPIFY_API_KEY%"
  },
];

export const loader = async ({ context }: LoaderFunctionArgs) => {
  return json({
    gadgetConfig: context.gadgetConfig,
  });
};

export const Layout = ({ children }: { children: React.ReactNode; }) => {
  return (
    <html lang="en">
      <head>
        <Meta />
        <script src="https://cdn.shopify.com/shopifycloud/app-bridge.js"></script>
        <Links />
      </head>
      <body>
        <Suspense fallback={<FullPageSpinner />}>
          {children}
        </Suspense>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
};

export default function App() {
  const { gadgetConfig } = useLoaderData<typeof loader>();
  const location = useLocation();

  return (
    <GadgetProvider
      type={AppType.Embedded}
      shopifyApiKey={gadgetConfig?.apiKeys?.shopify ?? ""}
      api={api}
      location={location}
      shopifyInstallState={gadgetConfig?.shopifyInstallState}
    >
      <GadgetReactProvider api={api}>
        <AppProvider i18n={enTranslations} linkComponent={AdaptorLink}>
          <Outlet />
        </AppProvider>
      </GadgetReactProvider>
    </GadgetProvider>
  );
}

// Custom error boundary that doesn't rely on Remix hooks
class CustomErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <html lang="en">
          <head>
            <meta charSet="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <title>Something went wrong</title>
          </head>
          <body style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
            <h1>Something went wrong</h1>
            <p>We're sorry, but something unexpected happened. Please try refreshing the page.</p>
            <details style={{ marginTop: '1rem' }}>
              <summary>Error details</summary>
              <pre style={{ marginTop: '0.5rem', background: '#f5f5f5', padding: '1rem', borderRadius: '4px', overflow: 'auto' }}>
                {this.state.error?.toString()}
              </pre>
            </details>
          </body>
        </html>
      );
    }

    return this.props.children;
  }
}

export const ErrorBoundary = CustomErrorBoundary;

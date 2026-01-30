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
import { Suspense, useEffect } from "react";
import { Client, api } from "./api";
import { AdaptorLink } from "./components/AdaptorLink";
import { FullPageSpinner } from "./components/FullPageSpinner";
import { Component, ErrorInfo, ReactNode } from "react";
import { initLogRocket } from "./utils/logrocket";

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
    title: "SimplyBook",
  },
  {
    name: "shopify-api-key",
    suppressHydrationWarning: true,
    content: "%SHOPIFY_API_KEY%"
  },
];

export const loader = async ({ context }: LoaderFunctionArgs) => {
  try {
    return json({
      gadgetConfig: context.gadgetConfig,
    });
  } catch (error) {
    console.error('Error in loader:', error);
    // Return a minimal config to prevent complete failure
    return json({
      gadgetConfig: {
        apiKeys: { shopify: "" },
        shopifyInstallState: undefined,
      },
    });
  }
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
  const loaderData = useLoaderData<typeof loader>();
  const { gadgetConfig } = loaderData || {};
  const location = useLocation();

  // Initialize LogRocket for production session recording
  useEffect(() => {
    if (gadgetConfig) {
      initLogRocket({
        environment: (gadgetConfig as any).environment,
        shopifyApiKey: gadgetConfig.apiKeys?.shopify,
      });
    }
  }, [gadgetConfig]);

  // Show loading spinner if gadgetConfig is not available yet
  if (!gadgetConfig) {
    return <FullPageSpinner />;
  }

  // Ensure we have the required configuration
  const shopifyApiKey = gadgetConfig?.apiKeys?.shopify;
  if (!shopifyApiKey) {
    console.error('Missing Shopify API key in gadgetConfig');
  }

  return (
    <GadgetProvider
      type={AppType.Embedded}
      shopifyApiKey={shopifyApiKey ?? ""}
      location={location}
      shopifyInstallState={(gadgetConfig as any)?.shopifyInstallState}
      api={api}
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
    
    // Log specific provider context errors
    if (error.message?.includes('useContext') || error.message?.includes('Provider')) {
      console.error('Provider context error detected:', error.message);
    }
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
                {this.state.error?.stack && (
                  <>
                    {'\n\nStack trace:\n'}
                    {this.state.error.stack}
                  </>
                )}
              </pre>
            </details>
            <button 
              onClick={() => window.location.reload()} 
              style={{ 
                marginTop: '1rem', 
                padding: '0.5rem 1rem', 
                background: '#007acc', 
                color: 'white', 
                border: 'none', 
                borderRadius: '4px', 
                cursor: 'pointer' 
              }}
            >
              Refresh Page
            </button>
          </body>
        </html>
      );
    }

    return this.props.children;
  }
}

export const ErrorBoundary = CustomErrorBoundary;

import LogRocket from 'logrocket';

// LogRocket App ID for session recording
const LOGROCKET_APP_ID = 'd11pih/simplybook';

// SimplyBook Demo app client_id - skip LogRocket for demo app
const DEMO_APP_CLIENT_ID = 'e3a803ffa42eb9db60f394bf72940036';

let isInitialized = false;

interface InitOptions {
  environment?: string;
  shopifyApiKey?: string;
}

/**
 * Initialize LogRocket for session recording.
 * Only runs in production and skips the demo app.
 */
export function initLogRocket(options: InitOptions = {}) {
  const { environment, shopifyApiKey } = options;
  
  // Only initialize once
  if (isInitialized) {
    return;
  }

  // Skip if not in browser
  if (typeof window === 'undefined') {
    return;
  }

  // Only run in production
  if (environment !== 'production') {
    console.log('[LogRocket] Skipping - not production environment');
    return;
  }

  // Skip for demo app
  if (shopifyApiKey === DEMO_APP_CLIENT_ID) {
    console.log('[LogRocket] Skipping - demo app');
    return;
  }

  try {
    LogRocket.init(LOGROCKET_APP_ID, {
      console: {
        isEnabled: true,
      },
      network: {
        isEnabled: true,
        // Don't capture request/response bodies to protect sensitive data
        requestSanitizer: (request) => {
          // Remove sensitive headers
          if (request.headers) {
            delete request.headers['Authorization'];
            delete request.headers['Cookie'];
          }
          return request;
        },
      },
    });

    isInitialized = true;
    console.log('[LogRocket] Initialized successfully');
  } catch (error) {
    console.error('[LogRocket] Failed to initialize:', error);
  }
}

/**
 * Identify the current user/shop for better session tracking.
 * Call this after the shop data is loaded.
 */
export function identifyShop(shop: {
  id?: string;
  myshopifyDomain?: string | null;
  name?: string | null;
}) {
  if (!isInitialized || typeof window === 'undefined') {
    return;
  }

  if (!shop?.id) {
    return;
  }

  try {
    LogRocket.identify(shop.id, {
      name: shop.name || shop.myshopifyDomain || 'Unknown Shop',
      domain: shop.myshopifyDomain || undefined,
    });
    console.log('[LogRocket] Identified shop:', shop.myshopifyDomain);
  } catch (error) {
    console.error('[LogRocket] Failed to identify shop:', error);
  }
}

/**
 * Track a custom event in LogRocket.
 */
export function trackEvent(eventName: string, properties?: Record<string, unknown>) {
  if (!isInitialized || typeof window === 'undefined') {
    return;
  }

  try {
    LogRocket.track(eventName, properties);
  } catch (error) {
    console.error('[LogRocket] Failed to track event:', error);
  }
}

/**
 * Get the LogRocket session URL for linking to error tracking tools.
 */
export function getSessionURL(callback: (url: string | null) => void) {
  if (!isInitialized || typeof window === 'undefined') {
    callback(null);
    return;
  }

  LogRocket.getSessionURL(callback);
}

export { LogRocket };

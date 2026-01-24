import { useEffect, useRef } from 'react';
import { useFindFirst, useGlobalAction } from '@gadgetinc/react';
import { useLocation, useLoaderData, useNavigate } from '@remix-run/react';
import { api } from '../api';

const SYNC_CACHE_KEY = 'billing_sync_session';
const SYNC_CACHE_DURATION_MS = 60 * 60 * 1000; // 1 hour - cache sync for 1 hour per session

// SimplyBook Demo app client_id - skip billing for this app
const DEMO_APP_CLIENT_ID = 'e3a803ffa42eb9db60f394bf72940036';

export const BillingSyncAndRedirect = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const loaderData = useLoaderData<any>();
  const environment = loaderData?.gadgetConfig?.environment;
  const shopifyApiKey = loaderData?.gadgetConfig?.apiKeys?.shopify;
  
  // Skip billing for demo app even in production environment
  const isDemoApp = shopifyApiKey === DEMO_APP_CLIENT_ID;
  const isProduction = environment === 'production' && !isDemoApp;
  const hasSyncedRef = useRef(false);
  const syncInProgressRef = useRef(false);

  // Get current shop with billing status
  const [{ data: shop, fetching: fetchingShop }, refetchShop] = useFindFirst(api.shopifyShop, {
    select: {
      id: true,
      myshopifyDomain: true,
      billingStatus: true,
    },
  });

  // Sync managed pricing status action
  const [{ fetching: syncing }, syncStatus] = useGlobalAction(api.syncManagedPricingStatus);

  // Main effect: Sync on first load and handle redirect logic
  useEffect(() => {
    // In development, allow full access - skip redirect logic but still sync
    if (!isProduction) {
      // Still sync in development for testing, but don't redirect
      if (fetchingShop || !shop?.id) {
        return;
      }
      
      const pathname = location.pathname;
      if (
        pathname.includes('/billing-test') ||
        pathname.includes('/billing-callback') ||
        pathname.includes('/welcome')
      ) {
        return;
      }

      // Check if we should sync based on caching rules (sync logic only, no redirect)
      const shouldSync = (): boolean => {
        if (syncInProgressRef.current || hasSyncedRef.current) {
          return false;
        }

        if (typeof window !== 'undefined') {
          const cachedData = sessionStorage.getItem(SYNC_CACHE_KEY);
          if (cachedData) {
            try {
              const { timestamp } = JSON.parse(cachedData);
              const now = Date.now();
              if (now - timestamp < SYNC_CACHE_DURATION_MS) {
                return false;
              }
            } catch (e) {
              // Invalid cache data, continue to sync
            }
          }
        }
        return true;
      };

      const performSync = async () => {
        if (syncInProgressRef.current) {
          return;
        }
        syncInProgressRef.current = true;
        try {
          await syncStatus({});
          if (typeof window !== 'undefined') {
            sessionStorage.setItem(SYNC_CACHE_KEY, JSON.stringify({ timestamp: Date.now() }));
          }
          hasSyncedRef.current = true;
        } catch (error) {
          console.error('[BillingSyncAndRedirect] Error syncing billing status:', error);
        } finally {
          syncInProgressRef.current = false;
        }
      };

      if (shouldSync()) {
        performSync();
      }
      return;
    }

    // Production: Wait for shop data to load
    if (fetchingShop || !shop?.id) {
      return;
    }

    // Skip on certain pages (they handle their own syncing or are the pay gate page)
    const pathname = location.pathname;
    if (
      pathname.includes('/billing-test') ||
      pathname.includes('/billing-callback') ||
      pathname.includes('/welcome') ||
      pathname.includes('/plan-required')
    ) {
      return;
    }

    // Check if we should sync based on caching rules
    const shouldSync = (): boolean => {
      // Skip if already syncing or synced in this component instance
      if (syncInProgressRef.current || hasSyncedRef.current) {
        return false;
      }

      // Check sessionStorage cache
      if (typeof window !== 'undefined') {
        const cachedData = sessionStorage.getItem(SYNC_CACHE_KEY);
        if (cachedData) {
          try {
            const { timestamp } = JSON.parse(cachedData);
            const now = Date.now();
            // If sync was done within cache duration, skip
            if (now - timestamp < SYNC_CACHE_DURATION_MS) {
              return false;
            }
          } catch (e) {
            // Invalid cache data, continue to sync
          }
        }
      }

      // Sync if we haven't synced in this session or cache expired
      return true;
    };

    // Handle sync
    const performSync = async () => {
      if (syncInProgressRef.current) {
        return;
      }

      syncInProgressRef.current = true;
      try {
        await syncStatus({});
        // Update cache timestamp
        if (typeof window !== 'undefined') {
          sessionStorage.setItem(SYNC_CACHE_KEY, JSON.stringify({ timestamp: Date.now() }));
        }
        hasSyncedRef.current = true;
        // Refetch shop to get updated billingStatus
        await refetchShop();
      } catch (error) {
        console.error('[BillingSyncAndRedirect] Error syncing billing status:', error);
      } finally {
        syncInProgressRef.current = false;
      }
    };

    // Handle redirect to internal pay gate page
    const handleRedirectToPayGate = () => {
      const currentPath = location.pathname;
      // Only redirect if we're not already on the plan-required page
      if (!currentPath.includes('/plan-required')) {
        console.log('[BillingSyncAndRedirect] Redirecting to plan-required page');
        navigate('/plan-required');
      }
    };

    // If billingStatus is missing or "no_billing", sync first then redirect
    if (!shop.billingStatus || shop.billingStatus === 'no_billing') {
      // Check if we're already on plan-required or billing-test page - if so, don't redirect
      if (pathname.includes('/plan-required') || pathname.includes('/billing-test')) {
        // Still sync if needed, but don't redirect
        if (shouldSync()) {
          performSync();
        }
        return;
      }
      
      if (shouldSync()) {
        performSync().then(() => {
          // After sync completes, redirect will be handled in the next effect
        });
      } else {
        // Already synced (cached), redirect immediately
        handleRedirectToPayGate();
      }
      return;
    }

    // If billingStatus exists and is not "no_billing", sync on first load (cached)
    if (shouldSync()) {
      performSync();
    }
  }, [shop?.id, shop?.billingStatus, shop?.myshopifyDomain, fetchingShop, syncStatus, refetchShop, location.pathname, isProduction, navigate]);

  // Handle redirect after sync completes (if billingStatus is still no_billing) - Production only
  // Also check on every location change to ensure we stay on plan-required if no plan
  useEffect(() => {
    // Skip redirect in development
    if (!isProduction) {
      return;
    }

    // Wait for shop data
    if (fetchingShop || !shop?.id) {
      return;
    }

    // Check if billingStatus is missing or "no_billing"
    if (!shop.billingStatus || shop.billingStatus === 'no_billing') {
      const currentPath = location.pathname;
      // Only redirect if we're not already on the plan-required page or billing-test page
      if (!currentPath.includes('/plan-required') && !currentPath.includes('/billing-test')) {
        console.log('[BillingSyncAndRedirect] Billing status is no_billing, redirecting to plan-required page');
        navigate('/plan-required');
      }
    }
  }, [shop?.billingStatus, shop?.id, fetchingShop, location.pathname, isProduction, navigate]);

  return null; // This component doesn't render anything
};

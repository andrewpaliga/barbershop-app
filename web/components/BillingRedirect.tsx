import { useEffect, useRef } from 'react';
import { useFindFirst, useGlobalAction } from '@gadgetinc/react';
import { api } from '../api';

export const BillingRedirect = () => {
  const hasChecked = useRef(false);
  const hasRedirected = useRef(false);

  // Get current shop
  const [{ data: currentShop }] = useFindFirst(api.shopifyShop, {
    select: {
      id: true,
      billingStatus: true,
    },
  });

  // Check billing status
  const [{ data: billingStatus }, checkBillingStatus] = useGlobalAction(
    api.verifyBillingStatus
  );

  // Get billing confirmation URL
  const [, getBillingConfirmationUrl] = useGlobalAction(
    api.getBillingConfirmationUrl
  );

  useEffect(() => {
    // Only check once and if we haven't redirected
    if (hasChecked.current || hasRedirected.current) {
      return;
    }

    // Wait for shop data to load
    if (!currentShop?.id) {
      console.log('[BillingRedirect] Waiting for shop data...');
      return;
    }

    // Skip redirect on billing callback page
    if (window.location.pathname.includes('billing-callback')) {
      console.log('[BillingRedirect] Skipping redirect on billing callback page');
      return;
    }

    const checkAndRedirect = async () => {
      hasChecked.current = true;

      try {
        console.log('[BillingRedirect] Checking billing status for shop:', currentShop.id);
        // Check billing status
        const status = await checkBillingStatus({});
        console.log('[BillingRedirect] Billing status:', status);
        
        // If billing is required and no active subscription, redirect to confirmation
        if (status?.requiresCharge && !status?.isActive) {
          console.log('[BillingRedirect] Billing required, getting confirmation URL...');
          try {
            // Get or create billing confirmation URL
            const result = await getBillingConfirmationUrl({});
            console.log('[BillingRedirect] Confirmation URL result:', result);
            
            if (result?.requiresConfirmation && result?.confirmationUrl) {
              console.log('[BillingRedirect] Redirecting to:', result.confirmationUrl);
              hasRedirected.current = true;
              // Redirect to the confirmation URL
              window.location.href = result.confirmationUrl;
              return;
            } else if (result?.message) {
              console.warn('[BillingRedirect] No confirmation URL, message:', result.message);
            } else {
              console.warn('[BillingRedirect] Unexpected result format:', result);
            }
          } catch (error: any) {
            console.error('[BillingRedirect] Failed to get billing confirmation URL:', error);
            console.error('[BillingRedirect] Error details:', error?.message, error?.stack);
          }
        } else {
          console.log('[BillingRedirect] Billing not required or already active');
        }
      } catch (error: any) {
        console.error('[BillingRedirect] Error checking billing status:', error);
        console.error('[BillingRedirect] Error details:', error?.message, error?.stack);
      }
    };

    // Small delay to avoid redirect loops and ensure page is loaded
    const timer = setTimeout(checkAndRedirect, 1000);
    return () => clearTimeout(timer);
  }, [currentShop?.id, checkBillingStatus, getBillingConfirmationUrl]);

  return null; // This component doesn't render anything
};


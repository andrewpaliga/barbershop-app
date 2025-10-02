import { useEffect, useRef } from 'react';
import { useNavigate } from '@remix-run/react';
import { useAppBridge } from '@shopify/app-bridge-react';

export const POSRedirect = () => {
  const navigate = useNavigate();
  const app = useAppBridge();
  const hasRedirected = useRef(false);

  useEffect(() => {
    if (hasRedirected.current) {
      return;
    }

    const detectPOS = () => {
      const performRedirect = (method: string) => {
        console.log(`POS detected via ${method}, redirecting to /schedule`);
        hasRedirected.current = true;
        navigate('/schedule');
        return true;
      };

      // Method 1: App Bridge platform detection
      try {
        const platform = app?.getState?.()?.platform;
        if (platform === 'pos' || platform === 'POS') {
          return performRedirect('App Bridge platform');
        }
      } catch (error) {
        // Silently continue to next detection method
      }

      // Method 2: URL parameter detection
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const posParam = urlParams.get('pos') || urlParams.get('platform');
        if (posParam === 'pos' || posParam === 'POS') {
          return performRedirect('URL parameters');
        }
      } catch (error) {
        // Silently continue to next detection method
      }

      // Method 3: User agent detection
      try {
        const userAgent = navigator.userAgent;
        if (userAgent.includes('ShopifyPOS') || userAgent.includes('Shopify POS')) {
          return performRedirect('User Agent');
        }
      } catch (error) {
        // Silently continue to next detection method
      }

      // Method 4: Window location checking
      try {
        const location = window.location;
        if (location.href.includes('pos=true') || location.pathname.includes('/pos')) {
          return performRedirect('window location');
        }
      } catch (error) {
        // Silently continue to next detection method
      }

      // Method 5: Check for POS-specific global variables
      try {
        const shopifyPOS = (window as any).ShopifyPOS;
        if (shopifyPOS) {
          return performRedirect('global variables');
        }
      } catch (error) {
        // Silently continue
      }
    };

    // Run detection immediately
    detectPOS();
  }, [app, navigate]);

  return null;
};
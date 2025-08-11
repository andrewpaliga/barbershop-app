import { useEffect, useRef } from 'react';
import { useNavigate } from '@remix-run/react';
import { useAppBridge } from '@shopify/app-bridge-react';

export const POSRedirect = () => {
  const navigate = useNavigate();
  const app = useAppBridge();
  const hasRedirected = useRef(false);

  useEffect(() => {
    console.log('POSRedirect: Component mounted');
    console.log('POSRedirect: hasRedirected.current:', hasRedirected.current);
    console.log('POSRedirect: app:', app);

    if (hasRedirected.current) {
      console.log('POSRedirect: Already redirected, skipping detection');
      return;
    }

    const detectPOS = () => {
      console.log('POSRedirect: Starting POS detection');
      const detectionResults = [];

      const performRedirect = (method: string) => {
        console.log(`POSRedirect: POS detected via ${method}, redirecting to /schedule`);
        detectionResults.push(`✓ POS detected via ${method}`);
        console.log('POSRedirect: Detection results:', detectionResults);
        hasRedirected.current = true;
        navigate('/schedule');
        return true;
      };

      // Method 1: App Bridge platform detection
      try {
        const platform = app?.getState?.()?.platform;
        console.log('POSRedirect: App Bridge platform:', platform);
        detectionResults.push(`App Bridge platform: ${platform}`);
        
        if (platform === 'pos' || platform === 'POS') {
          return performRedirect('App Bridge platform');
        }
      } catch (error) {
        console.error('POSRedirect: Error accessing App Bridge platform:', error);
        detectionResults.push(`App Bridge platform error: ${error.message}`);
      }

      // Method 2: Try alternative App Bridge methods
      try {
        const appState = app?.getState?.();
        console.log('POSRedirect: Full App Bridge state:', appState);
        detectionResults.push(`App Bridge state: ${JSON.stringify(appState)}`);

        // Try different property paths
        const context = app?.context;
        console.log('POSRedirect: App Bridge context:', context);
        detectionResults.push(`App Bridge context: ${JSON.stringify(context)}`);
      } catch (error) {
        console.error('POSRedirect: Error accessing App Bridge state:', error);
        detectionResults.push(`App Bridge state error: ${error.message}`);
      }

      // Method 3: URL parameter detection
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const posParam = urlParams.get('pos') || urlParams.get('platform');
        console.log('POSRedirect: URL parameters:', Object.fromEntries(urlParams.entries()));
        detectionResults.push(`URL parameters: ${JSON.stringify(Object.fromEntries(urlParams.entries()))}`);
        
        if (posParam === 'pos' || posParam === 'POS') {
          return performRedirect('URL parameters');
        }
      } catch (error) {
        console.error('POSRedirect: Error checking URL parameters:', error);
        detectionResults.push(`URL parameters error: ${error.message}`);
      }

      // Method 4: User agent detection
      try {
        const userAgent = navigator.userAgent;
        console.log('POSRedirect: User agent:', userAgent);
        detectionResults.push(`User agent: ${userAgent}`);
        
        // Check for POS-specific patterns in user agent
        if (userAgent.includes('ShopifyPOS') || userAgent.includes('Shopify POS')) {
          return performRedirect('User Agent');
        }
      } catch (error) {
        console.error('POSRedirect: Error checking user agent:', error);
        detectionResults.push(`User agent error: ${error.message}`);
      }

      // Method 5: Window location checking
      try {
        const location = window.location;
        console.log('POSRedirect: Window location:', {
          href: location.href,
          pathname: location.pathname,
          search: location.search,
          hash: location.hash,
          host: location.host
        });
        detectionResults.push(`Window location: ${location.href}`);
        
        // Check for POS-specific patterns in URL
        if (location.href.includes('pos=true') || location.pathname.includes('/pos')) {
          return performRedirect('window location');
        }
      } catch (error) {
        console.error('POSRedirect: Error checking window location:', error);
        detectionResults.push(`Window location error: ${error.message}`);
      }

      // Method 6: Check for POS-specific global variables
      try {
        const shopifyPOS = (window as any).ShopifyPOS;
        const shopifyApp = (window as any).ShopifyApp;
        console.log('POSRedirect: Shopify globals:', { shopifyPOS, shopifyApp });
        detectionResults.push(`Shopify globals: POS=${!!shopifyPOS}, App=${!!shopifyApp}`);
        
        if (shopifyPOS) {
          return performRedirect('global variables');
        }
      } catch (error) {
        console.error('POSRedirect: Error checking globals:', error);
        detectionResults.push(`Globals error: ${error.message}`);
      }

      console.log('POSRedirect: Detection results:', detectionResults);
      console.log('POSRedirect: POS not detected, staying on current page');
    };

    // Run detection immediately
    detectPOS();
  }, [app, navigate]);

  return null;
};
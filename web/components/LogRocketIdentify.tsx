import { useEffect } from 'react';
import { useFindFirst } from '@gadgetinc/react';
import { api } from '../api';
import { identifyShop } from '../utils/logrocket';

/**
 * Component that identifies the current shop in LogRocket.
 * Add this component anywhere that has access to the Gadget API context.
 * It doesn't render anything visible.
 */
export function LogRocketIdentify() {
  const [{ data: shop }] = useFindFirst(api.shopifyShop, {
    select: {
      id: true,
      myshopifyDomain: true,
      name: true,
    },
  });

  useEffect(() => {
    if (shop) {
      identifyShop({
        id: shop.id,
        myshopifyDomain: shop.myshopifyDomain,
        name: shop.name,
      });
    }
  }, [shop]);

  return null;
}

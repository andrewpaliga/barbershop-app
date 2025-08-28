import { ActionOptions } from "gadget-server";

export const run: ActionRun = async ({ params, logger, api, connections }) => {
  try {
    // Get shop ID
    const shopId = connections.shopify.currentShopId;
    if (!shopId) {
      throw new Error("No shop context available");
    }

    // Connect to Shopify
    const shopify = await connections.shopify.forShopId(shopId);
    
    // Query to get products with variants and pricing
    const query = `
      query GetProducts($first: Int!) {
        products(first: $first) {
          edges {
            node {
              id
              title
              handle
              status
              productType
              variants(first: 10) {
                nodes {
                  id
                  price
                  selectedOptions {
                    name
                    value
                  }
                }
              }
              variantsCount {
                count
              }
            }
          }
        }
      }
    `;

    const variables = { first: 50 };
    
    const result = await shopify.graphql(query, variables);
    
    if (result?.data?.products?.edges) {
      const products = result.data.products.edges.map((edge: any) => edge.node);
      
      // Filter to only show services using productType
      const services = products.filter((product: any) => 
        product.productType === "Service" || 
        product.productType === "service" || 
        product.productType === "SERVICE"
      );
      
      return {
        success: true,
        products: services
      };
    }
    
    return {
      success: true,
      products: []
    };

  } catch (error: any) {
    throw new Error(`Failed to fetch products: ${error.message}`);
  }
};

export const params = {};

export const options: ActionOptions = {
  returnType: true
};

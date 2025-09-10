export const run: ActionRun = async ({ params, logger, api, connections }) => {
  const { shopId, orderId } = params;
  
  if (!shopId) {
    throw new Error("shopId parameter is required");
  }

  logger.info(`Debugging Shopify client for shop: ${shopId}`);
  
  const results = {
    shopId,
    orderId,
    clientInfo: {},
    simpleQueryTest: {},
    orderCancelTest: {},
    summary: {}
  };

  try {
    // Get Shopify client
    const shopify = await connections.shopify.forShopId(shopId);
    
    // Log essential client structure
    results.clientInfo = {
      hasClient: !!shopify,
      hasGraphQL: !!shopify?.graphql,
      hasGraphQLQuery: typeof shopify?.graphql?.query === 'function',
      clientType: shopify?.constructor?.name || 'unknown'
    };
    
    logger.info("Client structure:", results.clientInfo);

    // Test simple GraphQL query
    try {
      const shopQuery = `
        query {
          shop {
            id
            name
            myshopifyDomain
          }
        }
      `;
      
      const queryResult = await shopify.graphql.query(shopQuery);
      results.simpleQueryTest = {
        success: true,
        hasData: !!queryResult?.data,
        shopName: queryResult?.data?.shop?.name,
        errors: queryResult?.errors || null
      };
      
      logger.info("Simple query test successful");
    } catch (error) {
      results.simpleQueryTest = {
        success: false,
        error: error.message,
        errorType: error.constructor.name
      };
      logger.error("Simple query failed:", error.message);
    }

    // Test order cancel mutation if orderId provided
    if (orderId) {
      try {
        const cancelMutation = `
          mutation orderCancel($orderId: ID!, $reason: OrderCancelReason!) {
            orderCancel(orderId: $orderId, reason: $reason) {
              order {
                id
                cancelled
                cancelReason
              }
              userErrors {
                field
                message
              }
            }
          }
        `;
        
        const variables = {
          orderId: `gid://shopify/Order/${orderId}`,
          reason: "OTHER"
        };
        
        const cancelResult = await shopify.graphql.query(cancelMutation, variables);
        
        results.orderCancelTest = {
          success: true,
          hasUserErrors: !!(cancelResult?.data?.orderCancel?.userErrors?.length),
          userErrors: cancelResult?.data?.orderCancel?.userErrors || [],
          orderCancelled: cancelResult?.data?.orderCancel?.order?.cancelled,
          errors: cancelResult?.errors || null
        };
        
        logger.info("Order cancel test completed");
      } catch (error) {
        results.orderCancelTest = {
          success: false,
          error: error.message,
          errorType: error.constructor.name,
          stack: error.stack?.split('\n').slice(0, 3).join('\n') // First 3 lines of stack
        };
        logger.error("Order cancel test failed:", error.message);
      }
    } else {
      results.orderCancelTest = {
        skipped: true,
        reason: "No orderId provided"
      };
    }

    // Generate summary
    results.summary = {
      clientWorking: results.clientInfo.hasClient && results.clientInfo.hasGraphQL,
      simpleQueryWorking: results.simpleQueryTest.success,
      orderCancelWorking: orderId ? results.orderCancelTest.success : "not_tested",
      mainIssues: []
    };

    if (!results.clientInfo.hasClient) {
      results.summary.mainIssues.push("No Shopify client available");
    }
    if (!results.clientInfo.hasGraphQL) {
      results.summary.mainIssues.push("Client missing GraphQL functionality");
    }
    if (!results.simpleQueryTest.success) {
      results.summary.mainIssues.push("Basic GraphQL queries failing");
    }
    if (orderId && !results.orderCancelTest.success) {
      results.summary.mainIssues.push("Order cancel mutation failing");
    }

    logger.info("Debug summary:", results.summary);
    
  } catch (error) {
    logger.error("Critical error during debugging:", error);
    results.summary = {
      criticalError: true,
      error: error.message,
      errorType: error.constructor.name
    };
  }

  return results;
};

export const params = {
  shopId: {
    type: "string"
  },
  orderId: {
    type: "string"
  }
};

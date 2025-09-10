import { ActionOptions } from "gadget-server";

export const run: ActionRun = async ({ params, logger, api, connections }) => {
  const { orderId, shopId } = params;
  
  logger.info("Starting testOrderCancellation action", { orderId, shopId });
  
  if (!orderId || !shopId) {
    throw new Error("Both orderId and shopId parameters are required");
  }
  
  // Validate that orderId is numeric (for REST API calls)
  const numericOrderId = orderId.replace(/[^\d]/g, '');
  if (!numericOrderId || numericOrderId !== orderId) {
    logger.warn("Order ID contains non-numeric characters", { 
      originalOrderId: orderId, 
      numericOrderId: numericOrderId 
    });
  }
  
  logger.info("Order ID validation", { 
    originalOrderId: orderId, 
    numericOrderId: numericOrderId,
    isNumeric: /^\d+$/.test(orderId)
  });
  
  const results = {
    orderId,
    shopId,
    shopifyClient: null as any,
    orderQuery: null as any,
    fulfillmentOrders: null as any,
    fulfillmentCancellations: [] as any[],
    graphqlCancellation: null as any,
    restCancellation: null as any,
    errors: [] as any[]
  };
  
  try {
    // Get Shopify client for the specific shop
    const shopify = await connections.shopify.forShopId(shopId);
    
    // Deep inspection of the shopify client structure
    const deepInspection = {
      type: typeof shopify,
      constructor: shopify?.constructor?.name,
      ownProperties: Object.getOwnPropertyNames(shopify),
      ownPropertyDescriptors: Object.getOwnPropertyDescriptors(shopify),
      prototype: Object.getOwnPropertyNames(Object.getPrototypeOf(shopify)),
      prototypeDescriptors: Object.getOwnPropertyDescriptors(Object.getPrototypeOf(shopify)),
      allKeys: Object.keys(shopify),
      hasGraphQL: 'graphql' in shopify,
      hasGraphQLMethod: typeof shopify?.graphql === 'function',
      hasQuery: 'query' in shopify,
      hasQueryMethod: typeof shopify?.query === 'function',
      hasRest: 'rest' in shopify,
      hasOrder: 'order' in shopify,
      hasClient: 'client' in shopify,
      hasShopify: 'shopify' in shopify,
      stringRepresentation: shopify.toString(),
    };
    
    // Also check nested objects
    if (shopify.client) {
      deepInspection.clientProperties = Object.getOwnPropertyNames(shopify.client);
      deepInspection.clientType = typeof shopify.client;
    }
    
    if (shopify.rest) {
      deepInspection.restProperties = Object.getOwnPropertyNames(shopify.rest);
      deepInspection.restType = typeof shopify.rest;
    }
    
    if (shopify.graphql) {
      deepInspection.graphqlType = typeof shopify.graphql;
      deepInspection.graphqlProperties = Object.getOwnPropertyNames(shopify.graphql);
    }
    
    logger.info("Deep Shopify client inspection", deepInspection);
    
    results.shopifyClient = deepInspection;
    
    // Query the order first to see its current state
    logger.info("Querying order state", { orderId });
    try {
      let orderQueryResult = null;
      let queryMethod = null;
      
      const query = `
        query getOrder($id: ID!) {
          order(id: $id) {
            id
            name
            displayFinancialStatus
            displayFulfillmentStatus
            cancelled
            cancelledAt
            cancelReason
            canManuallyResolve
            tags
            fulfillmentOrders(first: 10) {
              edges {
                node {
                  id
                  status
                  requestStatus
                  supportedActions {
                    action
                    externalUrl
                  }
                }
              }
            }
          }
        }
      `;
      
      const variables = { id: `gid://shopify/Order/${orderId}` };
      
      // Try different methods to make GraphQL calls
      if (typeof shopify?.graphql === 'function') {
        logger.info("Trying shopify.graphql method");
        queryMethod = "shopify.graphql";
        orderQueryResult = await shopify.graphql(query, variables);
      } else if (typeof shopify?.query === 'function') {
        logger.info("Trying shopify.query method");
        queryMethod = "shopify.query";
        orderQueryResult = await shopify.query(query, variables);
      } else if (typeof shopify?.client?.graphql === 'function') {
        logger.info("Trying shopify.client.graphql method");
        queryMethod = "shopify.client.graphql";
        orderQueryResult = await shopify.client.graphql(query, variables);
      } else if (typeof shopify?.client?.query === 'function') {
        logger.info("Trying shopify.client.query method");
        queryMethod = "shopify.client.query";
        orderQueryResult = await shopify.client.query(query, variables);
      } else if (shopify?.graphql && typeof shopify.graphql.query === 'function') {
        logger.info("Trying shopify.graphql.query method");
        queryMethod = "shopify.graphql.query";
        orderQueryResult = await shopify.graphql.query(query, variables);
      } else if (shopify?.rest?.graphql) {
        logger.info("Trying shopify.rest.graphql method");
        queryMethod = "shopify.rest.graphql";
        orderQueryResult = await shopify.rest.graphql(query, variables);
      } else {
        throw new Error("No GraphQL method found on shopify client");
      }
      
      results.orderQuery = {
        method: queryMethod,
        result: orderQueryResult
      };
      logger.info("Order query successful", { queryMethod, orderQueryResult });
      
      const order = orderQueryResult?.order;
      if (!order) {
        throw new Error("Order not found");
      }
      
      // Check for fulfillment orders and cancel them if needed
      const fulfillmentOrders = order.fulfillmentOrders?.edges?.map((edge: any) => edge.node) || [];
      results.fulfillmentOrders = fulfillmentOrders;
      
      logger.info("Found fulfillment orders", { 
        count: fulfillmentOrders.length,
        fulfillmentOrders 
      });
      
      // Cancel fulfillment orders first if they exist and are not already cancelled
      for (const fulfillmentOrder of fulfillmentOrders) {
        if (fulfillmentOrder.status !== "CANCELLED" && fulfillmentOrder.status !== "CLOSED") {
          logger.info("Attempting to cancel fulfillment order", { 
            fulfillmentOrderId: fulfillmentOrder.id,
            status: fulfillmentOrder.status 
          });
          
          try {
            let fulfillmentCancellationResult = null;
            let fulfillmentMethod = null;
            
            const fulfillmentMutation = `
              mutation fulfillmentOrderCancel($id: ID!) {
                fulfillmentOrderCancel(id: $id) {
                  fulfillmentOrder {
                    id
                    status
                    requestStatus
                  }
                  userErrors {
                    field
                    message
                  }
                }
              }
            `;
            
            const fulfillmentVariables = { id: fulfillmentOrder.id };
            
            // Try different methods for fulfillment order cancellation
            if (typeof shopify?.graphql === 'function') {
              fulfillmentMethod = "shopify.graphql";
              fulfillmentCancellationResult = await shopify.graphql(fulfillmentMutation, fulfillmentVariables);
            } else if (typeof shopify?.query === 'function') {
              fulfillmentMethod = "shopify.query";
              fulfillmentCancellationResult = await shopify.query(fulfillmentMutation, fulfillmentVariables);
            } else if (typeof shopify?.client?.graphql === 'function') {
              fulfillmentMethod = "shopify.client.graphql";
              fulfillmentCancellationResult = await shopify.client.graphql(fulfillmentMutation, fulfillmentVariables);
            } else {
              throw new Error("No GraphQL method available for fulfillment order cancellation");
            }
            
            results.fulfillmentCancellations.push({
              fulfillmentOrderId: fulfillmentOrder.id,
              method: fulfillmentMethod,
              result: fulfillmentCancellationResult
            });
            
            logger.info("Fulfillment order cancellation result", { 
              fulfillmentOrderId: fulfillmentOrder.id,
              method: fulfillmentMethod,
              result: fulfillmentCancellationResult 
            });
          } catch (error) {
            logger.error("Failed to cancel fulfillment order", { 
              fulfillmentOrderId: fulfillmentOrder.id,
              error: error.message,
              stack: error.stack
            });
            results.errors.push({
              type: "fulfillment_cancellation",
              fulfillmentOrderId: fulfillmentOrder.id,
              error: error.message,
              stack: error.stack
            });
          }
        }
      }
      
    } catch (error) {
      logger.error("Failed to query order", { error: error.message });
      results.errors.push({
        type: "order_query",
        error: error.message
      });
    }
    
    // Try GraphQL order cancellation
    logger.info("Attempting GraphQL order cancellation", { orderId });
    try {
      let graphqlResult = null;
      let cancellationMethod = null;
      
      const mutation = `
        mutation orderCancel($id: ID!, $reason: OrderCancelReason, $refund: Boolean, $restock: Boolean) {
          orderCancel(input: {id: $id, reason: $reason, refund: $refund, restock: $restock}) {
            order {
              id
              cancelled
              cancelledAt
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
        id: `gid://shopify/Order/${orderId}`,
        reason: "OTHER",
        refund: true,
        restock: true
      };
      
      // Try different methods for GraphQL mutations
      if (typeof shopify?.graphql === 'function') {
        logger.info("Trying shopify.graphql for mutation");
        cancellationMethod = "shopify.graphql";
        graphqlResult = await shopify.graphql(mutation, variables);
      } else if (typeof shopify?.query === 'function') {
        logger.info("Trying shopify.query for mutation");
        cancellationMethod = "shopify.query";
        graphqlResult = await shopify.query(mutation, variables);
      } else if (typeof shopify?.client?.graphql === 'function') {
        logger.info("Trying shopify.client.graphql for mutation");
        cancellationMethod = "shopify.client.graphql";
        graphqlResult = await shopify.client.graphql(mutation, variables);
      } else if (typeof shopify?.client?.query === 'function') {
        logger.info("Trying shopify.client.query for mutation");
        cancellationMethod = "shopify.client.query";
        graphqlResult = await shopify.client.query(mutation, variables);
      } else if (shopify?.graphql && typeof shopify.graphql.query === 'function') {
        logger.info("Trying shopify.graphql.query for mutation");
        cancellationMethod = "shopify.graphql.query";
        graphqlResult = await shopify.graphql.query(mutation, variables);
      } else if (shopify?.rest?.graphql) {
        logger.info("Trying shopify.rest.graphql for mutation");
        cancellationMethod = "shopify.rest.graphql";
        graphqlResult = await shopify.rest.graphql(mutation, variables);
      } else {
        throw new Error("No GraphQL method found for mutation");
      }
      
      results.graphqlCancellation = {
        method: cancellationMethod,
        result: graphqlResult
      };
      logger.info("GraphQL cancellation result", { cancellationMethod, result: graphqlResult });
      
    } catch (error) {
      logger.error("GraphQL cancellation failed", { error: error.message, stack: error.stack });
      results.errors.push({
        type: "graphql_cancellation",
        error: error.message,
        stack: error.stack
      });
    }
    
    // Try REST API order cancellation
    logger.info("Attempting REST API order cancellation", { orderId });
    try {
      let restResult = null;
      let restMethod = null;
      
      // Deep inspection of REST capabilities
      const restInspection = {
        hasRest: 'rest' in shopify,
        hasOrder: 'order' in shopify,
        hasClient: 'client' in shopify,
        hasPost: shopify.post ? 'post method exists' : false,
        hasPut: shopify.put ? 'put method exists' : false,
        hasRequest: shopify.request ? 'request method exists' : false,
        hasCall: shopify.call ? 'call method exists' : false,
        restType: shopify.rest ? typeof shopify.rest : null,
        orderType: shopify.order ? typeof shopify.order : null,
        accessToken: shopify.accessToken ? 'access token exists' : 'no access token',
        myshopifyDomain: shopify.myshopifyDomain ? shopify.myshopifyDomain : 'no domain',
        domain: shopify.domain ? shopify.domain : 'no domain property',
        shop: shopify.shop ? shopify.shop : 'no shop property',
      };
      
      if (shopify.rest) {
        restInspection.restMethods = Object.getOwnPropertyNames(shopify.rest);
        restInspection.restPrototype = Object.getOwnPropertyNames(Object.getPrototypeOf(shopify.rest));
      }
      
      if (shopify.order) {
        restInspection.orderMethods = Object.getOwnPropertyNames(shopify.order);
        if (typeof shopify.order === 'object') {
          restInspection.orderKeys = Object.keys(shopify.order);
        }
      }
      
      logger.info("REST API inspection", restInspection);
      
      // Use numeric order ID for REST API calls
      const restOrderId = numericOrderId || orderId;
      logger.info("Using order ID for REST API calls", { 
        originalOrderId: orderId, 
        restOrderId: restOrderId 
      });
      
      // Try different approaches to access REST API
      if (shopify.rest && typeof shopify.rest.post === 'function') {
        logger.info("Trying shopify.rest.post method");
        restMethod = "shopify.rest.post";
        restResult = await shopify.rest.post(`/admin/api/2024-10/orders/${restOrderId}/cancel.json`, {
          reason: "other",
          refund: true,
          restock: true
        });
      } else if (shopify.rest && typeof shopify.rest.put === 'function') {
        logger.info("Trying shopify.rest.put method");
        restMethod = "shopify.rest.put";
        restResult = await shopify.rest.put(`/admin/api/2024-10/orders/${restOrderId}/cancel.json`, {
          reason: "other",
          refund: true,
          restock: true
        });
      } else if (shopify.order && typeof shopify.order.cancel === 'function') {
        logger.info("Trying shopify.order.cancel method");
        restMethod = "shopify.order.cancel";
        restResult = await shopify.order.cancel(restOrderId, {
          reason: "other",
          refund: true,
          restock: true
        });
      } else if (typeof shopify.post === 'function') {
        logger.info("Trying shopify.post method");
        restMethod = "shopify.post";
        restResult = await shopify.post(`/admin/api/2024-10/orders/${restOrderId}/cancel.json`, {
          reason: "other",
          refund: true,
          restock: true
        });
      } else if (typeof shopify.request === 'function') {
        logger.info("Trying shopify.request method");
        restMethod = "shopify.request";
        restResult = await shopify.request({
          method: 'POST',
          url: `/admin/api/2024-10/orders/${restOrderId}/cancel.json`,
          data: {
            reason: "other",
            refund: true,
            restock: true
          }
        });
      } else if (shopify.accessToken && (shopify.myshopifyDomain || shopify.domain)) {
        // Try direct API call
        logger.info("Trying direct fetch API call");
        restMethod = "direct_fetch";
        const domain = shopify.myshopifyDomain || shopify.domain;
        const response = await fetch(`https://${domain}/admin/api/2024-10/orders/${restOrderId}/cancel.json`, {
          method: 'POST',
          headers: {
            'X-Shopify-Access-Token': shopify.accessToken,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            reason: 'other',
            refund: true,
            restock: true
          })
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`REST API call failed: ${response.status} ${response.statusText} - ${errorText}`);
        }
        
        restResult = await response.json();
      } else {
        throw new Error("No suitable REST API method found");
      }
      
      results.restCancellation = {
        method: restMethod,
        result: restResult,
        inspection: restInspection
      };
      logger.info("REST cancellation result", { restMethod, result: restResult });
      
    } catch (error) {
      logger.error("REST cancellation failed", { error: error.message, stack: error.stack });
      results.errors.push({
        type: "rest_cancellation",
        error: error.message,
        stack: error.stack
      });
    }
    
  } catch (error) {
    logger.error("Overall action failed", { error: error.message });
    results.errors.push({
      type: "general",
      error: error.message
    });
  }
  
  logger.info("testOrderCancellation completed", { results });
  return results;
};

export const params = {
  orderId: { type: "string" },
  shopId: { type: "string" }
};

export const options: ActionOptions = {
  timeoutMS: 300000 // 5 minutes timeout for thorough testing
};
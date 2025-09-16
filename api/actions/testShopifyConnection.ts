export const run: ActionRun = async ({ params, logger, api, connections }) => {
  logger.info("Starting Shopify connection investigation...");
  
  const investigation = {
    connectionsObject: {},
    shopifyConnection: {},
    shopifyCurrent: {},
    methods: [],
    properties: [],
    errors: []
  };

  try {
    // 1. Investigate the connections object itself
    logger.info("=== INVESTIGATING CONNECTIONS OBJECT ===");
    logger.info("connections type:", typeof connections);
    logger.info("connections keys:", Object.keys(connections || {}));
    logger.info("connections properties:", Object.getOwnPropertyNames(connections || {}));
    
    investigation.connectionsObject = {
      type: typeof connections,
      keys: Object.keys(connections || {}),
      properties: Object.getOwnPropertyNames(connections || {}),
      hasShopify: 'shopify' in (connections || {})
    };

    // 2. Investigate connections.shopify
    logger.info("=== INVESTIGATING connections.shopify ===");
    const shopify = connections.shopify;
    
    if (shopify) {
      logger.info("shopify connection exists");
      logger.info("shopify type:", typeof shopify);
      logger.info("shopify constructor:", shopify.constructor?.name);
      logger.info("shopify keys:", Object.keys(shopify));
      logger.info("shopify own properties:", Object.getOwnPropertyNames(shopify));
      
      // Check for common methods
      const commonMethods = ['graphql', 'query', 'mutate', 'request', 'client', 'api'];
      const availableMethods = commonMethods.filter(method => typeof shopify[method] === 'function');
      logger.info("Available common methods:", availableMethods);
      
      // Check for properties
      const commonProperties = ['currentShopId', 'shopId', 'shop', 'current', 'accessToken', 'domain'];
      const availableProperties = commonProperties.filter(prop => prop in shopify);
      logger.info("Available common properties:", availableProperties);
      
      investigation.shopifyConnection = {
        type: typeof shopify,
        constructor: shopify.constructor?.name,
        keys: Object.keys(shopify),
        ownProperties: Object.getOwnPropertyNames(shopify),
        availableMethods,
        availableProperties
      };

      // Log property values (safely)
      availableProperties.forEach(prop => {
        try {
          const value = shopify[prop];
          logger.info(`shopify.${prop}:`, typeof value === 'object' ? 'object' : value);
        } catch (error) {
          logger.warn(`Error accessing shopify.${prop}:`, error.message);
        }
      });

    } else {
      logger.error("shopify connection is null/undefined");
      investigation.shopifyConnection = { exists: false };
    }

    // 3. Investigate connections.shopify.current
    logger.info("=== INVESTIGATING connections.shopify.current ===");
    try {
      const shopifyCurrent = connections.shopify?.current;
      if (shopifyCurrent) {
        logger.info("shopify.current exists");
        logger.info("shopify.current type:", typeof shopifyCurrent);
        logger.info("shopify.current constructor:", shopifyCurrent.constructor?.name);
        logger.info("shopify.current keys:", Object.keys(shopifyCurrent));
        logger.info("shopify.current own properties:", Object.getOwnPropertyNames(shopifyCurrent));
        
        investigation.shopifyCurrent = {
          exists: true,
          type: typeof shopifyCurrent,
          constructor: shopifyCurrent.constructor?.name,
          keys: Object.keys(shopifyCurrent),
          ownProperties: Object.getOwnPropertyNames(shopifyCurrent)
        };
      } else {
        logger.info("shopify.current does not exist");
        investigation.shopifyCurrent = { exists: false };
      }
    } catch (error) {
      logger.error("Error investigating shopify.current:", error.message);
      investigation.errors.push(`shopify.current error: ${error.message}`);
    }

    // 4. Try different GraphQL access methods
    logger.info("=== TESTING GRAPHQL ACCESS METHODS ===");
    const testQuery = `query { shop { name } }`;
    
    // Method 1: Direct graphql method
    try {
      if (shopify && typeof shopify.graphql === 'function') {
        logger.info("Trying shopify.graphql()...");
        const result = await shopify.graphql(testQuery);
        logger.info("shopify.graphql() success:", result);
        investigation.methods.push({ method: 'shopify.graphql()', success: true, result });
      }
    } catch (error) {
      logger.warn("shopify.graphql() failed:", error.message);
      investigation.methods.push({ method: 'shopify.graphql()', success: false, error: error.message });
    }

    // Method 2: Through current property
    try {
      if (connections.shopify?.current && typeof connections.shopify.current.graphql === 'function') {
        logger.info("Trying shopify.current.graphql()...");
        const result = await connections.shopify.current.graphql(testQuery);
        logger.info("shopify.current.graphql() success:", result);
        investigation.methods.push({ method: 'shopify.current.graphql()', success: true, result });
      }
    } catch (error) {
      logger.warn("shopify.current.graphql() failed:", error.message);
      investigation.methods.push({ method: 'shopify.current.graphql()', success: false, error: error.message });
    }

    // Method 3: Check for client property
    try {
      if (shopify?.client && typeof shopify.client.graphql === 'function') {
        logger.info("Trying shopify.client.graphql()...");
        const result = await shopify.client.graphql(testQuery);
        logger.info("shopify.client.graphql() success:", result);
        investigation.methods.push({ method: 'shopify.client.graphql()', success: true, result });
      }
    } catch (error) {
      logger.warn("shopify.client.graphql() failed:", error.message);
      investigation.methods.push({ method: 'shopify.client.graphql()', success: false, error: error.message });
    }

    // Method 4: Check for api property
    try {
      if (shopify?.api && typeof shopify.api.graphql === 'function') {
        logger.info("Trying shopify.api.graphql()...");
        const result = await shopify.api.graphql(testQuery);
        logger.info("shopify.api.graphql() success:", result);
        investigation.methods.push({ method: 'shopify.api.graphql()', success: true, result });
      }
    } catch (error) {
      logger.warn("shopify.api.graphql() failed:", error.message);
      investigation.methods.push({ method: 'shopify.api.graphql()', success: false, error: error.message });
    }

    // 5. Investigate prototype chain
    logger.info("=== INVESTIGATING PROTOTYPE CHAIN ===");
    if (shopify) {
      try {
        let proto = Object.getPrototypeOf(shopify);
        let depth = 0;
        while (proto && depth < 5) {
          logger.info(`Prototype ${depth}:`, proto.constructor?.name);
          logger.info(`Prototype ${depth} methods:`, Object.getOwnPropertyNames(proto).filter(name => typeof proto[name] === 'function'));
          proto = Object.getPrototypeOf(proto);
          depth++;
        }
      } catch (error) {
        logger.warn("Error investigating prototype chain:", error.message);
        investigation.errors.push(`Prototype chain error: ${error.message}`);
      }
    }

    logger.info("=== INVESTIGATION COMPLETE ===");
    logger.info("Full investigation results:", investigation);

    return {
      success: true,
      investigation,
      summary: {
        shopifyConnectionExists: !!shopify,
        availableMethods: investigation.shopifyConnection.availableMethods || [],
        availableProperties: investigation.shopifyConnection.availableProperties || [],
        workingGraphQLMethods: investigation.methods.filter(m => m.success).map(m => m.method),
        errors: investigation.errors
      }
    };

  } catch (error) {
    logger.error("Error during Shopify connection investigation:", error);
    investigation.errors.push(`General error: ${error.message}`);
    
    return {
      success: false,
      investigation,
      error: error.message
    };
  }
};

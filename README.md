# Shopify GraphQL Bulk Throttler

Run bulk throttled requests through the Shopify GraphQL API.

## Examples

```js
import ShopifyGraphqlBulkThrottler from "shopify-graphql-bulk-throttler";

const throttler = new ShopifyGraphqlBulkThrottler(graphqlClient);

const myFunction = () => {
  throttler.setOnQueueEmpty(() => {
    console.log("All requests have been processed");

    throttler.stopRestore(); // stop restoring bucket points once we're finished
  });

  throttler.addToQueue({
    query: `query { shop { name } }`,
    variables: {},
  });

  // or

  throttler.addToQueue([
    {
      query: `query { shop { name } }`,
      variables: {},
    },
    {
      query: `query { shop { name } }`,
      variables: {},
    },
  ]);
};
```

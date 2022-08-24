
export default class ShopiftyGraphqlBulkThrottler {
  /**
   * @param {Object} shopifyGraphQLClient
   */
  constructor(shopifyGraphQLClient) {
    this.client = shopifyGraphQLClient;

    this.maximumAvailable = 1000;
    this.restoreRate = 100;

    this.ptsPerRequest = null;
    this.currentPts = this.maximumAvailable;

    this.requestsRan = 0;
    this.requestsCompleted = 0;

    this.requestQueue = [];
    this.responses = [];

    this.restoreInterval = setInterval(
      this.#restorePts.bind(this),
      1000
    );

    this.kill = false;
  }

  #restorePts() {
    if (this.currentPts < this.maximumAvailable) {
      if (this.currentPts + this.restoreRate > this.maximumAvailable) {
        this.currentPts = this.maximumAvailable;
      } else {
        this.currentPts += this.restoreRate;
      }
    }
  }

  /**
   * @param {Object} request The request to execute
   * @param {Object} request.variables The variables to pass to the mutation or query
   * @param {Any} request.mutation The mutation to execute
   * @param {Any} request.query The query to execute
   */
  async #executeRequest({ variables, mutation, query }) {
    const response = query
      ? await this.client.query({ query, variables })
      : await this.client.mutate({ mutation, variables });

    const { data, extensions } = response;

    if (data) {
      this.responses.push(data);
    }

    if (this.ptsPerRequest === null) {
      this.maximumAvailable = extensions.cost.throttleStatus.maximumAvailable;
      this.restoreRate = extensions.cost.throttleStatus.restoreRate;
      this.ptsPerRequest = extensions.cost.actualQueryCost;
    }

    this.requestsCompleted++;
    this.#next();

    if (this.requestsCompleted && !this.requestQueue.length) {
      this.onQueueEmpty?.(this.responses);
    }

    return data;
  }

  /**
   * Executes the next request in the queue, and if the cap has not been reached, a subsequent request will be executed
   */
  #next() {
    // Finished queue
    console.log(
      `---- ${this.requestsCompleted} REQUESTS COMPLETED, ${this.requestQueue.length} REMAINING`
    );

    if (this.kill) return;

    // Run next request
    const hasCompletedFirstRequest = this.requestsCompleted >= 1;
    const hasBucketCapacityForRequest =
      (this.currentPts || 0) - this.ptsPerRequest > 0;
    if (
      ((hasCompletedFirstRequest && hasBucketCapacityForRequest) ||
        this.requestsRan === 0) &&
      this.requestQueue.length
    ) {
      const nextRequest = this.requestQueue.shift();

      this.requestsRan++;

      this.currentPts -= this.ptsPerRequest;

      this.#next();
      return this.#executeRequest(nextRequest);
    }
  }

  /**
   * Stop restoring points. Call this when you are done with the rate limiter.
   */
  stopRestore() {
    clearInterval(this.restoreInterval);
    this.kill = true;
  }

  /**
   * Adds a request to the queue
   *
   * @param {Object|Array} data The variables to pass to the mutation or query
   * @param {Object} data.variables The variables to pass to the mutation or query
   * @param {Any} data.mutation The mutation to execute
   * @param {Any} data.query The query to execute
   */
  addToQueue(data) {
    if (Array.isArray(data)) {
      this.requestQueue.push(...data);
    } else {
      this.requestQueue.push(data);
    }

    this.#next();
  }

  setOnQueueEmpty(onQueueEmpty) {
    this.onQueueEmpty = onQueueEmpty;
  }
}

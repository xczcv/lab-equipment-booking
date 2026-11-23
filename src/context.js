import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

const requests = new AsyncLocalStorage();

export function runRequest(initiator, work) {
  return requests.run({ processId: randomUUID(), initiator }, work);
}

export function requestContext() {
  return requests.getStore();
}

export function log(event, attributes = {}) {
  const context = requestContext();
  console.log(JSON.stringify({ ...attributes, ...context, event }));
}

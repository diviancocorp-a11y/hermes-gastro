import { vi } from 'vitest';

export function chain(resolvedValue = { data: null, error: null }) {
  const self = {};
  const returnSelf = vi.fn(() => self);
  Object.assign(self, {
    select: returnSelf,
    insert: returnSelf,
    update: returnSelf,
    upsert: returnSelf,
    delete: returnSelf,
    eq: returnSelf,
    neq: returnSelf,
    gt: returnSelf,
    gte: returnSelf,
    lt: returnSelf,
    lte: returnSelf,
    in: returnSelf,
    not: returnSelf,
    is: returnSelf,
    order: returnSelf,
    limit: returnSelf,
    single: vi.fn().mockResolvedValue(resolvedValue),
    then(resolve) { return resolve(resolvedValue); },
  });
  return self;
}

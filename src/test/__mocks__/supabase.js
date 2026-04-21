// Centralized Supabase mock for service tests
import { vi } from 'vitest';

// Chainable query builder mock
function createQueryBuilder(resolveWith = { data: null, error: null }) {
  const builder = {
    _resolve: resolveWith,
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn(function () { return Promise.resolve(this._resolve); }),
    then: function (resolve) { return resolve(this._resolve); },
  };
  // Make the builder itself thenable for non-single queries
  builder[Symbol.for('nodejs.util.promisify.custom')] = () => Promise.resolve(builder._resolve);
  // Override to return promise on await
  const handler = {
    get(target, prop) {
      if (prop === 'then') {
        return (resolve, reject) => Promise.resolve(target._resolve).then(resolve, reject);
      }
      return target[prop];
    }
  };
  return new Proxy(builder, handler);
}

export function createMockSupabase() {
  const mockStorage = {
    from: vi.fn(() => ({
      upload: vi.fn().mockResolvedValue({ data: { path: 'test-path.jpg' }, error: null }),
      getPublicUrl: vi.fn(() => ({ data: { publicUrl: 'https://example.com/test-path.jpg' } })),
      download: vi.fn().mockResolvedValue({ data: new Blob(['test']), error: null }),
    })),
  };

  const mockFunctions = {
    invoke: vi.fn().mockResolvedValue({ data: { ok: true }, error: null }),
  };

  const mockChannel = {
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
  };

  const fromMock = vi.fn(() => createQueryBuilder());
  const rpcMock = vi.fn().mockResolvedValue({ error: null });

  return {
    from: fromMock,
    rpc: rpcMock,
    storage: mockStorage,
    functions: mockFunctions,
    channel: vi.fn(() => mockChannel),
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      signInWithPassword: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'u1' } } }, error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
    _queryBuilder: createQueryBuilder,
  };
}

// Default instance for vi.mock
const mockSupabase = createMockSupabase();
export const supabase = mockSupabase;
export default mockSupabase;

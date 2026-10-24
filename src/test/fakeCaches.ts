type Key = RequestInfo | URL | { readonly url: string };

const urlOf = (key: Key): string =>
  typeof key === 'string' ? key : key instanceof URL ? key.href : key.url;

/** One in-memory cache. Keys are absolute URLs; it remembers the requests `addAll` was given. */
export class FakeCache {
  readonly entries = new Map<string, Response>();
  readonly added: Request[] = [];
  /** When set, `put` throws it, e.g. a QuotaExceededError. */
  putError: Error | undefined;

  private readonly network: (request: Request) => Promise<Response>;

  constructor(network: (request: Request) => Promise<Response>) {
    this.network = network;
  }

  match(key: Key): Promise<Response | undefined> {
    return Promise.resolve(this.entries.get(urlOf(key))?.clone());
  }

  put(key: Key, response: Response): Promise<void> {
    if (this.putError) return Promise.reject(this.putError);
    this.entries.set(urlOf(key), response);
    return Promise.resolve();
  }

  async addAll(requests: Request[]): Promise<void> {
    this.added.push(...requests);
    const responses = await Promise.all(requests.map((request) => this.network(request)));
    requests.forEach((request, i) => this.entries.set(request.url, responses[i] as Response));
  }

  delete(key: Key): Promise<boolean> {
    return Promise.resolve(this.entries.delete(urlOf(key)));
  }

  keys(): Promise<readonly Request[]> {
    return Promise.resolve([...this.entries.keys()].map((url) => new Request(url)));
  }

  /** Saves a small response under each URL. */
  fill(urls: readonly string[]): this {
    for (const url of urls) this.entries.set(url, new Response(`saved ${url}`));
    return this;
  }
}

/** An in-memory Cache Storage with just what the offline code uses. */
export class FakeCacheStorage {
  readonly caches = new Map<string, FakeCache>();

  private readonly network: (request: Request) => Promise<Response>;

  constructor(
    network: (request: Request) => Promise<Response> = () => Promise.reject(new Error()),
  ) {
    this.network = network;
  }

  /** The named cache, created if needed, without the async ceremony. */
  cache(name: string): FakeCache {
    let cache = this.caches.get(name);
    if (!cache) {
      cache = new FakeCache(this.network);
      this.caches.set(name, cache);
    }
    return cache;
  }

  open(name: string): Promise<FakeCache> {
    return Promise.resolve(this.cache(name));
  }

  /** Like the real one, but without Vary headers to worry about. */
  match(
    key: Key,
    options: CacheQueryOptions & { cacheName?: string } = {},
  ): Promise<Response | undefined> {
    const searched =
      options.cacheName === undefined
        ? [...this.caches.values()]
        : [this.caches.get(options.cacheName)];
    const url = urlOf(key);
    const hit = searched.find((cache) => cache?.entries.has(url));
    return hit ? hit.match(url) : Promise.resolve(undefined);
  }

  has(name: string): Promise<boolean> {
    return Promise.resolve(this.caches.has(name));
  }

  keys(): Promise<string[]> {
    return Promise.resolve([...this.caches.keys()]);
  }

  delete(name: string): Promise<boolean> {
    return Promise.resolve(this.caches.delete(name));
  }

  /** Typed as the real thing for code under test. */
  get asCacheStorage(): CacheStorage {
    return this as unknown as CacheStorage;
  }
}

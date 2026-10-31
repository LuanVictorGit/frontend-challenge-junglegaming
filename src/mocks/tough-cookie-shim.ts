// Minimal stand-in for `tough-cookie` (aliased in vite.config.ts). MSW only needs it to persist cookies
// set by mocked responses; this mock backend never uses cookies, so the ~250 KB library stays out of the bundle.
export class Cookie {
  static fromJSON() {
    return null
  }
}
export class MemoryCookieStore {
  idx: Record<string, unknown> = {}
}
export class CookieJar {
  getCookiesSync() {
    return []
  }
  async setCookie() {}
}

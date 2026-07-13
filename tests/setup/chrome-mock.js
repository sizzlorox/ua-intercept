// Minimal, stateful chrome.* stub for unit tests. The src/core/ modules are pure
// and don't touch chrome, but storage/background tests need the global to exist and
// to record effects. Exposed via globalThis.__chrome for assertions/reset.
const store = {}
const fx = { dynamicRules: [], registered: [], badge: {} }

function reset() {
  for (const k of Object.keys(store)) delete store[k]
  fx.dynamicRules = []
  fx.registered = []
  fx.badge = {}
}

globalThis.__chrome = { store, fx, reset }

globalThis.chrome = {
  storage: {
    local: {
      async get(key) {
        if (key == null) return { ...store }
        if (typeof key === 'string') return { [key]: store[key] }
        if (Array.isArray(key)) return Object.fromEntries(key.map((k) => [k, store[k]]))
        return Object.fromEntries(Object.keys(key).map((k) => [k, k in store ? store[k] : key[k]]))
      },
      async set(items) {
        Object.assign(store, items)
      },
      async remove(key) {
        for (const k of [].concat(key)) delete store[k]
      },
      async clear() {
        for (const k of Object.keys(store)) delete store[k]
      },
    },
    onChanged: { addListener() {} },
  },
  declarativeNetRequest: {
    async getDynamicRules() {
      return fx.dynamicRules
    },
    async updateDynamicRules({ removeRuleIds = [], addRules = [] } = {}) {
      fx.dynamicRules = fx.dynamicRules.filter((r) => !removeRuleIds.includes(r.id)).concat(addRules)
    },
  },
  scripting: {
    async getRegisteredContentScripts() {
      return fx.registered
    },
    async registerContentScripts(scripts) {
      fx.registered.push(...scripts)
    },
    async updateContentScripts(scripts) {
      fx.registered = scripts
    },
    async unregisterContentScripts({ ids = [] } = {}) {
      fx.registered = fx.registered.filter((s) => !ids.includes(s.id))
    },
  },
  action: {
    setBadgeText(o) {
      fx.badge.text = o.text
    },
    setBadgeBackgroundColor(o) {
      fx.badge.color = o.color
    },
    setBadgeTextColor(o) {
      fx.badge.textColor = o.color
    },
    setTitle(o) {
      fx.badge.title = o.title
    },
  },
  runtime: {
    onInstalled: { addListener() {} },
    onStartup: { addListener() {} },
    onMessage: { addListener() {} },
  },
  i18n: { getMessage: (k) => k },
}

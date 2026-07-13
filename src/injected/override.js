// MAIN-world, document_start. Reads the spoof config synchronously from the
// Server-Timing entry the background's DNR rule appended, then redefines the
// navigator surfaces BEFORE the page's own scripts read them. No async round-trip
// (that would lose the document_start race). Fails open (real UA) if config absent.
;(function () {
  'use strict'
  try {
    const nav = performance.getEntriesByType('navigation')[0]
    const st = nav && nav.serverTiming
    if (!st || !st.length) return
    // Our DNR rule APPENDS the uaint entry, so it is the LAST one. Picking the
    // last (not the first) ignores a uaint entry a malicious origin sent itself.
    const entry = st.findLast ? st.findLast((e) => e.name === 'uaint') : [...st].reverse().find((e) => e.name === 'uaint')
    if (!entry || !entry.description) return

    let cfg
    try {
      cfg = JSON.parse(decodeURIComponent(entry.description))
    } catch {
      return
    }
    if (!cfg || typeof cfg.userAgent !== 'string' || !cfg.userAgent) return

    define('userAgent', cfg.userAgent)
    // appVersion is the UA with the "Mozilla/" prefix stripped — keep it consistent.
    define('appVersion', cfg.userAgent.replace(/^Mozilla\//, ''))
    if (cfg.platform) define('platform', cfg.platform)
    if (typeof cfg.vendor === 'string') define('vendor', cfg.vendor)

    const brands = Array.isArray(cfg.brands) ? cfg.brands : []
    const fullVersionList = Array.isArray(cfg.fullVersionList) ? cfg.fullVersionList : []

    // Only touch userAgentData on engines that natively have it (Chromium does,
    // Firefox does not). Adding one on Firefox would itself be a fingerprint tell.
    const hasNativeUAData = typeof navigator.userAgentData !== 'undefined'

    if (hasNativeUAData && brands.length) {
      // Chromium-family spoof: reconstruct navigator.userAgentData to match.
      const uaData = {
        brands,
        mobile: !!cfg.mobile,
        platform: cfg.chPlatform || '',
        toJSON() {
          return { brands: this.brands, mobile: this.mobile, platform: this.platform }
        },
        getHighEntropyValues(hints) {
          const full = {
            brands,
            mobile: !!cfg.mobile,
            platform: cfg.chPlatform || '',
            architecture: cfg.architecture || '',
            bitness: cfg.bitness || '',
            model: cfg.model || '',
            platformVersion: cfg.platformVersion || '',
            uaFullVersion: (fullVersionList[0] && fullVersionList[0].version) || '',
            fullVersionList,
            wow64: false,
          }
          if (Array.isArray(hints)) {
            const picked = { brands: full.brands, mobile: full.mobile, platform: full.platform }
            for (const h of hints) if (h in full) picked[h] = full[h]
            return Promise.resolve(picked)
          }
          return Promise.resolve(full)
        },
      }
      define('userAgentData', uaData)
    } else if (hasNativeUAData) {
      // Non-Chromium spoof on a Chromium engine: real Chrome exposes
      // navigator.userAgentData but Safari/Firefox do NOT. Remove it so the
      // spoofed surface matches. (On Firefox there is nothing to remove.)
      remove('userAgentData')
    }
  } catch {
    // never break the page
  }

  function define(prop, value) {
    try {
      Object.defineProperty(Navigator.prototype, prop, { get: () => value, configurable: true })
    } catch {
      try {
        Object.defineProperty(navigator, prop, { get: () => value, configurable: true })
      } catch {
        /* give up silently */
      }
    }
  }

  function remove(prop) {
    try {
      delete Navigator.prototype[prop]
    } catch {
      /* not configurable */
    }
    try {
      // Belt-and-suspenders: redefine then delete so the property is gone even if
      // a prior delete was a no-op (keeps `'userAgentData' in navigator` false).
      Object.defineProperty(Navigator.prototype, prop, { get: () => undefined, configurable: true })
      delete Navigator.prototype[prop]
    } catch {
      /* best effort */
    }
  }
})()

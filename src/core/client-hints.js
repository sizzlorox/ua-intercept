// Derive UA Client Hints from a profile. Two coherent shapes:
//  - headerOps: DNR modifyHeaders directives for the sec-ch-ua* request headers
//  - injectConfig: payload for the MAIN-world navigator.userAgentData rebuild
//
// Rule: if the profile carries chromium uaData (brands), SET the low-entropy hints
// to match it and REMOVE every high-entropy hint (so real arch/platform-version/etc
// never leak on the wire when a server sends Accept-CH). Otherwise (Safari/Firefox/
// bot/custom-without-data) REMOVE all sec-ch-ua* so a fake non-Chromium UA is not
// contradicted by real Chromium hints.

const CH_LOW = ['sec-ch-ua', 'sec-ch-ua-mobile', 'sec-ch-ua-platform']
const CH_HIGH = [
  'sec-ch-ua-full-version-list',
  'sec-ch-ua-full-version', // deprecated singular, still emitted if a server requests it
  'sec-ch-ua-platform-version',
  'sec-ch-ua-arch',
  'sec-ch-ua-bitness',
  'sec-ch-ua-model',
  'sec-ch-ua-wow64',
]

// `effUa` is the effectiveUa(profile) result ({mode,value} | null).
// Client-Hint headers are only manipulated for a preset-style SET UA that carries
// uaData — i.e. a real "switch browser" spoof. Append-token profiles keep the
// browser's real identity, so we leave sec-ch-ua* untouched for them.
export function deriveClientHints(profile, effUa) {
  const uaData = profile.uaData
  const isSet = !!(effUa && effUa.mode === 'set')
  const hasData = !!(uaData && Array.isArray(uaData.brands) && uaData.brands.length > 0)
  const headerOps = []

  if (isSet && hasData) {
    headerOps.push({ header: 'sec-ch-ua', operation: 'set', value: brandString(uaData.brands) })
    headerOps.push({ header: 'sec-ch-ua-mobile', operation: 'set', value: profile.mobile ? '?1' : '?0' })
    headerOps.push({ header: 'sec-ch-ua-platform', operation: 'set', value: `"${uaData.chPlatform || ''}"` })
    for (const h of CH_HIGH) headerOps.push({ header: h, operation: 'remove' })
  } else if (isSet) {
    // Non-Chromium set UA (Safari/Firefox/custom): strip Chromium hints so they
    // don't contradict the fake UA.
    for (const h of [...CH_LOW, ...CH_HIGH]) headerOps.push({ header: h, operation: 'remove' })
  }
  // append-only (or no UA change): no client-hint changes.

  const uaValue = effUa ? effUa.value : ''
  const injectConfig = {
    uaMode: effUa ? effUa.mode : null, // 'set' | 'append' | null
    uaValue,
    platform: isSet ? profile.platform || '' : '',
    // Only meaningful for a Chromium set UA (the only case userAgentData is spoofed);
    // must match the sec-ch-ua-mobile wire header above so a page can't cross-check them.
    mobile: isSet && hasData ? !!profile.mobile : false,
    vendor: isSet ? vendorFor(uaValue, hasData) : '',
    brands: isSet && hasData ? uaData.brands : [],
    fullVersionList: isSet && hasData ? uaData.fullVersionList || [] : [],
    platformVersion: isSet && hasData ? uaData.platformVersion || '' : '',
    chPlatform: isSet && hasData ? uaData.chPlatform || '' : '',
    architecture: isSet && hasData ? uaData.architecture || '' : '',
    bitness: isSet && hasData ? uaData.bitness || '' : '',
    model: isSet && hasData ? uaData.model || '' : '',
  }

  return { headerOps, injectConfig }
}

// navigator.vendor: Chromium reports "Google Inc.", Safari/WebKit "Apple Computer, Inc.",
// Firefox the empty string. Keep it consistent with the spoofed UA.
function vendorFor(userAgent, isChromium) {
  if (isChromium) return 'Google Inc.'
  if (/firefox\//i.test(userAgent)) return ''
  return 'Apple Computer, Inc.'
}

function brandString(brands) {
  return brands.map((b) => `"${b.brand}";v="${b.version}"`).join(', ')
}

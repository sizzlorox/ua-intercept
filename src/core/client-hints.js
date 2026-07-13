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

export function deriveClientHints(profile) {
  const uaData = profile.uaData
  const hasData = !!(uaData && Array.isArray(uaData.brands) && uaData.brands.length > 0)
  const headerOps = []

  if (hasData) {
    headerOps.push({ header: 'sec-ch-ua', operation: 'set', value: brandString(uaData.brands) })
    headerOps.push({ header: 'sec-ch-ua-mobile', operation: 'set', value: profile.mobile ? '?1' : '?0' })
    headerOps.push({ header: 'sec-ch-ua-platform', operation: 'set', value: `"${uaData.chPlatform || ''}"` })
    // Strip ALL high-entropy hints on the wire; the JS surface still reports fake
    // values via injectConfig (getHighEntropyValues), which stays consistent.
    for (const h of CH_HIGH) headerOps.push({ header: h, operation: 'remove' })
  } else {
    for (const h of [...CH_LOW, ...CH_HIGH]) headerOps.push({ header: h, operation: 'remove' })
  }

  const injectConfig = {
    userAgent: profile.userAgent,
    platform: profile.platform || '',
    mobile: !!profile.mobile,
    vendor: vendorFor(profile.userAgent, hasData),
    brands: hasData ? uaData.brands : [],
    fullVersionList: hasData ? uaData.fullVersionList || [] : [],
    platformVersion: hasData ? uaData.platformVersion || '' : '',
    chPlatform: hasData ? uaData.chPlatform || '' : '',
    architecture: hasData ? uaData.architecture || '' : '',
    bitness: hasData ? uaData.bitness || '' : '',
    model: hasData ? uaData.model || '' : '',
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

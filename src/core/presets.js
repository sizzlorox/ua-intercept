// Built-in, read-only UA templates. `engine` drives client-hint derivation:
// chromium -> set sec-ch-ua* from uaData; webkit/gecko -> remove them.
// `uaData` (chromium only) seeds both the headers and the navigator.userAgentData rebuild.

const CHROME_MAJOR = '131'
const CHROME_FULL = '131.0.6778.140'

// GREASE-style brand list Chrome sends; stable enough for spoofing.
function chromiumBrands(major = CHROME_MAJOR) {
  return [
    { brand: 'Not_A Brand', version: '24' },
    { brand: 'Chromium', version: major },
    { brand: 'Google Chrome', version: major },
  ]
}
function chromiumFullList(full = CHROME_FULL) {
  return [
    { brand: 'Not_A Brand', version: '24.0.0.0' },
    { brand: 'Chromium', version: full },
    { brand: 'Google Chrome', version: full },
  ]
}

export const PRESETS = [
  {
    id: 'win-chrome',
    label: 'Windows — Chrome',
    userAgent: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROME_MAJOR}.0.0.0 Safari/537.36`,
    platform: 'Win32',
    mobile: false,
    engine: 'chromium',
    uaData: { brands: chromiumBrands(), fullVersionList: chromiumFullList(), platformVersion: '15.0.0', chPlatform: 'Windows', architecture: 'x86', bitness: '64', model: '' },
  },
  {
    id: 'mac-chrome',
    label: 'macOS — Chrome',
    userAgent: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROME_MAJOR}.0.0.0 Safari/537.36`,
    platform: 'MacIntel',
    mobile: false,
    engine: 'chromium',
    uaData: { brands: chromiumBrands(), fullVersionList: chromiumFullList(), platformVersion: '14.7.1', chPlatform: 'macOS', architecture: 'arm', bitness: '64', model: '' },
  },
  {
    id: 'android-chrome',
    label: 'Android — Chrome',
    userAgent: `Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROME_MAJOR}.0.0.0 Mobile Safari/537.36`,
    platform: 'Linux armv8l',
    mobile: true,
    engine: 'chromium',
    uaData: { brands: chromiumBrands(), fullVersionList: chromiumFullList(), platformVersion: '14.0.0', chPlatform: 'Android', architecture: '', bitness: '', model: 'Pixel 8' },
  },
  {
    id: 'mac-safari',
    label: 'macOS — Safari',
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15',
    platform: 'MacIntel',
    mobile: false,
    engine: 'webkit',
    uaData: null,
  },
  {
    id: 'iphone-safari',
    label: 'iPhone — Safari',
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1',
    platform: 'iPhone',
    mobile: true,
    engine: 'webkit',
    uaData: null,
  },
  {
    id: 'ipad-safari',
    label: 'iPad — Safari',
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15',
    platform: 'MacIntel',
    mobile: false,
    engine: 'webkit',
    uaData: null,
  },
  {
    id: 'linux-firefox',
    label: 'Linux — Firefox',
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0',
    platform: 'Linux x86_64',
    mobile: false,
    engine: 'gecko',
    uaData: null,
  },
  {
    id: 'googlebot',
    label: 'Googlebot',
    userAgent:
      'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Googlebot/2.1; +http://www.google.com/bot.html) Chrome/131.0.0.0 Safari/537.36',
    platform: '',
    mobile: false,
    // Treated as hint-less: a bot does not send sec-ch-ua*, so uaData:null -> remove.
    engine: 'chromium',
    uaData: null,
  },
]

export function presetById(id) {
  return PRESETS.find((p) => p.id === id) || null
}

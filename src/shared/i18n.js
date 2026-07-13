// Tiny i18n helper over chrome.i18n. Static text is marked in HTML with
// data-i18n / data-i18n-ph / data-i18n-title; dynamic strings call t().

export function t(key, subs) {
  return chrome.i18n.getMessage(key, subs) || key
}

/** Localize all marked elements under `root` and set page text direction. */
export function localizeDom(root = document) {
  for (const el of root.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n)
  for (const el of root.querySelectorAll('[data-i18n-ph]')) el.setAttribute('placeholder', t(el.dataset.i18nPh))
  for (const el of root.querySelectorAll('[data-i18n-title]')) {
    const msg = t(el.dataset.i18nTitle)
    el.setAttribute('title', msg)
    el.setAttribute('aria-label', msg)
  }
  const dir = chrome.i18n.getMessage('@@bidi_dir')
  if (dir && root === document) document.documentElement.dir = dir
}

/**
 * Detects if the code is running in a browser environment
 */
export const isBrowser = typeof window !== "undefined"

/**
 * Detects if the current browser is Internet Explorer
 */
export function isIE(): boolean {
  if (!isBrowser) return false
  return /*@cc_on!@*/ false || !!(document as any).documentMode
}

/**
 * Detects if the current browser is Edge (legacy)
 */
export function isEdgeLegacy(): boolean {
  if (!isBrowser) return false
  return !isIE() && !!(window as any).StyleMedia
}

/**
 * Detects if the current browser is Chrome
 */
export function isChrome(): boolean {
  if (!isBrowser) return false
  return !!window.chrome && (!!window.chrome.webstore || !!window.chrome.runtime)
}

/**
 * Detects if the current browser is Firefox
 */
export function isFirefox(): boolean {
  if (!isBrowser) return false
  return typeof (window as any).InstallTrigger !== "undefined"
}

/**
 * Detects if the current browser is Safari
 */
export function isSafari(): boolean {
  if (!isBrowser) return false
  return /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
}

/**
 * Detects if the current device is a mobile device
 */
export function isMobile(): boolean {
  if (!isBrowser) return false
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
}

/**
 * Detects if the current device is a Windows device
 */
export function isWindows(): boolean {
  if (!isBrowser) return false
  return navigator.platform.indexOf("Win") > -1
}

/**
 * Detects if the current device is a Mac device
 */
export function isMac(): boolean {
  if (!isBrowser) return false
  return navigator.platform.indexOf("Mac") > -1
}

/**
 * Gets information about the current browser environment
 */
export function getBrowserInfo() {
  if (!isBrowser) {
    return {
      isServer: true,
      isBrowser: false,
    }
  }

  return {
    isServer: false,
    isBrowser: true,
    isIE: isIE(),
    isEdgeLegacy: isEdgeLegacy(),
    isChrome: isChrome(),
    isFirefox: isFirefox(),
    isSafari: isSafari(),
    isMobile: isMobile(),
    isWindows: isWindows(),
    isMac: isMac(),
    userAgent: navigator.userAgent,
  }
}

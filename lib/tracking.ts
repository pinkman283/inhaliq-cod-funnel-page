/**
 * Client-Side Facebook CAPI & Browser Tracking Helper
 * 
 * Extracts _fbp, _fbc from cookies, generates/persists a persistent device_id,
 * extracts UTM campaign parameters from URL, and captures event source info.
 */

export interface BrowserTrackingData {
  fbp: string;
  fbc: string;
  deviceId: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  eventSourceUrl: string;
  domain: string;
  referrer: string;
}

/**
 * Parses cookie string to retrieve a specific cookie value.
 */
function getCookie(name: string): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(new RegExp("(^|;\\s*)(" + name + ")=([^;]*)"));
  return match ? decodeURIComponent(match[3]) : "";
}

/**
 * Returns or creates a persistent device ID in localStorage.
 */
export function getOrCreateDeviceId(): string {
  if (typeof window === "undefined" || !window.localStorage) {
    return "";
  }

  try {
    let deviceId = localStorage.getItem("device_id");
    if (!deviceId) {
      deviceId = typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `dev_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      localStorage.setItem("device_id", deviceId);
    }
    return deviceId;
  } catch (e) {
    console.warn("[Tracking] Could not access localStorage for deviceId", e);
    return "";
  }
}

/**
 * Gathers complete browser tracking data for CAPI server-to-server payload.
 */
export function getBrowserTrackingData(): BrowserTrackingData {
  if (typeof window === "undefined") {
    return {
      fbp: "",
      fbc: "",
      deviceId: "",
      utm_source: "direct",
      utm_medium: "none",
      utm_campaign: "cod_funnel",
      eventSourceUrl: "",
      domain: "",
      referrer: "",
    };
  }

  // 1. Cookies for Facebook CAPI
  const fbp = getCookie("_fbp");
  const fbc = getCookie("_fbc");

  // 2. Persistent Device ID
  const deviceId = getOrCreateDeviceId();

  // 3. UTM Parameters
  const urlParams = new URLSearchParams(window.location.search);
  const utm_source = urlParams.get("utm_source") || "facebook";
  const utm_medium = urlParams.get("utm_medium") || "cpc";
  const utm_campaign = urlParams.get("utm_campaign") || "cod_funnel";

  // 4. URL and Referrer
  const eventSourceUrl = window.location.href;
  const domain = window.location.hostname;
  const referrer = document.referrer || "https://l.facebook.com/";

  return {
    fbp,
    fbc,
    deviceId,
    utm_source,
    utm_medium,
    utm_campaign,
    eventSourceUrl,
    domain,
    referrer,
  };
}

/**
 * Safely dispatches standard Facebook Pixel client events if window.fbq is present
 * Supports CAPI event deduplication via eventID
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const window: any;

export function trackClientPixelEvent(
  eventName: "PageView" | "ViewContent" | "InitiateCheckout" | "Purchase" | "Lead",
  parameters?: Record<string, unknown>,
  eventId?: string
) {
  if (typeof window !== "undefined" && typeof window.fbq === "function") {
    try {
      if (eventId) {
        window.fbq("track", eventName, parameters || {}, { eventID: eventId });
      } else {
        window.fbq("track", eventName, parameters || {});
      }
    } catch (e) {
      console.warn(`[Pixel] Error tracking ${eventName}:`, e);
    }
  }
}

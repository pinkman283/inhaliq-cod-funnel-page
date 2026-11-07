import "server-only";

/**
 * Centralized Laravel Headless API Service Layer
 * 
 * Strict implementation matching Laravel Headless E-Commerce API (v1) documentation.
 * All requests run server-side only and pass required API Key & CAPI headers.
 */

export interface LaravelVariant {
  id: number;
  name?: string;
  color_name?: string;
  size_name?: string;
  title?: string;
  price?: number;
  stock_qty?: number;
  image?: string;
}

export interface LaravelProductResource {
  id: number;
  name: string;
  slug: string;
  sku?: string;
  short_description?: string;
  description?: string;
  details?: string;
  specification?: string;
  price?: number | string;
  new_price?: number | string;
  sale_price?: number | string;
  old_price?: number | string;
  regular_price?: number | string;
  stock_status?: string;
  stock_qty?: number;
  status?: number;
  image?: string | { image: string; url?: string };
  feature_image?: string;
  images?: Array<string | { image?: string; url?: string }>;
  colors?: LaravelVariant[];
  procolors?: LaravelVariant[];
  sizes?: LaravelVariant[];
  prosizes?: LaravelVariant[];
  event_id?: string;
}

export interface LaravelShippingCharge {
  id: number | string;
  name: string;
  amount: number | string;
}

export interface LaravelInitSettingsData {
  main_settings?: {
    primary_color?: string;
    notification_icon?: string;
    checkout_page_order_button_name?: string;
  };
  general_settings?: {
    name?: string;
    white_logo?: string;
    checkout_note?: string;
  };
  facebook_pixels?: Array<{ pixel_id: string }>;
  google_tag_managers?: Array<{ code: string }>;
  shipping_charges?: LaravelShippingCharge[];
  external_id?: string;
}

export interface LaravelOrderItem {
  product_id: number;
  qty: number;
  size_id?: number | null;
  color_id?: number | null;
  price?: number;
}

export interface LaravelCalculatePayload {
  area_id: number | string;
  coupon_code?: string;
  items: LaravelOrderItem[];
}

export interface LaravelCalculateResponseData {
  subtotal: number;
  shipping_fee: number;
  discount: number;
  total: number;
}

export interface LaravelPaymentGateway {
  type: string;
  discount_type?: string;
  discount_amount?: number;
  image?: string;
}

export interface LaravelOrderSavePayload {
  name: string;
  phone: string;
  address: string;
  area: string;
  note?: string;
  payment_method: string;
  coupon_code?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  referrer?: string;
  device_type?: string;
  channel?: string;
  domain?: string;
  app_type?: string;
  items: LaravelOrderItem[];
}

export interface LaravelOrderSaveResponseData {
  order_id: number;
  invoice_id: number | string;
  token?: string;
  total: number;
  payment_url?: string | null;
  auth_token?: string;
  event_id?: string;
}

export interface LaravelLeadPayload {
  phone: string;
  name?: string;
  address?: string;
  product_ids?: number[];
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  referrer?: string;
  device_type?: string;
  channel?: string;
  domain?: string;
  app_type?: string;
}

export interface LaravelApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: Record<string, string[]>;
}

/**
 * Returns the base URL for the Laravel API
 */
export function getLaravelApiBaseUrl(): string {
  const url = process.env.LARAVEL_API_BASE_URL?.trim().replace(/\/+$/, "");
  if (!url) {
    const origin = process.env.LARAVEL_BACKEND_ORIGIN?.trim().replace(/\/+$/, "");
    return origin ? `${origin}/api/v1` : "https://inhaliq.com/api/v1";
  }
  return url;
}

/**
 * Returns required server-to-server auth headers
 */
export function getLaravelAuthHeaders(customHeaders?: HeadersInit): HeadersInit {
  const apiKey = process.env.LARAVEL_API_KEY?.trim() || "";
  return {
    "X-API-KEY": apiKey,
    Authorization: `Bearer ${apiKey}`,
    Accept: "application/json",
    "Content-Type": "application/json",
    ...customHeaders,
  };
}

/**
 * Core generic fetcher for Laravel API
 */
export async function fetchLaravelApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<LaravelApiResponse<T>> {
  const baseUrl = getLaravelApiBaseUrl();
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const url = `${baseUrl}${cleanEndpoint}`;

  const headers = getLaravelAuthHeaders(options.headers);

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      return {
        success: false,
        message: data?.message || `API error: HTTP ${response.status}`,
        errors: data?.errors,
        data: data?.data,
      };
    }

    return {
      success: true,
      data: data?.data ?? data,
      message: data?.message,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Network failure connecting to backend";
    console.error(`[Laravel API] Request failed for ${cleanEndpoint}:`, errorMsg);
    return {
      success: false,
      message: errorMsg,
    };
  }
}

/**
 * 1. Fetch Store Initialization Settings
 */
export async function apiGetInitSettings(): Promise<LaravelApiResponse<LaravelInitSettingsData>> {
  return fetchLaravelApi<LaravelInitSettingsData>("/init-settings", {
    next: { revalidate: 300 },
  });
}

/**
 * 2. Fetch Shipping Charges
 */
export async function apiGetShippingCharges(): Promise<LaravelApiResponse<LaravelShippingCharge[]>> {
  const res = await fetchLaravelApi<LaravelShippingCharge[]>("/shipping-charges", {
    next: { revalidate: 300 },
  });

  if (res.success && Array.isArray(res.data) && res.data.length > 0) {
    return res;
  }

  // Fallback to init-settings if /shipping-charges is empty
  const initRes = await apiGetInitSettings();
  if (initRes.success && initRes.data?.shipping_charges) {
    return {
      success: true,
      data: initRes.data.shipping_charges,
    };
  }

  return res;
}

/**
 * 3. Fetch Campaign by Slug
 */
export async function apiGetCampaign(slug: string): Promise<LaravelApiResponse<any>> {
  return fetchLaravelApi<any>(`/campaign/${encodeURIComponent(slug)}`, {
    next: { revalidate: 60 },
  });
}

export interface LaravelCategory {
  id: number;
  name: string;
  slug: string;
  image?: string;
  banner?: string;
  products_count?: number;
}

/**
 * 4. Fetch Single Product by Slug
 */
export async function apiGetProduct(slug: string): Promise<LaravelApiResponse<LaravelProductResource>> {
  return fetchLaravelApi<LaravelProductResource>(`/product/${encodeURIComponent(slug)}`, {
    next: { revalidate: 60 },
  });
}

/**
 * 5. Fetch Store Categories (GET /categories)
 */
export async function apiGetCategories(): Promise<LaravelApiResponse<LaravelCategory[]>> {
  return fetchLaravelApi<LaravelCategory[]>("/categories", {
    next: { revalidate: 300 },
  });
}

/**
 * 6. Fetch Products by Category Slug (GET /category/{slug})
 */
export async function apiGetCategoryProducts(
  slug: string,
  perPage = 100,
  page = 1
): Promise<LaravelApiResponse<any>> {
  return fetchLaravelApi<any>(`/category/${encodeURIComponent(slug)}?per_page=${perPage}&page=${page}`, {
    next: { revalidate: 60 },
  });
}

/**
 * 7. Fetch Nested Nav Menu Tree (GET /nav-menu)
 * Retrieves Category -> Sub Category -> Child Category tree.
 */
export async function apiGetNavMenu(): Promise<LaravelApiResponse<any>> {
  return fetchLaravelApi<any>("/nav-menu", {
    next: { revalidate: 300 },
  });
}

/**
 * 8. Fetch Products by Subcategory Slug (GET /subcategory/{slug})
 */
export async function apiGetSubcategoryProducts(
  slug: string,
  perPage = 100,
  page = 1
): Promise<LaravelApiResponse<any>> {
  return fetchLaravelApi<any>(`/subcategory/${encodeURIComponent(slug)}?per_page=${perPage}&page=${page}`, {
    next: { revalidate: 60 },
  });
}

/**
 * 9. Fetch Products from Shop Catalog (supports up to 100 items per page)
 */
export async function apiGetShopProducts(
  perPage = 100,
  page = 1
): Promise<LaravelApiResponse<any>> {
  return fetchLaravelApi<any>(`/shop?per_page=${perPage}&page=${page}`, {
    next: { revalidate: 60 },
  });
}

/**
 * 8. Fetch Payment Gateways (GET /payment-gateways)
 */
export async function apiGetPaymentGateways(): Promise<LaravelApiResponse<LaravelPaymentGateway[]>> {
  return fetchLaravelApi<LaravelPaymentGateway[]>("/payment-gateways", {
    next: { revalidate: 300 },
  });
}

/**
 * Resolves the active COD payment method string accepted by the backend.
 * Checks /payment-gateways for matches like "Cash On Delivery" or "cod", defaulting to "Cash On Delivery".
 */
export async function getActiveCodPaymentMethod(): Promise<string> {
  try {
    const res = await apiGetPaymentGateways();
    if (res.success && Array.isArray(res.data) && res.data.length > 0) {
      const codGateway = res.data.find((g) =>
        /cash.*delivery|cod/i.test(g.type)
      );
      if (codGateway?.type) {
        return codGateway.type;
      }
    }
  } catch (err) {
    console.warn("[Payment Gateway] Could not fetch gateways, falling back to 'Cash On Delivery':", err);
  }
  return "Cash On Delivery";
}

/**
 * 7. Dynamic Cart Calculation (POST /checkout/calculate)
 */
export async function apiCalculateOrder(
  payload: LaravelCalculatePayload,
  trackingHeaders: Record<string, string> = {}
): Promise<LaravelApiResponse<LaravelCalculateResponseData>> {
  return fetchLaravelApi<LaravelCalculateResponseData>("/checkout/calculate", {
    method: "POST",
    headers: trackingHeaders,
    body: JSON.stringify(payload),
    cache: "no-store",
  });
}

/**
 * 7. Submit COD Order (POST /checkout/order-save)
 */
export async function apiSaveOrder(
  payload: LaravelOrderSavePayload,
  trackingHeaders: Record<string, string> = {}
): Promise<LaravelApiResponse<LaravelOrderSaveResponseData>> {
  const baseUrl = getLaravelApiBaseUrl();
  const url = `${baseUrl}/checkout/order-save`;

  const headers = getLaravelAuthHeaders(trackingHeaders);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      return {
        success: false,
        message: data?.message || data?.error || `Order creation failed (HTTP ${response.status})`,
        errors: data?.errors,
        data: data?.data,
      };
    }

    return {
      success: true,
      data: data?.data ?? data,
      message: data?.message || "Order created successfully",
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Network error during order submission";
    return {
      success: false,
      message: errorMsg,
    };
  }
}

/**
 * 8. Submit Abandoned Lead (POST /checkout/lead)
 */
export async function apiSaveLead(
  payload: LaravelLeadPayload,
  trackingHeaders: Record<string, string> = {}
): Promise<LaravelApiResponse<any>> {
  const baseUrl = getLaravelApiBaseUrl();
  const url = `${baseUrl}/checkout/lead`;

  const headers = getLaravelAuthHeaders(trackingHeaders);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    const data = await response.json().catch(() => null);

    return {
      success: response.ok,
      data: data?.data ?? data,
      message: data?.message,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Network error during lead submission";
    return {
      success: false,
      message: errorMsg,
    };
  }
}


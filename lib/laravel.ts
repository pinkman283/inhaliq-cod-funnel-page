import "server-only";
import { sanitizeText } from "./sanitize";
import {
  apiGetCampaign,
  apiGetProduct,
  apiGetCategories,
  apiGetCategoryProducts,
  apiGetNavMenu,
  apiGetSubcategoryProducts,
  apiGetShopProducts,
  apiGetShippingCharges,
  LaravelProductResource,
  LaravelShippingCharge,
  LaravelCategory,
} from "./laravel-api";

export interface VariantOption {
  id: number;
  name: string; // Sanitized via sanitizeText()
  price?: number;
  stock_qty?: number;
}

export interface SanitizedCategory {
  id: number;
  name: string; // Sanitized category name
  slug: string;
  productCount: number;
}

export interface SanitizedProduct {
  id: number;           // Laravel product_id
  name: string;         // Sanitized title
  slug: string;
  shortSpecs: string;   // Sanitized short description / specs
  regularPrice: number; // Regular price
  offerPrice: number;   // Active selling price resolved from Laravel product object
  image: string;        // Proxied URL: /api/image-proxy?url=...
  gallery: string[];    // Proxied gallery URLs
  colors: VariantOption[]; // Mapped from product colors/variants
  sizes: VariantOption[];  // Mapped from product sizes/variants
  inStock: boolean;
  hasVariants: boolean;
  categoryId?: number;
  categorySlug?: string;
  categoryName?: string;
}

export interface ShippingArea {
  id: string | number;
  name: string;
  amount: number;
}

/**
 * Formats an image URL through our server-side image proxy to prevent leaking store domains.
 */
export function proxyImageUrl(rawUrl: string | undefined | null): string {
  if (!rawUrl || typeof rawUrl !== "string") {
    return "/placeholder-product.svg";
  }

  // If already proxied, return as-is
  if (rawUrl.startsWith("/api/image-proxy")) {
    return rawUrl;
  }

  // If relative path, resolve with backend origin
  const backendOrigin = (process.env.LARAVEL_BACKEND_ORIGIN || "https://inhaliq.com").replace(/\/+$/, "");
  let absoluteUrl = rawUrl;
  if (rawUrl.startsWith("/")) {
    absoluteUrl = `${backendOrigin}${rawUrl}`;
  }

  return `/api/image-proxy?url=${encodeURIComponent(absoluteUrl)}`;
}

/**
 * Normalizes a raw product from Laravel API into a clean, Meta-compliant SanitizedProduct.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeProduct(
  raw: any,
  categoryContext?: { id: number; slug: string; name: string }
): SanitizedProduct {
  // Extract selling price (checking new_price, sale_price, offer_price, price)
  const offerPrice = Number(
    raw.new_price ?? raw.sale_price ?? raw.offer_price ?? raw.price ?? 0
  );

  // Extract regular price (checking old_price, regular_price, mrp)
  let regularPrice = Number(raw.old_price ?? raw.regular_price ?? raw.mrp ?? 0);
  if (!regularPrice || regularPrice <= offerPrice) {
    regularPrice = offerPrice;
  }

  // Extract main image
  let rawImage = "";
  if (typeof raw.image === "string") {
    rawImage = raw.image;
  } else if (raw.image && typeof raw.image === "object" && raw.image.image) {
    rawImage = raw.image.image;
  } else if (raw.image && typeof raw.image === "object" && raw.image.url) {
    rawImage = raw.image.url;
  } else if (Array.isArray(raw.images) && raw.images.length > 0) {
    const firstImg = raw.images[0];
    rawImage = typeof firstImg === "string" ? firstImg : firstImg?.image || firstImg?.url || "";
  } else if (raw.feature_image) {
    rawImage = raw.feature_image;
  }

  // Extract gallery images
  const gallery: string[] = [];
  if (Array.isArray(raw.images)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    raw.images.forEach((img: any) => {
      const imgUrl = typeof img === "string" ? img : img?.image || img?.url;
      if (imgUrl) gallery.push(proxyImageUrl(imgUrl));
    });
  }

  // Extract colors / variant 1
  const rawColors = raw.colors || raw.procolors || raw.color || [];
  const colors: VariantOption[] = Array.isArray(rawColors)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? rawColors
        .filter((c: any) => c && (c.id !== undefined || c.color_id !== undefined))
        .map((c: any) => ({
          id: Number(c.id ?? c.color_id),
          name: sanitizeText(c.name || c.color_name || c.title || String(c)),
          price: c.price !== undefined && c.price !== null ? Number(c.price) : undefined,
          stock_qty: c.stock !== undefined ? Number(c.stock) : (c.stock_qty !== undefined && c.stock_qty !== null ? Number(c.stock_qty) : undefined),
        }))
    : [];

  // If variants array is present (pre-materialized variants from senior backend)
  if (Array.isArray(raw.variants) && raw.variants.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    raw.variants.forEach((v: any) => {
      const vColorId = v.color_id || v.id;
      const vName = v.name || v.color_name || v.title || `Variant ${colors.length + 1}`;
      if (!colors.some((c) => c.id === Number(vColorId))) {
        colors.push({
          id: Number(vColorId),
          name: sanitizeText(vName),
          price: v.new_price !== undefined ? Number(v.new_price) : (v.price !== undefined ? Number(v.price) : undefined),
          stock_qty: v.stock !== undefined ? Number(v.stock) : (v.stock_quantity !== undefined ? Number(v.stock_quantity) : undefined),
        });
      }
    });
  }

  // Extract sizes / variant 2
  const rawSizes = raw.sizes || raw.prosizes || raw.size || [];
  const sizes: VariantOption[] = Array.isArray(rawSizes)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? rawSizes
        .filter((s: any) => s && (s.id !== undefined || s.size_id !== undefined))
        .map((s: any) => ({
          id: Number(s.id ?? s.size_id),
          name: sanitizeText(s.name || s.size_name || s.title || String(s)),
          price: s.price !== undefined && s.price !== null ? Number(s.price) : undefined,
          stock_qty: s.stock !== undefined ? Number(s.stock) : (s.stock_qty !== undefined && s.stock_qty !== null ? Number(s.stock_qty) : undefined),
        }))
    : [];

  // Short specs / description
  const rawDescription = raw.short_description || raw.description || raw.details || raw.specification || "";
  const shortSpecs = sanitizeText(rawDescription) || "প্রিমিয়াম কোয়ালিটি এবং নিখুঁত ফিনিশিং।";

  // Stock status (checking stock, stock_qty, stock_quantity)
  const rawStock = raw.stock ?? raw.stock_qty ?? raw.stock_quantity;
  const inStock = raw.stock_status !== "out_of_stock" && (rawStock === undefined || Number(rawStock) > 0);

  const hasVariants = colors.length > 0 || sizes.length > 0;

  // Resolve Category info (prefer explicit subcategory context when categorized by subcategory)
  const rawSubCatId = Array.isArray(raw.sub_category_ids) && raw.sub_category_ids.length > 0
    ? Number(raw.sub_category_ids[0])
    : undefined;

  const resolvedCategoryId = categoryContext?.id ?? rawSubCatId ?? (
    Array.isArray(raw.category_ids) && raw.category_ids.length > 0
      ? Number(raw.category_ids[0])
      : (raw.category_id ? Number(raw.category_id) : undefined)
  );

  return {
    id: Number(raw.id ?? raw.product_id ?? 1),
    name: sanitizeText(raw.name || raw.title || "প্রিমিয়াম প্রোডাক্ট"),
    slug: raw.slug || `product-${raw.id || Date.now()}`,
    shortSpecs,
    regularPrice,
    offerPrice,
    image: proxyImageUrl(rawImage),
    gallery: gallery.length > 0 ? gallery : [proxyImageUrl(rawImage)],
    colors,
    sizes,
    inStock,
    hasVariants,
    categoryId: resolvedCategoryId,
    categorySlug: categoryContext?.slug,
    categoryName: categoryContext?.name,
  };
}

/**
 * Standard BD shipping area defaults when unconfigured in backend
 */
export const DEFAULT_SHIPPING_AREAS: ShippingArea[] = [
  { id: "11", name: "Inside Dhaka", amount: 60 },
  { id: "13", name: "Outside Dhaka", amount: 120 },
];

/**
 * Hydrates products with detailed variant and gallery data when needed.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function enrichProductsWithDetails(rawProducts: any[]): Promise<SanitizedProduct[]> {
  const activeProducts = rawProducts.filter(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (p: any) => p && (p.status === undefined || p.status === 1)
  );

  const enriched = await Promise.all(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    activeProducts.map(async (p: any) => {
      const hasColors = Array.isArray(p.colors || p.procolors) && (p.colors || p.procolors).length > 0;
      const hasSizes = Array.isArray(p.sizes || p.prosizes) && (p.sizes || p.prosizes).length > 0;

      // If variants are missing and slug is present, fetch detailed product resource
      if (!hasColors && !hasSizes && p.slug) {
        try {
          const detail = await apiGetProduct(p.slug);
          if (detail.success && detail.data) {
            return normalizeProduct({ ...p, ...detail.data });
          }
        } catch {
          // Fall back to normalizing the raw summary product
        }
      }
      return normalizeProduct(p);
    })
  );

  return enriched;
}

export interface FunnelCatalogData {
  products: SanitizedProduct[];
  categories: SanitizedCategory[];
}

/**
 * Fetches all products category-wise from Laravel Headless API.
 * 1. Honors LARAVEL_CAMPAIGN_SLUG or LARAVEL_PRODUCT_SLUGS if set.
 * 2. Fetches categories from GET /categories and products per category via GET /category/{slug}?per_page=100.
 * 3. Falls back to GET /shop?per_page=100 if categories are empty.
 */
export async function getFunnelCatalog(): Promise<FunnelCatalogData> {
  const campaignSlug = process.env.LARAVEL_CAMPAIGN_SLUG?.trim();
  const productSlugs = process.env.LARAVEL_PRODUCT_SLUGS?.trim();

  // Strategy 1: Specific Campaign
  if (campaignSlug) {
    const res = await apiGetCampaign(campaignSlug);
    if (res.success && res.data) {
      const rawData = res.data?.data || res.data;
      const rawProducts = Array.isArray(rawData?.products?.data)
        ? rawData.products.data
        : Array.isArray(rawData?.products)
        ? rawData.products
        : Array.isArray(rawData?.selected_products)
        ? rawData.selected_products
        : [];
      if (rawProducts.length > 0) {
        const products = await enrichProductsWithDetails(rawProducts);
        return { products, categories: [] };
      }
    }
  }

  // Strategy 2: Specific product slugs
  if (productSlugs) {
    const slugs = productSlugs.split(",").map((s) => s.trim()).filter(Boolean);
    if (slugs.length > 0) {
      const promises = slugs.map((slug) => apiGetProduct(slug));
      const results = await Promise.all(promises);
      const validProducts = results
        .filter((r) => r.success && r.data)
        .map((r) => normalizeProduct(r.data!));

      if (validProducts.length > 0) {
        return { products: validProducts, categories: [] };
      }
    }
  }

  // Strategy 3: Subcategory-wise fetching for the Disposable category ONLY
  let disposableSubcategories: Array<{ id: number; name: string; slug: string }> = [];

  try {
    const navRes = await apiGetNavMenu();
    if (navRes.success && navRes.data) {
      const menuList = Array.isArray(navRes.data?.data)
        ? navRes.data.data
        : (Array.isArray(navRes.data) ? navRes.data : []);

      // Find Disposable category strictly
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dispCat = menuList.find((c: any) =>
        c && (
          String(c.slug).includes("disposable") ||
          /disposable/i.test(c.name || "") ||
          Number(c.id) === 2
        )
      );

      if (dispCat && Array.isArray(dispCat.sub_categories) && dispCat.sub_categories.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        disposableSubcategories = dispCat.sub_categories
          .filter((sub: any) => !/ieet/i.test(sub.name || sub.slug || "") && Number(sub.id) !== 8)
          .map((sub: any) => ({
            id: Number(sub.id),
            name: String(sub.name || sub.sub_category_name || "Subcategory"),
            slug: String(sub.slug),
          }));
      }
    }
  } catch (err) {
    console.warn("[getFunnelCatalog] Could not fetch nav-menu, using standard disposable subcategories:", err);
  }

  // Fallback subcategories if nav-menu was unreachable (strictly excluding IEET)
  if (disposableSubcategories.length === 0) {
    disposableSubcategories = [
      { id: 1, name: "Flyto", slug: "flyto-2" },
      { id: 9, name: "D-Breath", slug: "d-breath" },
      { id: 7, name: "Voltbar", slug: "voltbar" },
    ];
  }

  const activeCategories: SanitizedCategory[] = [];
  const categoryProductsMap = new Map<number, SanitizedProduct>();

  const subCatPromises = disposableSubcategories.map(async (sub) => {
    try {
      const pRes = await apiGetSubcategoryProducts(sub.slug, 100);
      const rawData = pRes.data?.data || pRes.data;
      const rawList = Array.isArray(rawData?.products?.data)
        ? rawData.products.data
        : Array.isArray(rawData?.products)
        ? rawData.products
        : Array.isArray(rawData?.data)
        ? rawData.data
        : (Array.isArray(rawData) ? rawData : []);

      const sanitizedSubName = sanitizeText(sub.name);
      const subContext = { id: sub.id, slug: sub.slug, name: sanitizedSubName };

      const subProducts: SanitizedProduct[] = rawList
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((p: any) => p && (p.status === undefined || p.status === 1 || p.status === "1") && !/ieet/i.test(p.name || p.slug || ""))
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((p: any) => normalizeProduct(p, subContext));

      return {
        cat: {
          id: sub.id,
          name: sanitizedSubName,
          slug: sub.slug,
          productCount: subProducts.length,
        },
        products: subProducts,
      };
    } catch {
      return { cat: null, products: [] };
    }
  });

  const results = await Promise.all(subCatPromises);

  for (const r of results) {
    if (r.cat && r.products.length > 0) {
      activeCategories.push(r.cat);
      for (const p of r.products) {
        if (!categoryProductsMap.has(p.id)) {
          categoryProductsMap.set(p.id, p);
        }
      }
    }
  }

  // Fallback: If for some reason subcategory endpoints yielded 0 products,
  // query category/disposable-1 and group by sub_category_ids
  if (categoryProductsMap.size === 0) {
    const dispRes = await apiGetCategoryProducts("disposable-1", 100);
    const rawData = dispRes.data?.data || dispRes.data;
    const rawList = Array.isArray(rawData?.products?.data)
      ? rawData.products.data
      : Array.isArray(rawData?.products)
      ? rawData.products
      : [];

    const subMap = new Map<number, { id: number; name: string; slug: string }>();
    disposableSubcategories.forEach((s) => subMap.set(s.id, s));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const p of rawList.filter((item: any) => item && (item.status === undefined || item.status === 1))) {
      const subId = Array.isArray(p.sub_category_ids) && p.sub_category_ids.length > 0
        ? Number(p.sub_category_ids[0])
        : 1;
      const subInfo = subMap.get(subId) || { id: subId, name: "Flyto", slug: "flyto-2" };
      const normalized = normalizeProduct(p, {
        id: subInfo.id,
        slug: subInfo.slug,
        name: sanitizeText(subInfo.name),
      });
      if (!categoryProductsMap.has(normalized.id)) {
        categoryProductsMap.set(normalized.id, normalized);
      }
    }
  }

  // Sort subcategories by productCount descending (e.g. Flyto (47), D-Breath (12), Voltbar (3), IEET (2))
  activeCategories.sort((a, b) => b.productCount - a.productCount);

  const allProducts = Array.from(categoryProductsMap.values());

  return {
    products: allProducts,
    categories: activeCategories,
  };
}

export async function getFunnelProducts(): Promise<SanitizedProduct[]> {
  const catalog = await getFunnelCatalog();
  return catalog.products;
}

/**
 * Fetches standardized shipping charges dynamically from Laravel API (Strictly Inside Dhaka and Outside Dhaka)
 */
export async function getFunnelShippingCharges(): Promise<ShippingArea[]> {
  const res = await apiGetShippingCharges();

  if (res.success && Array.isArray(res.data) && res.data.length > 0) {
    return res.data
      .filter((item: LaravelShippingCharge) => !/near.*dhaka/i.test(item.name || ""))
      .map((item: LaravelShippingCharge) => ({
        id: String(item.id),
        name: sanitizeText(item.name || "Delivery Zone"),
        amount: Number(item.amount || 60),
      }));
  }

  return DEFAULT_SHIPPING_AREAS;
}

import { NextRequest, NextResponse } from "next/server";
import { apiSaveLead, LaravelLeadPayload } from "@/lib/laravel-api";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const cleanPhone = String(body.phone || "").trim();

    // 1. Validate phone number before submitting lead (strictly 11-digit BD mobile format)
    if (!cleanPhone || !/^01[3-9]\d{8}$/.test(cleanPhone)) {
      return NextResponse.json(
        { success: false, reason: "Invalid phone number" },
        { status: 422 }
      );
    }

    // 2. Resolve client device type from User-Agent if not provided
    const userAgent = request.headers.get("user-agent") || "";
    const isMobile = /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
    const isTablet = /iPad|tablet/i.test(userAgent);
    const defaultDeviceType = isMobile ? "mobile" : isTablet ? "tablet" : "desktop";

    // 3. Prepare senior developer's official Laravel /checkout/lead payload
    const payload: LaravelLeadPayload = {
      phone: cleanPhone,
      name: body.name ? String(body.name).trim() : undefined,
      address: body.address ? String(body.address).trim() : undefined,
      product_ids: Array.isArray(body.product_ids)
        ? body.product_ids.map(Number)
        : body.product_id
        ? [Number(body.product_id)]
        : undefined,
      utm_source: body.utm_source || "facebook",
      utm_medium: body.utm_medium || "cpc",
      utm_campaign: body.utm_campaign || "cod_funnel",
      referrer: body.referrer || "https://l.facebook.com/",
      domain: body.domain || request.headers.get("host") || "cod-funnel.local",
      device_type: body.device_type || defaultDeviceType,
      channel: body.channel || (body.utm_source === "google" ? "google" : "facebook"),
      app_type: body.app_type || "mobile_web",
    };

    // 4. Forward tracking and CAPI headers
    const trackingHeaders: Record<string, string> = {
      "X-Event-Source-Url": body.eventSourceUrl || request.headers.get("referer") || "",
      "X-FBP": body.fbp || "",
      "X-FBC": body.fbc || "",
      "X-Device-ID": body.deviceId || "",
    };

    const response = await apiSaveLead(payload, trackingHeaders);

    return NextResponse.json({
      success: response.success,
      data: response.data,
      message: response.message,
    });
  } catch (err) {
    console.warn("[COD Lead API Error]:", err);
    // Lead capture must never disrupt the customer
    return NextResponse.json(
      { success: false, error: "Internal lead capture error" },
      { status: 500 }
    );
  }
}

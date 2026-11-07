import { NextRequest, NextResponse } from "next/server";
import { apiSaveLead, LaravelLeadPayload } from "@/lib/laravel-api";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const cleanPhone = String(body.phone || "").trim();

    // Validate phone number minimally before submitting lead
    if (!cleanPhone || !/^01[3-9]\d{8}$/.test(cleanPhone)) {
      return NextResponse.json({ success: false, reason: "Invalid phone number" }, { status: 400 });
    }

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
      device_type: body.device_type || "mobile",
      channel: body.channel || "facebook",
      app_type: body.app_type || "mobile_web",
    };

    const trackingHeaders: Record<string, string> = {
      "X-Event-Source-Url": body.eventSourceUrl || request.headers.get("referer") || "",
      "X-FBP": body.fbp || "",
      "X-FBC": body.fbc || "",
      "X-Device-ID": body.deviceId || "",
    };

    const response = await apiSaveLead(payload, trackingHeaders);

    return NextResponse.json({ success: response.success });
  } catch (err) {
    console.warn("[COD Lead API Error]:", err);
    // Lead recording should never disrupt the customer
    return NextResponse.json({ success: false }, { status: 200 });
  }
}

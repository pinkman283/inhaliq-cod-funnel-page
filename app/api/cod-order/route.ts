import { NextRequest, NextResponse } from "next/server";
import { apiSaveOrder, getActiveCodPaymentMethod, LaravelOrderSavePayload } from "@/lib/laravel-api";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // 1. Validate required customer information
    const { name, phone, address, area, product_id, qty, size_id, color_id, price } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { success: false, error: "আপনার নাম প্রদান করা আবশ্যক।" },
        { status: 422 }
      );
    }

    const cleanPhone = String(phone || "").trim();
    if (!cleanPhone || !/^01[3-9]\d{8}$/.test(cleanPhone)) {
      return NextResponse.json(
        { success: false, error: "সঠিক ১১ ডিজিটের মোবাইল নম্বর দিন (যেমন: 017XXXXXXXX)।" },
        { status: 422 }
      );
    }

    if (!address || typeof address !== "string" || address.trim().length < 5) {
      return NextResponse.json(
        { success: false, error: "আপনার সম্পূর্ণ ডেলিভারি ঠিকানা প্রদান করুন।" },
        { status: 422 }
      );
    }

    if (!area) {
      return NextResponse.json(
        { success: false, error: "ডেলিভারি এলাকা নির্বাচন করুন।" },
        { status: 422 }
      );
    }

    if (!product_id || !qty || Number(qty) < 1) {
      return NextResponse.json(
        { success: false, error: "প্রোডাক্ট এবং পরিমাণ নির্বাচন করুন।" },
        { status: 422 }
      );
    }

    // 2. Resolve active COD payment gateway accepted by backend
    const paymentMethod = await getActiveCodPaymentMethod();

    // 3. Build official Laravel /checkout/order-save payload
    const payload: LaravelOrderSavePayload = {
      name: name.trim(),
      phone: cleanPhone,
      address: address.trim(),
      area: String(area),
      note: body.note ? String(body.note).trim() : "",
      payment_method: paymentMethod,
      coupon_code: body.coupon_code || "",
      utm_source: body.utm_source || "facebook",
      utm_medium: body.utm_medium || "cpc",
      utm_campaign: body.utm_campaign || "cod_funnel",
      referrer: body.referrer || "https://l.facebook.com/",
      device_type: body.device_type || "mobile",
      channel: body.channel || "facebook",
      domain: body.domain || request.headers.get("host") || "cod-funnel.local",
      app_type: body.app_type || "mobile_web",
      items: [
        {
          product_id: Number(product_id),
          qty: Number(qty),
          price: price !== undefined && price !== null ? Number(price) : undefined,
          size_id: size_id !== undefined && size_id !== null ? Number(size_id) : null,
          color_id: color_id !== undefined && color_id !== null ? Number(color_id) : null,
        },
      ],
    };

    // 3. Prepare CAPI and Tracking Headers
    const trackingHeaders: Record<string, string> = {
      "X-Event-Source-Url": body.eventSourceUrl || request.headers.get("referer") || "",
      "X-FBP": body.fbp || "",
      "X-FBC": body.fbc || "",
      "X-Device-ID": body.deviceId || "",
    };

    // 4. Submit order directly to Laravel backend API
    const response = await apiSaveOrder(payload, trackingHeaders);

    // 5. Strict verification of backend API response (Zero fake/simulated orders)
    if (!response.success || !response.data) {
      console.error("[Backend Order Creation Failed]:", response.message, response.errors);
      return NextResponse.json(
        {
          success: false,
          error:
            response.message ||
            "অর্ডারটি গ্রহণ করা সম্ভব হয়নি। অনুগ্রহ করে তথ্য যাচাই করে পুনরায় চেষ্টা করুন।",
          errors: response.errors,
        },
        { status: 422 }
      );
    }

    // 6. Return genuine order and invoice data verified by backend
    return NextResponse.json({
      success: true,
      order_id: response.data.order_id,
      invoice_id: response.data.invoice_id,
      total: response.data.total,
      token: response.data.token,
      event_id: response.data.event_id,
      message: response.message || "আপনার অর্ডারটি সফলভাবে গ্রহণ করা হয়েছে!",
    });
  } catch (error) {
    console.error("[Order Submission Exception]:", error);
    return NextResponse.json(
      {
        success: false,
        error: "সার্ভারের সাথে সংযোগে ত্রুটি দেখা দিয়েছে। কিছুক্ষণ পর চেষ্টা করুন।",
      },
      { status: 500 }
    );
  }
}

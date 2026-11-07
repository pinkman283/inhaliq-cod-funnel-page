import { NextRequest, NextResponse } from "next/server";
import { apiCalculateOrder, LaravelCalculatePayload } from "@/lib/laravel-api";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { area_id, product_id, qty, size_id, color_id, price, coupon_code } = body;

    // Validate required fields
    if (!product_id || !qty || Number(qty) < 1) {
      return NextResponse.json(
        { success: false, error: "প্রোডাক্ট এবং পরিমাণ নির্বাচন করুন।" },
        { status: 422 }
      );
    }

    // Build payload matching Laravel POST /checkout/calculate contract
    const payload: LaravelCalculatePayload = {
      area_id: area_id !== undefined && area_id !== null ? area_id : 1,
      coupon_code: coupon_code ? String(coupon_code).trim() : undefined,
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

    // Forward CAPI headers
    const trackingHeaders: Record<string, string> = {
      "X-Event-Source-Url": body.eventSourceUrl || request.headers.get("referer") || "",
      "X-FBP": body.fbp || "",
      "X-FBC": body.fbc || "",
      "X-Device-ID": body.deviceId || "",
    };

    const response = await apiCalculateOrder(payload, trackingHeaders);

    if (!response.success || !response.data) {
      return NextResponse.json(
        {
          success: false,
          error: response.message || "অর্ডার ক্যালকুলেশন সম্পন্ন করা যায়নি।",
          errors: response.errors,
        },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        subtotal: Number(response.data.subtotal || 0),
        shipping_fee: Number(response.data.shipping_fee || 0),
        discount: Number(response.data.discount || 0),
        total: Number(response.data.total || 0),
      },
    });
  } catch (error) {
    console.error("[Calculation Route Error]:", error);
    return NextResponse.json(
      { success: false, error: "সার্ভারে অর্ডার হিসাব প্রক্রিয়াকরণে ত্রুটি।" },
      { status: 500 }
    );
  }
}


import { NextRequest, NextResponse } from "next/server";

// Fallback SVG placeholder when an image cannot be retrieved
const FALLBACK_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600" fill="#0f172a">
  <rect width="600" height="600" fill="#1e293b"/>
  <circle cx="300" cy="270" r="90" fill="#334155"/>
  <path d="M250 270 L285 305 L350 240" stroke="#10b981" stroke-width="12" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  <text x="300" y="420" font-family="system-ui, sans-serif" font-size="24" font-weight="600" fill="#94a3b8" text-anchor="middle">
    Premium Lifestyle Edition
  </text>
  <text x="300" y="460" font-family="system-ui, sans-serif" font-size="18" fill="#64748b" text-anchor="middle">
    Cash on Delivery Available
  </text>
</svg>
`.trim();

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const idParam = searchParams.get("id");
  const urlParam = searchParams.get("url");

  let targetUrl = "";

  if (idParam) {
    try {
      const decodedPath = Buffer.from(idParam, "base64url").toString("utf-8");
      // Security check: must start with / to prevent open proxy abuse
      if (!decodedPath.startsWith("/")) {
        return new NextResponse("Invalid image path", { status: 400 });
      }
      const backendOrigin = (process.env.LARAVEL_BACKEND_ORIGIN || "https://www.inhaliq.com").replace(/\/+$/, "");
      targetUrl = `${backendOrigin}${decodedPath}`;
    } catch {
      targetUrl = "";
    }
  } else if (urlParam) {
    targetUrl = urlParam;
  }

  if (!targetUrl) {
    return new NextResponse(FALLBACK_SVG, {
      status: 200,
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=86400",
      },
    });
  }

  try {
    const parsedTarget = new URL(targetUrl);
    const backendOrigin = process.env.LARAVEL_BACKEND_ORIGIN;

    // Security check: ensure valid protocols (http or https)
    if (parsedTarget.protocol !== "http:" && parsedTarget.protocol !== "https:") {
      return new NextResponse("Invalid protocol", { status: 400 });
    }

    // If LARAVEL_BACKEND_ORIGIN is configured, validate origin or allowed CDN/image origins
    if (backendOrigin) {
      try {
        const allowedOrigin = new URL(backendOrigin).origin;
        // Allow the configured origin or trusted placeholder domains
        const isAllowedOrigin =
          parsedTarget.origin === allowedOrigin ||
          parsedTarget.hostname === "inhaliq.com" ||
          parsedTarget.hostname.endsWith(".inhaliq.com") ||
          targetUrl.startsWith(backendOrigin) ||
          parsedTarget.hostname.endsWith("unsplash.com") ||
          parsedTarget.hostname.endsWith("placeholder.com");

        if (!isAllowedOrigin) {
          console.warn(`[Image Proxy] Origin mismatch: ${parsedTarget.origin} vs ${allowedOrigin}`);
          // Return fallback instead of leaking store domain or giving error
          return new NextResponse(FALLBACK_SVG, {
            status: 200,
            headers: {
              "Content-Type": "image/svg+xml",
              "Cache-Control": "public, max-age=86400",
            },
          });
        }
      } catch (err) {
        console.warn("[Image Proxy] Error parsing backend origin", err);
      }
    }

    // Fetch image server-to-server
    const response = await fetch(targetUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      },
      next: { revalidate: 86400 },
    });

    if (!response.ok) {
      console.warn(`[Image Proxy] Fetch returned status ${response.status} for ${targetUrl}`);
      return new NextResponse(FALLBACK_SVG, {
        status: 200,
        headers: {
          "Content-Type": "image/svg+xml",
          "Cache-Control": "public, max-age=86400",
        },
      });
    }

    const contentType = response.headers.get("Content-Type") || "image/jpeg";
    const imageBuffer = await response.arrayBuffer();

    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
        // Avoid leaking headers that mention backend origin
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("[Image Proxy] Failed to proxy image:", error);
    return new NextResponse(FALLBACK_SVG, {
      status: 200,
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=86400",
      },
    });
  }
}


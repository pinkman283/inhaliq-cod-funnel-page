import { Suspense } from "react";
import { getFunnelCatalog, getFunnelShippingCharges } from "@/lib/laravel";
import { CodFunnelClient } from "@/components/CodFunnelClient";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  // Fetch sanitized products, categories, and shipping rules server-side
  const [catalog, shippingAreas] = await Promise.all([
    getFunnelCatalog(),
    getFunnelShippingCharges(),
  ]);

  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
          <div className="w-12 h-12 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin mb-4" />
          <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">
            লোডিং হচ্ছে, অনুগ্রহ করে অপেক্ষা করুন...
          </p>
        </div>
      }
    >
      <CodFunnelClient
        products={catalog.products}
        categories={catalog.categories}
        shippingAreas={shippingAreas}
      />
    </Suspense>
  );
}

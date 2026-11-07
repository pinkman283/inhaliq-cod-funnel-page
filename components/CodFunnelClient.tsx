"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import {
  ShieldCheck,
  Truck,
  CheckCircle2,
  Package,
  PhoneCall,
  AlertCircle,
  Plus,
  Minus,
  Check,
  ShoppingBag,
  Printer,
  RotateCcw,
  ArrowRight,
  User,
  MapPin,
  FileText,
  ChevronDown,
  Layers,
  HelpCircle,
  Clock,
} from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { SanitizedProduct, SanitizedCategory, ShippingArea } from "@/lib/laravel";
import { getBrowserTrackingData, trackClientPixelEvent } from "@/lib/tracking";

interface CodFunnelClientProps {
  products: SanitizedProduct[];
  categories?: SanitizedCategory[];
  shippingAreas: ShippingArea[];
}

interface OrderSuccessData {
  order_id: string | number;
  invoice_id: string;
  total: number;
  productName: string;
  variantText: string;
  quantity: number;
  name: string;
  phone: string;
  address: string;
  areaName: string;
}

// Convert English numbers to Bengali numerals
function toBengaliNumerals(num: number | string): string {
  const bnDigits = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
  return String(num).replace(/[0-9]/g, (d) => bnDigits[Number(d)]);
}

// Format currency with Bengali numerals
function formatCurrency(amount: number): string {
  const formatted = amount.toLocaleString("en-IN");
  return `৳${toBengaliNumerals(formatted)}`;
}

export function CodFunnelClient({
  products,
  categories = [],
  shippingAreas,
}: CodFunnelClientProps) {
  const searchParams = useSearchParams();

  // Category filter state (Category-wise browsing)
  const [selectedCategorySlug, setSelectedCategorySlug] = useState<string>("all");

  // Filtered products based on active category
  const displayedProducts = useMemo(() => {
    if (selectedCategorySlug === "all") return products;
    const activeCat = categories.find((c) => c.slug === selectedCategorySlug);
    return products.filter((p) => {
      if (p.categorySlug === selectedCategorySlug) return true;
      if (activeCat && p.categoryId === activeCat.id) return true;
      return false;
    });
  }, [products, selectedCategorySlug, categories]);

  // 1. Initial product selection (support ?id=... query param)
  const queryId = searchParams.get("id");
  const initialProduct = useMemo(() => {
    if (queryId) {
      const found = products.find((p) => String(p.id) === queryId);
      if (found) return found;
    }
    return products[0] || null;
  }, [products, queryId]);

  const [selectedProduct, setSelectedProduct] = useState<SanitizedProduct | null>(initialProduct);
  const [activeImage, setActiveImage] = useState<string>(initialProduct?.image || "");
  const [selectedColorId, setSelectedColorId] = useState<number | null>(null);
  const [selectedSizeId, setSelectedSizeId] = useState<number | null>(null);
  const [quantity, setQuantity] = useState<number>(1);

  // Strictly filter shipping areas to Inside Dhaka and Outside Dhaka only (excluding Near Dhaka)
  const activeShippingAreas = useMemo(() => {
    return shippingAreas.filter((a) => !/near.*dhaka/i.test(a.name));
  }, [shippingAreas]);

  // Default shipping area (initially none selected — customer must choose)
  const [selectedAreaId, setSelectedAreaId] = useState<string>("");

  // Form Fields
  const [name, setName] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [address, setAddress] = useState<string>("");
  const [note, setNote] = useState<string>("");

  // UI & Submission State
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [orderSuccess, setOrderSuccess] = useState<OrderSuccessData | null>(null);
  const [showFloatingBar, setShowFloatingBar] = useState<boolean>(false);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  // Backend Calculation & Coupon State (Phase 5)
  const [backendCalculation, setBackendCalculation] = useState<{
    subtotal: number;
    shipping_fee: number;
    discount: number;
    total: number;
  } | null>(null);
  const [isCalculating, setIsCalculating] = useState<boolean>(false);
  const [couponInput, setCouponInput] = useState<string>("");
  const [appliedCoupon, setAppliedCoupon] = useState<string>("");
  const [couponFeedback, setCouponFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Phone validation status
  const isPhoneValid = useMemo(() => /^01[3-9]\d{8}$/.test(phone.trim()), [phone]);
  const phoneTouched = phone.length > 0;

  // Refs
  const lastLeadKeyRef = useRef<string>("");
  const isSubmittingRef = useRef<boolean>(false);
  const checkoutSectionRef = useRef<HTMLDivElement>(null);
  const productSectionRef = useRef<HTMLDivElement>(null);

  // Sync active image & variants whenever selected product changes
  useEffect(() => {
    if (selectedProduct) {
      setActiveImage(selectedProduct.image);
      if (selectedProduct.colors.length > 0) {
        setSelectedColorId(selectedProduct.colors[0].id);
      } else {
        setSelectedColorId(null);
      }

      if (selectedProduct.sizes.length > 0) {
        setSelectedSizeId(selectedProduct.sizes[0].id);
      } else {
        setSelectedSizeId(null);
      }

      // Track ViewContent for Meta Pixel
      trackClientPixelEvent("ViewContent", {
        content_ids: [selectedProduct.id],
        content_name: selectedProduct.name,
        content_type: "product",
        value: selectedProduct.offerPrice,
        currency: "BDT",
      });
    }
  }, [selectedProduct]);

  // Mobile floating quick-order bar visibility
  useEffect(() => {
    const handleScroll = () => {
      if (!checkoutSectionRef.current) return;
      const checkoutTop = checkoutSectionRef.current.getBoundingClientRect().top;
      const scrollY = window.scrollY;

      // Show after scrolling 400px down until the checkout section is in view
      if (scrollY > 400 && checkoutTop > 300) {
        setShowFloatingBar(true);
      } else {
        setShowFloatingBar(false);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Selected Shipping Area details (null if customer has not chosen an area yet)
  const activeShippingArea = useMemo(() => {
    if (!selectedAreaId) return null;
    return activeShippingAreas.find((a) => String(a.id) === selectedAreaId) || null;
  }, [activeShippingAreas, selectedAreaId]);

  // Variant-Aware Unit Price (Phase 4)
  const unitPrice = useMemo(() => {
    if (!selectedProduct) return 0;
    const selectedColor = selectedProduct.colors.find((c) => c.id === selectedColorId);
    const selectedSize = selectedProduct.sizes.find((s) => s.id === selectedSizeId);
    return selectedColor?.price || selectedSize?.price || selectedProduct.offerPrice;
  }, [selectedProduct, selectedColorId, selectedSizeId]);

  // Live Dynamic Price Calculation with Backend /checkout/calculate (Phase 5)
  useEffect(() => {
    if (!selectedProduct) return;
    if (!selectedAreaId) {
      setBackendCalculation(null);
      return;
    }

    let isMounted = true;
    const timer = setTimeout(async () => {
      setIsCalculating(true);
      try {
        const tracking = getBrowserTrackingData();
        const res = await fetch("/api/cod-calculate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            area_id: selectedAreaId,
            product_id: selectedProduct.id,
            qty: quantity,
            size_id: selectedSizeId,
            color_id: selectedColorId,
            price: unitPrice,
            coupon_code: appliedCoupon || undefined,
            ...tracking,
          }),
        });

        const result = await res.json();
        if (isMounted) {
          if (res.ok && result.success && result.data) {
            setBackendCalculation(result.data);
            if (appliedCoupon) {
              if (result.data.discount > 0) {
                setCouponFeedback({
                  type: "success",
                  text: `কুপন '${appliedCoupon}' সফলভাবে প্রয়োগ হয়েছে (৳${toBengaliNumerals(result.data.discount)} ছাড়)!`,
                });
              } else {
                setCouponFeedback({
                  type: "error",
                  text: "কুপন কোডটি এই অর্ডারের জন্য প্রযোজ্য নয়।",
                });
              }
            }
          } else if (appliedCoupon) {
            setCouponFeedback({
              type: "error",
              text: result?.error || "কুপন কোডটি অবৈধ বা মেয়াদোত্তীর্ণ।",
            });
          }
        }
      } catch {
        // Network fallback
      } finally {
        if (isMounted) setIsCalculating(false);
      }
    }, 200);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [selectedProduct, quantity, selectedAreaId, selectedColorId, selectedSizeId, unitPrice, appliedCoupon]);

  // Genuine Subtotal, Shipping, Discount, and Total (strictly honoring backend calculation)
  const subtotal = backendCalculation?.subtotal ?? (unitPrice * quantity);
  const shippingCost = backendCalculation?.shipping_fee ?? (activeShippingArea ? activeShippingArea.amount : 0);
  const discountAmount = backendCalculation?.discount ?? 0;
  const totalPayable = backendCalculation?.total ?? (subtotal + shippingCost - discountAmount);

  // Background Abandoned Checkout Lead Capture on phone or address blur
  const handleLeadCapture = async () => {
    if (!isPhoneValid || !selectedProduct) return;

    const leadKey = `${phone.trim()}-${selectedProduct.id}`;
    if (lastLeadKeyRef.current === leadKey) return;
    lastLeadKeyRef.current = leadKey;

    try {
      const tracking = getBrowserTrackingData();
      await fetch("/api/cod-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: phone.trim(),
          name: name.trim(),
          address: address.trim(),
          product_ids: [selectedProduct.id],
          ...tracking,
        }),
      });

      // Track Lead for Meta Pixel
      trackClientPixelEvent("Lead", {
        content_name: selectedProduct.name,
        value: totalPayable,
        currency: "BDT",
      });
    } catch {
      // Lead recording fails silently
    }
  };

  // Checkout Form Submission (with duplicate submission prevention)
  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (isSubmittingRef.current || isSubmitting) return;

    if (!selectedProduct) {
      setErrorMessage("দয়া করে যেকোনো একটি মডেল নির্বাচন করুন।");
      return;
    }

    // Validate mandatory variants if present on product
    if (selectedProduct.colors.length > 0 && !selectedColorId) {
      setErrorMessage("দয়া করে প্রোডাক্টের Variant / Edition নির্বাচন করুন।");
      return;
    }

    if (selectedProduct.sizes.length > 0 && !selectedSizeId) {
      setErrorMessage("দয়া করে প্রোডাক্টের Option / Pack নির্বাচন করুন।");
      return;
    }

    if (!name.trim()) {
      setErrorMessage("আপনার পূর্ণ নাম লিখুন।");
      return;
    }

    if (!isPhoneValid) {
      setErrorMessage("সঠিক ১১ ডিজিটের মোবাইল নম্বর দিন (যেমন: 017XXXXXXXX)।");
      return;
    }

    if (!address.trim() || address.trim().length < 6) {
      setErrorMessage("সম্পূর্ণ ডেলিভারি ঠিকানা (বাসা নং, রোড, এলাকা ও জেলা) লিখুন।");
      return;
    }

    if (!selectedAreaId) {
      setErrorMessage("অনুগ্রহ করে ডেলিভারি এলাকা নির্বাচন করুন (ঢাকার ভেতরে বা বাইরে)।");
      const areaEl = document.getElementById("delivery-area-selector");
      if (areaEl) {
        areaEl.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);

    try {
      const tracking = getBrowserTrackingData();

      const response = await fetch("/api/cod-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          address: address.trim(),
          area: selectedAreaId,
          note: note.trim(),
          product_id: selectedProduct.id,
          qty: quantity,
          price: unitPrice,
          color_id: selectedColorId,
          size_id: selectedSizeId,
          coupon_code: appliedCoupon || undefined,
          totalAmount: totalPayable,
          ...tracking,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data?.error || "অর্ডার প্রক্রিয়াকরণে সমস্যা হয়েছে। আবার চেষ্টা করুন।");
      }

      // Variant string for confirmation
      const selectedColor = selectedProduct.colors.find((c) => c.id === selectedColorId);
      const selectedSize = selectedProduct.sizes.find((s) => s.id === selectedSizeId);
      const variantParts = [selectedColor?.name, selectedSize?.name].filter(Boolean);
      const variantText = variantParts.length > 0 ? variantParts.join(" / ") : "Standard Edition";

      // Confetti burst
      try {
        confetti({
          particleCount: 70,
          spread: 60,
          origin: { y: 0.6 },
          colors: ["#059669", "#10b981", "#34d399", "#3b82f6"],
        });
      } catch {
        // Confetti fallback
      }

      setOrderSuccess({
        order_id: data.order_id,
        invoice_id: data.invoice_id,
        total: data.total ?? totalPayable,
        productName: selectedProduct.name,
        variantText,
        quantity,
        name: name.trim(),
        phone: phone.trim(),
        address: address.trim(),
        areaName: activeShippingArea?.name || (selectedAreaId === "11" ? "Inside Dhaka" : "Outside Dhaka"),
      });

      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "অর্ডার করতে সমস্যা হয়েছে।";
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectProduct = (product: SanitizedProduct) => {
    setSelectedProduct(product);
    setActiveImage(product.image);
    if (checkoutSectionRef.current) {
      checkoutSectionRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const scrollToCheckout = () => {
    if (checkoutSectionRef.current) {
      checkoutSectionRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const scrollToProducts = () => {
    if (productSectionRef.current) {
      productSectionRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="w-full min-h-screen bg-slate-50 dark:bg-[#0b0f19] text-slate-900 dark:text-slate-100 transition-colors duration-250 pb-20 sm:pb-12">
      {/* 1. PROFESSIONAL BRAND HEADER WITH INTEGRATED THEME SWITCH */}
      <header className="sticky top-0 z-50 bg-white/90 dark:bg-[#111827]/90 backdrop-blur-md border-b border-slate-200/90 dark:border-slate-800 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-15 flex items-center justify-between gap-3">
          {/* Brand Identity */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-700 dark:bg-emerald-600 flex items-center justify-center text-white shadow-xs">
              <ShoppingBag className="w-4 h-4" />
            </div>
            <div>
              <span className="font-extrabold text-base sm:text-lg tracking-tight text-slate-900 dark:text-white uppercase font-sans">
                Inhaliq
              </span>
              <p className="hidden xs:block text-[10px] text-slate-500 dark:text-slate-400 font-medium leading-none">
                Official Cash on Delivery Store
              </p>
            </div>
          </div>

          {/* Genuine Customer Assurance Pill (Middle) */}
          <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 text-xs text-slate-700 dark:text-slate-300">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>১০০% ক্যাশ অন ডেলিভারি • ০ অগ্রিম পেমেন্ট</span>
          </div>

          {/* Theme Sliding Toggle Switch */}
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-block text-xs font-medium text-slate-500 dark:text-slate-400">
              থিম:
            </span>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-10 sm:space-y-12">
        <AnimatePresence mode="wait">
          {orderSuccess ? (
            /* ORDER SUCCESS CONFIRMATION SCREEN */
            <motion.div
              key="confirmation-screen"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="max-w-2xl mx-auto bg-white dark:bg-[#131c2e] rounded-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-sm text-center space-y-6"
            >
              {/* Checkmark Icon */}
              <div className="w-16 h-16 mx-auto rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-9 h-9 stroke-[2.2]" />
              </div>

              <div className="space-y-2">
                <span className="inline-block px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
                  অর্ডার সফলভাবে গৃহীত হয়েছে
                </span>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                  ধন্যবাদ! আপনার অর্ডারটি নিশ্চিত করা হয়েছে
                </h1>
                <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                  আমাদের কাস্টমার কেয়ার প্রতিনিধি শীঘ্রই আপনার নম্বরে কল করে ডেলিভারি কনফার্ম করবেন।
                </p>
              </div>

              {/* Order Invoice Details Card */}
              <div className="bg-slate-50 dark:bg-slate-900/60 rounded-xl p-4 sm:p-5 text-left border border-slate-200 dark:border-slate-800 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 text-xs sm:text-sm">
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 text-xs">ইনভয়েস নম্বর</span>
                    <p className="font-mono font-bold text-emerald-700 dark:text-emerald-400 text-sm sm:text-base">
                      #{orderSuccess.invoice_id}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-500 dark:text-slate-400 text-xs">পেমেন্ট মেথড</span>
                    <p className="font-semibold text-slate-800 dark:text-slate-200">
                      Cash on Delivery (ক্যাশ অন ডেলিভারি)
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm">
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 text-xs">গ্রাহকের নাম:</span>
                    <p className="font-semibold text-slate-900 dark:text-white">{orderSuccess.name}</p>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 text-xs">মোবাইল নম্বর:</span>
                    <p className="font-semibold text-slate-900 dark:text-white">{orderSuccess.phone}</p>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-slate-500 dark:text-slate-400 text-xs">ডেলিভারি ঠিকানা ও এলাকা:</span>
                    <p className="font-medium text-slate-800 dark:text-slate-200">
                      {orderSuccess.address} ({orderSuccess.areaName})
                    </p>
                  </div>

                  <div className="sm:col-span-2 bg-white dark:bg-slate-800/80 p-3.5 rounded-lg border border-slate-200 dark:border-slate-700/60 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">{orderSuccess.productName}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {orderSuccess.variantText} • পরিমাণ: {toBengaliNumerals(orderSuccess.quantity)} টি
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-slate-500 dark:text-slate-400">সর্বমোট প্রদেয়</span>
                      <p className="text-base sm:text-lg font-bold text-emerald-700 dark:text-emerald-400">
                        {formatCurrency(orderSuccess.total)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Genuine Delivery Assurance */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-600 dark:text-slate-400 pt-1">
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 flex items-center gap-2">
                  <Truck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>২৪-৭২ ঘণ্টায় দেশব্যাপী হোম ডেলিভারি</span>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>পার্সেল দেখে ও যাচাই করে পেমেন্ট</span>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 flex items-center gap-2">
                  <PhoneCall className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>যেকোনো তথ্যে সরাসরি ফোন সহায়তা</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex-1 inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-750 font-semibold text-xs sm:text-sm transition-colors cursor-pointer"
                >
                  <Printer className="w-4 h-4" /> ইনভয়েস প্রিন্ট / সংরক্ষণ করুন
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOrderSuccess(null);
                    setQuantity(1);
                    setErrorMessage(null);
                    setAppliedCoupon("");
                    setCouponInput("");
                    setCouponFeedback(null);
                    setBackendCalculation(null);
                  }}
                  className="flex-1 inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs sm:text-sm transition-colors cursor-pointer shadow-xs"
                >
                  <RotateCcw className="w-4 h-4" /> নতুন অর্ডার করুন
                </button>
              </div>
            </motion.div>
          ) : (
            /* MAIN FUNNEL SECTIONS */
            <>
              {/* 2. HERO SECTION */}
              <section className="text-center space-y-4 pt-2 sm:pt-4">
                <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold">
                  <span className="w-2 h-2 rounded-full bg-emerald-600 dark:bg-emerald-400" />
                  <span>অফিশিয়াল ক্যাশ অন ডেলিভারি শপ</span>
                </div>

                <div className="space-y-2 max-w-2xl mx-auto">
                  <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-snug">
                    পছন্দের মডেলটি সিলেক্ট করে সরাসরি অর্ডার করুন
                  </h1>
                  <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed">
                    সারা বাংলাদেশে নিরাপদ হোম ডেলিভারি — কোন প্রকার অগ্রিম টাকা ছাড়াই প্রোডাক্ট হাতে পেয়ে চেক করে মূল্য পরিশোধ করুন।
                  </p>
                </div>

                {/* Direct Action Trigger */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={scrollToProducts}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs sm:text-sm font-semibold hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors shadow-xs cursor-pointer"
                  >
                    <span>উপলব্ধ মডেলসমূহ দেখুন</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>

                {/* 4 Genuine Customer Benefit Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3 pt-3 text-left">
                  <div className="p-3 sm:p-3.5 rounded-xl bg-white dark:bg-[#131c2e] border border-slate-200/90 dark:border-slate-800 shadow-xs flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 shrink-0">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">ক্যাশ অন ডেলিভারি</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">০ অগ্রিম পেমেন্ট</p>
                    </div>
                  </div>

                  <div className="p-3 sm:p-3.5 rounded-xl bg-white dark:bg-[#131c2e] border border-slate-200/90 dark:border-slate-800 shadow-xs flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 shrink-0">
                      <Truck className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">হোম ডেলিভারি</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">৬৪ জেলায় দ্রুত সেবা</p>
                    </div>
                  </div>

                  <div className="p-3 sm:p-3.5 rounded-xl bg-white dark:bg-[#131c2e] border border-slate-200/90 dark:border-slate-800 shadow-xs flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 shrink-0">
                      <Package className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">চেক করে পেমেন্ট</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">হাতে পেয়ে যাচাই করুন</p>
                    </div>
                  </div>

                  <div className="p-3 sm:p-3.5 rounded-xl bg-white dark:bg-[#131c2e] border border-slate-200/90 dark:border-slate-800 shadow-xs flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 shrink-0">
                      <PhoneCall className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">ফোন সাপোর্ট</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">অর্ডার সহায়তায় কল</p>
                    </div>
                  </div>
                </div>
              </section>

              {/* 3. PRODUCT SELECTION SECTION */}
              <section ref={productSectionRef} className="space-y-4">
                <div className="flex items-center justify-between pb-1 border-b border-slate-200/80 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-400 flex items-center justify-center text-xs font-bold">
                      ১
                    </div>
                    <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                      মডেল নির্বাচন করুন
                    </h2>
                  </div>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {selectedCategorySlug === "all"
                      ? `${toBengaliNumerals(products.length)} টি মডেল উপলব্ধ`
                      : `${toBengaliNumerals(displayedProducts.length)} টি প্রদর্শিত (সর্বমোট ${toBengaliNumerals(products.length)})`}
                  </span>
                </div>

                {/* Category Filter Tabs (Category-Wise Navigation) */}
                {categories.length > 0 && (
                  <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none pt-1">
                    <button
                      type="button"
                      onClick={() => setSelectedCategorySlug("all")}
                      className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all cursor-pointer ${
                        selectedCategorySlug === "all"
                          ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs"
                          : "bg-white dark:bg-[#131c2e] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                      }`}
                    >
                      সকল প্রোডাক্ট ({toBengaliNumerals(products.length)})
                    </button>
                    {categories.map((cat) => {
                      const isSelected = selectedCategorySlug === cat.slug;
                      const count = products.filter(
                        (p) => p.categorySlug === cat.slug || p.categoryId === cat.id
                      ).length;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setSelectedCategorySlug(cat.slug)}
                          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all cursor-pointer ${
                            isSelected
                              ? "bg-emerald-700 text-white shadow-xs"
                              : "bg-white dark:bg-[#131c2e] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                          }`}
                        >
                          {cat.name} ({toBengaliNumerals(count || cat.productCount)})
                        </button>
                      );
                    })}
                  </div>
                )}

                {displayedProducts.length === 0 ? (
                  <div className="rounded-2xl bg-white dark:bg-[#131c2e] border border-slate-200 dark:border-slate-800 p-8 text-center space-y-3">
                    <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500">
                      <Package className="w-6 h-6" />
                    </div>
                    <h3 className="font-bold text-base text-slate-900 dark:text-white">বর্তমানে কোনো প্রোডাক্ট উপলব্ধ নেই</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                      অ্যাডমিন প্যানেল থেকে ক্যাম্পেইন বা শপ প্রোডাক্ট সক্রিয় রয়েছে কিনা তা যাচাই করুন অথবা কিছুক্ষণ পর রিলোড করুন।
                    </p>
                    <button
                      type="button"
                      onClick={() => window.location.reload()}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-700 text-white text-xs font-semibold hover:bg-emerald-800 transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> রিলোড করুন
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5 sm:gap-3">
                  {displayedProducts.map((product) => {
                    const isSelected = selectedProduct?.id === product.id;

                    return (
                      <div
                        key={product.id}
                        onClick={() => handleSelectProduct(product)}
                        className={`group relative rounded-xl p-2.5 sm:p-3 cursor-pointer transition-all duration-200 border flex flex-col justify-between ${
                          isSelected
                            ? "bg-white dark:bg-[#131c2e] border-emerald-600 dark:border-emerald-500 shadow-md ring-2 ring-emerald-500/20"
                            : "bg-white dark:bg-[#111827] border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-xs"
                        }`}
                      >
                        {/* Top: Selection Indicator & Stock status */}
                        <div className="flex items-center justify-between mb-2">
                          <div
                            className={`w-4 h-4 rounded-full flex items-center justify-center border transition-colors ${
                              isSelected
                                ? "border-emerald-600 bg-emerald-600 text-white"
                                : "border-slate-300 dark:border-slate-600 bg-transparent"
                            }`}
                          >
                            {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                          </div>

                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            স্টক রয়েছে
                          </span>
                        </div>

                        {/* Product Image */}
                        <div className="relative w-full aspect-square rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800/80 mb-2 flex items-center justify-center border border-slate-100 dark:border-slate-800">
                          <Image
                            src={product.image}
                            alt={product.name}
                            fill
                            unoptimized
                            sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw"
                            className="object-cover transition-transform duration-300 group-hover:scale-105"
                            loading="eager"
                          />
                        </div>

                        {/* Title & Specs */}
                        <div className="space-y-0.5 mb-2">
                          {product.categoryName && (
                            <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
                              {product.categoryName}
                            </span>
                          )}
                          <h3
                            className="font-bold text-slate-900 dark:text-white text-xs leading-snug line-clamp-2 min-h-[2rem]"
                            title={product.name}
                          >
                            {product.name}
                          </h3>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-1 leading-normal">
                            {product.shortSpecs}
                          </p>
                        </div>

                        {/* Price & Selection Button */}
                        <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-1">
                          <div>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 block leading-none">মূল্য</span>
                            <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                              {formatCurrency(product.offerPrice)}
                            </span>
                          </div>
                          <span
                            className={`text-[10px] sm:text-[11px] font-semibold px-2 py-1 rounded-md transition-colors ${
                              isSelected
                                ? "bg-emerald-700 text-white"
                                : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 group-hover:bg-slate-200 dark:group-hover:bg-slate-700"
                            }`}
                          >
                            {isSelected ? "নির্বাচিত ✓" : "সিলেক্ট"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* 4. PROGRESSIVE SINGLE-PAGE COD CHECKOUT SECTION */}
              {selectedProduct && (
                <section
                  ref={checkoutSectionRef}
                  className="space-y-4 pt-2"
                >
                  <div className="flex items-center gap-2 pb-1 border-b border-slate-200/80 dark:border-slate-800">
                    <div className="w-6 h-6 rounded-md bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-400 flex items-center justify-center text-xs font-bold">
                      ২
                    </div>
                    <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                      অর্ডার ও ডেলিভারি বিবরণ
                    </h2>
                  </div>

                  {/* 2-Column Responsive Layout on Desktop */}
                  <form onSubmit={handleSubmitOrder} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    {/* LEFT COLUMN: Customer Information & Options (7 Columns on LG) */}
                    <div className="lg:col-span-7 bg-white dark:bg-[#131c2e] rounded-2xl border border-slate-200/90 dark:border-slate-800 p-4 sm:p-6 space-y-5 shadow-xs">
                      {/* Active Model Snapshot Card */}
                      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex items-center gap-3">
                        <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-lg overflow-hidden bg-slate-200 dark:bg-slate-800 shrink-0 border border-slate-200 dark:border-slate-700">
                          <Image
                            src={activeImage || selectedProduct.image}
                            alt={selectedProduct.name}
                            fill
                            unoptimized
                            className="object-cover"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider block">
                            নির্বাচিত প্রোডাক্ট
                          </span>
                          <h4 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base truncate">
                            {selectedProduct.name}
                          </h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            ইউনিট মূল্য: <span className="font-semibold text-slate-800 dark:text-slate-200">{formatCurrency(unitPrice)}</span>
                          </p>
                        </div>
                      </div>

                      {/* Variant Selectors (Phase 4: Colors/Flavors and Sizes with Price & Stock Support) */}
                      {(selectedProduct.colors.length > 0 || selectedProduct.sizes.length > 0) && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                          {selectedProduct.colors.length > 0 && (
                            <div className="space-y-1.5">
                              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                                ফ্লেভার / কালার নির্বাচন করুন *
                              </label>
                              <select
                                value={selectedColorId ?? ""}
                                onChange={(e) => setSelectedColorId(Number(e.target.value))}
                                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-base sm:text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none transition-shadow cursor-pointer"
                              >
                                {selectedProduct.colors.map((c) => (
                                  <option key={c.id} value={c.id} disabled={c.stock_qty !== undefined && c.stock_qty <= 0}>
                                    {c.name} {c.price && c.price !== selectedProduct.offerPrice ? `(${formatCurrency(c.price)})` : ""} {c.stock_qty !== undefined && c.stock_qty <= 0 ? "(স্টক শেষ)" : ""}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}

                          {selectedProduct.sizes.length > 0 && (
                            <div className="space-y-1.5">
                              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                                সাইজ / অপশন নির্বাচন করুন *
                              </label>
                              <select
                                value={selectedSizeId ?? ""}
                                onChange={(e) => setSelectedSizeId(Number(e.target.value))}
                                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-base sm:text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none transition-shadow cursor-pointer"
                              >
                                {selectedProduct.sizes.map((s) => (
                                  <option key={s.id} value={s.id} disabled={s.stock_qty !== undefined && s.stock_qty <= 0}>
                                    {s.name} {s.price && s.price !== selectedProduct.offerPrice ? `(${formatCurrency(s.price)})` : ""} {s.stock_qty !== undefined && s.stock_qty <= 0 ? "(স্টক শেষ)" : ""}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Quantity Stepper */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                          পরিমাণ (Quantity)
                        </label>
                        <div className="flex items-center gap-3">
                          <div className="inline-flex items-center rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-1">
                            <button
                              type="button"
                              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                              className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 active:scale-95 transition-all cursor-pointer"
                              aria-label="Decrease quantity"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <span className="w-12 text-center font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                              {toBengaliNumerals(quantity)}
                            </span>
                            <button
                              type="button"
                              onClick={() => setQuantity((q) => q + 1)}
                              className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 active:scale-95 transition-all cursor-pointer"
                              aria-label="Increase quantity"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            {quantity > 1 ? `মোট ${toBengaliNumerals(quantity)} টি পণ্য` : "১ টি পণ্য"}
                          </span>
                        </div>
                      </div>

                      {/* Delivery Zone Selection (Interactive Cards - Mandatory, defaults to none) */}
                      <div id="delivery-area-selector" className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                            ডেলিভারি এলাকা নির্বাচন করুন *
                          </label>
                          {!selectedAreaId && (
                            <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                              (বাধ্যতামূলক — নির্বাচন করুন)
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {activeShippingAreas.map((area) => {
                            const isAreaActive = selectedAreaId === String(area.id);
                            return (
                              <div
                                key={area.id}
                                onClick={() => {
                                  setSelectedAreaId(String(area.id));
                                  if (errorMessage?.includes("ডেলিভারি এলাকা")) {
                                    setErrorMessage(null);
                                  }
                                }}
                                className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-between ${
                                  isAreaActive
                                    ? "border-emerald-600 dark:border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 shadow-xs ring-1 ring-emerald-500/20"
                                    : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/40 hover:border-slate-300 dark:hover:border-slate-600"
                                }`}
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div
                                    className={`w-4 h-4 rounded-full flex items-center justify-center border-2 shrink-0 ${
                                      isAreaActive
                                        ? "border-emerald-600 bg-emerald-600 text-white"
                                        : "border-slate-300 dark:border-slate-600 bg-transparent"
                                    }`}
                                  >
                                    {isAreaActive && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                                  </div>
                                  <div>
                                    <span className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 block truncate">
                                      {area.name}
                                    </span>
                                    <span className="text-[10px] text-slate-500 dark:text-slate-400">
                                      {String(area.id) === "11" || /inside/i.test(area.name) ? "২৪-৪৮ ঘণ্টার মধ্যে" : "৪৮-৭২ ঘণ্টার মধ্যে"}
                                    </span>
                                  </div>
                                </div>
                                <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white shrink-0">
                                  {formatCurrency(area.amount)}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Customer Details Inputs */}
                      <div className="space-y-3.5 pt-1 border-t border-slate-100 dark:border-slate-800">
                        <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                          <User className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                          গ্রাহকের তথ্য
                        </h3>

                        {/* Name Input */}
                        <div className="space-y-1.5">
                          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                            আপনার পূর্ণ নাম *
                          </label>
                          <input
                            type="text"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="যেমন: মোঃ সাকিব হাসান"
                            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 text-base sm:text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none transition-shadow"
                          />
                        </div>

                        {/* Phone with BD validation */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                              মোবাইল নম্বর *
                            </label>
                            {phoneTouched && (
                              <span
                                className={`text-[11px] font-medium flex items-center gap-1 ${
                                  isPhoneValid ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500"
                                }`}
                              >
                                {isPhoneValid ? (
                                  <>
                                    <Check className="w-3 h-3" /> সঠিক মোবাইল নম্বর
                                  </>
                                ) : (
                                  <>
                                    <AlertCircle className="w-3 h-3" /> ১১ ডিজিট লিখুন (01XXXXXXXXX)
                                  </>
                                )}
                              </span>
                            )}
                          </div>
                          <input
                            type="tel"
                            inputMode="numeric"
                            required
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            onBlur={handleLeadCapture}
                            placeholder="01XXXXXXXXX"
                            maxLength={11}
                            className={`w-full px-3.5 py-2.5 rounded-xl border bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 text-base sm:text-sm focus:ring-2 focus:outline-none transition-shadow ${
                              phoneTouched && !isPhoneValid
                                ? "border-rose-400 focus:ring-rose-500/50"
                                : "border-slate-300 dark:border-slate-700 focus:ring-emerald-500"
                            }`}
                          />
                        </div>

                        {/* Address Textarea */}
                        <div className="space-y-1.5">
                          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                            সম্পূর্ণ ডেলিভারি ঠিকানা *
                          </label>
                          <textarea
                            required
                            rows={2}
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                            onBlur={handleLeadCapture}
                            placeholder="বাসা নং, রোড নং, এলাকা, থানা ও জেলা"
                            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 text-base sm:text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none transition-shadow resize-none"
                          />
                        </div>

                        {/* Optional Order Note */}
                        <div className="space-y-1.5">
                          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                            অর্ডার নোট (ঐচ্ছিক)
                          </label>
                          <input
                            type="text"
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="ডেলিভারি সংক্রান্ত কোনো বিশেষ নির্দেশনা থাকলে লিখুন"
                            className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 text-base sm:text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none transition-shadow"
                          />
                        </div>
                      </div>
                    </div>

                    {/* RIGHT COLUMN: Order Summary & Confirmation (5 Columns on LG - Sticky) */}
                    <div className="lg:col-span-5 space-y-4 lg:sticky lg:top-20">
                      <div className="bg-white dark:bg-[#131c2e] rounded-2xl border border-slate-200/90 dark:border-slate-800 p-4 sm:p-5 shadow-xs space-y-4">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                          <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white flex items-center gap-1.5">
                            <Layers className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                            অর্ডার সামারি
                          </h3>
                          <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 font-semibold border border-emerald-200 dark:border-emerald-800/60">
                            ক্যাশ অন ডেলিভারি
                          </span>
                        </div>

                        {/* Item Details */}
                        <div className="space-y-3 text-xs sm:text-sm">
                          <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                            <div>
                              <span className="font-semibold text-slate-900 dark:text-white block truncate max-w-[200px]">
                                {selectedProduct.name}
                              </span>
                              <span className="text-slate-500 dark:text-slate-400 text-xs">
                                {formatCurrency(unitPrice)} × {toBengaliNumerals(quantity)}
                              </span>
                            </div>
                            <span className="font-semibold text-slate-900 dark:text-white">
                              {formatCurrency(subtotal)}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-slate-700 dark:text-slate-300 pt-2 border-t border-slate-100 dark:border-slate-800">
                            <span>ডেলিভারি চার্জ {activeShippingArea ? `(${activeShippingArea.name})` : ""}</span>
                            <span className="font-semibold text-slate-900 dark:text-white">
                              {activeShippingArea ? formatCurrency(shippingCost) : (
                                <span className="text-amber-600 dark:text-amber-400 text-xs font-medium">এলাকা নির্বাচন করুন</span>
                              )}
                            </span>
                          </div>

                          {discountAmount > 0 && (
                            <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400 font-semibold pt-2 border-t border-slate-100 dark:border-slate-800">
                              <span>কুপন ডিসকাউন্ট {appliedCoupon ? `(${appliedCoupon})` : ""}</span>
                              <span>-{formatCurrency(discountAmount)}</span>
                            </div>
                          )}

                          {/* Total Payable */}
                          <div className="pt-3 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">
                                সর্বমোট প্রদেয়:
                              </span>
                              {isCalculating && (
                                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                              )}
                            </div>
                            <span className="font-extrabold text-xl sm:text-2xl text-emerald-700 dark:text-emerald-400">
                              {formatCurrency(totalPayable)}
                            </span>
                          </div>

                          {/* Optional Coupon Code Box */}
                          <div className="pt-2">
                            {!appliedCoupon ? (
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={couponInput}
                                  onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                                  placeholder="কুপন কোড (যদি থাকে)"
                                  className="flex-1 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500 focus:outline-none uppercase"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (couponInput.trim()) {
                                      setAppliedCoupon(couponInput.trim());
                                      setCouponFeedback(null);
                                    }
                                  }}
                                  disabled={!couponInput.trim() || isCalculating}
                                  className="px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-slate-200 text-white dark:text-slate-900 text-xs font-semibold disabled:opacity-50 transition-colors cursor-pointer"
                                >
                                  {isCalculating ? "যাচাই..." : "প্রয়োগ"}
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs">
                                <span className="font-semibold text-emerald-800 dark:text-emerald-300">
                                  প্রযুক্ত কুপন: <span className="font-mono">{appliedCoupon}</span>
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setAppliedCoupon("");
                                    setCouponInput("");
                                    setCouponFeedback(null);
                                  }}
                                  className="text-rose-600 dark:text-rose-400 hover:underline font-medium text-[11px] cursor-pointer"
                                >
                                  মুছে ফেলুন
                                </button>
                              </div>
                            )}
                            {couponFeedback && (
                              <p className={`text-[11px] mt-1 font-medium ${couponFeedback.type === "success" ? "text-emerald-700 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                                {couponFeedback.text}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Error Notice */}
                        {errorMessage && (
                          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs sm:text-sm flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>{errorMessage}</span>
                          </div>
                        )}

                        {/* Primary Order Submission Button */}
                        <button
                          type="submit"
                          disabled={isSubmitting}
                          className="w-full py-3.5 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 active:scale-[0.99] text-white font-bold text-base shadow-sm hover:shadow-md transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-75 disabled:cursor-not-allowed cursor-pointer"
                        >
                          {isSubmitting ? (
                            <>
                              <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              <span>অর্ডার প্রসেস হচ্ছে...</span>
                            </>
                          ) : (
                            <span>অর্ডার কনফার্ম করুন ({formatCurrency(totalPayable)})</span>
                          )}
                        </button>

                        {/* Genuine Reassurance */}
                        <div className="space-y-2 pt-1 text-[11px] text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800">
                          <p className="flex items-center gap-1.5">
                            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            <span>কোন অগ্রিম টাকা দিতে হবে না।</span>
                          </p>
                          <p className="flex items-center gap-1.5">
                            <Package className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            <span>পণ্য হাতে পেয়ে দেখে টাকা পরিশোধ করবেন।</span>
                          </p>
                        </div>
                      </div>

                      {/* Helpline Card */}
                      <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 flex items-center gap-3 text-xs text-slate-700 dark:text-slate-300">
                        <PhoneCall className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" />
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-white">অর্ডারে সহায়তা প্রয়োজন?</p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">কল করুন আমাদের হেল্পলাইনে</p>
                        </div>
                      </div>
                    </div>
                  </form>
                </section>
              )}

              {/* 5. FREQUENTLY ASKED QUESTIONS (FAQ) */}
              <section className="bg-white dark:bg-[#131c2e] rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 sm:p-6 space-y-3 shadow-xs">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                  <HelpCircle className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
                  <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                    সাধারণ কিছু প্রশ্ন ও উত্তর (FAQ)
                  </h3>
                </div>

                <div className="space-y-2 pt-1">
                  {[
                    {
                      q: "আমি কি পণ্য হাতে পেয়ে দেখে টাকা দিতে পারব?",
                      a: "হ্যাঁ, সম্পূর্ণ নিশ্চিন্তে। ডেলিভারি প্রতিনিধির উপস্থিতিতে পার্সেল চেক করে তারপর মূল্য পরিশোধ করতে পারবেন। কোন অগ্রিম পেমেন্টের প্রয়োজন নেই।",
                    },
                    {
                      q: "ডেলিভারি পেতে কতদিন সময় লাগবে?",
                      a: "ঢাকার ভেতরে সাধারণত ২৪ ঘণ্টার মধ্যে এবং ঢাকার বাইরে ৪৮ থেকে ৭২ ঘণ্টার মধ্যে ডেলিভারি সম্পন্ন হয়।",
                    },
                    {
                      q: "পণ্যটিতে কোনো সমস্যা থাকলে কী করব?",
                      a: "পণ্য হাতে পাওয়ার পর কোনো ত্রুটি দেখা দিলে সরাসরি আমাদের হেল্পলাইনে যোগাযোগ করুন। আমরা দ্রুত রিপ্লেসমেন্টের ব্যবস্থা করব।",
                    },
                  ].map((faq, index) => {
                    const isOpen = activeFaq === index;
                    return (
                      <div
                        key={index}
                        className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden"
                      >
                        <button
                          type="button"
                          onClick={() => setActiveFaq(isOpen ? null : index)}
                          className="w-full p-3.5 text-left font-semibold text-xs sm:text-sm text-slate-800 dark:text-slate-200 flex items-center justify-between gap-2 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                        >
                          <span>{faq.q}</span>
                          <ChevronDown
                            className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${
                              isOpen ? "rotate-180" : ""
                            }`}
                          />
                        </button>
                        {isOpen && (
                          <div className="px-3.5 pb-3.5 pt-1 text-xs text-slate-600 dark:text-slate-400 bg-slate-50/50 dark:bg-slate-900/30 border-t border-slate-100 dark:border-slate-800 leading-relaxed">
                            {faq.a}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            </>
          )}
        </AnimatePresence>
      </main>

      {/* 6. MOBILE FLOATING QUICK-ORDER BAR (Discreet & Non-Intrusive) */}
      <AnimatePresence>
        {showFloatingBar && !orderSuccess && selectedProduct && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#111827]/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 p-3 sm:hidden shadow-lg"
          >
            <div className="flex items-center justify-between gap-3 max-w-lg mx-auto">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0 border border-slate-200 dark:border-slate-700">
                  <Image src={selectedProduct.image} alt="Thumb" fill unoptimized className="object-cover" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    {selectedProduct.name}
                  </p>
                  <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                    {formatCurrency(totalPayable)}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={scrollToCheckout}
                className="shrink-0 py-2.5 px-4 rounded-xl bg-emerald-700 text-white font-bold text-xs shadow-xs flex items-center gap-1 active:scale-95 transition-all cursor-pointer"
              >
                <span>অর্ডার করুন</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 7. CLEAN PROFESSIONAL FOOTER */}
      <footer className="max-w-7xl mx-auto px-4 sm:px-6 pt-10 pb-6 text-center border-t border-slate-200 dark:border-slate-800/80 mt-12 space-y-2 text-xs text-slate-500 dark:text-slate-400">
        <p>© {new Date().getFullYear()} Inhaliq. সর্বস্বত্ব সংরক্ষিত।</p>
        <p className="text-[11px] text-slate-400 dark:text-slate-500">
          সারা বাংলাদেশে ১০০% ক্যাশ অন ডেলিভারি এবং জেনুইন কোয়ালিটি সেবা।
        </p>
      </footer>
    </div>
  );
}

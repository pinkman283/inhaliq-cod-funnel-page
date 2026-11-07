"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { motion } from "framer-motion";

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="w-14 h-7.5 rounded-full bg-slate-200 dark:bg-slate-800 animate-pulse" />
    );
  }

  const isDark = resolvedTheme === "dark" || theme === "dark";

  const handleToggle = () => {
    setTheme(isDark ? "light" : "dark");
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        role="switch"
        aria-checked={isDark}
        aria-label="Switch theme mode between light and dark"
        title={isDark ? "লাইট থিমে পরিবর্তন করুন" : "ডার্ক থিমে পরিবর্তন করুন"}
        onClick={handleToggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleToggle();
          }
        }}
        className={`relative inline-flex h-7 w-13 shrink-0 cursor-pointer items-center rounded-full p-0.5 transition-colors duration-250 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 select-none ${
          isDark
            ? "bg-slate-800 border border-slate-700/80 shadow-inner"
            : "bg-slate-200/90 border border-slate-300/80 shadow-inner"
        }`}
      >
        {/* Static Background Icons for Orientation */}
        <div className="absolute inset-0 flex items-center justify-between px-1.5 text-slate-400 dark:text-slate-500 pointer-events-none">
          <Sun className={`w-3.5 h-3.5 transition-opacity duration-200 ${isDark ? "opacity-30" : "opacity-0"}`} />
          <Moon className={`w-3.5 h-3.5 transition-opacity duration-200 ${isDark ? "opacity-0" : "opacity-40"}`} />
        </div>

        {/* Sliding Thumb */}
        <motion.span
          layout
          transition={{ type: "spring", stiffness: 500, damping: 32 }}
          className={`relative z-10 flex h-6 w-6 items-center justify-center rounded-full shadow-sm transition-colors duration-200 ${
            isDark
              ? "translate-x-6 bg-slate-900 text-amber-300 border border-slate-700 shadow-md"
              : "translate-x-0 bg-white text-amber-500 border border-slate-200/80 shadow-md"
          }`}
        >
          {isDark ? (
            <Moon className="w-3.5 h-3.5 fill-amber-300/20" />
          ) : (
            <Sun className="w-3.5 h-3.5 fill-amber-400/20" />
          )}
        </motion.span>
      </button>
    </div>
  );
}

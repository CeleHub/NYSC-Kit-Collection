"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ShieldCheck, Menu, X, User, Building2, Lock, Sparkles } from "lucide-react";

interface NavbarProps {
  userRole?: string;
  userName?: string;
  stateCode?: string;
  platoon?: number;
  onLogout?: () => void;
}

export default function Navbar({
  userRole,
  userName,
  stateCode,
  platoon,
  onLogout,
}: NavbarProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { label: "Corps Member", href: "/" },
    { label: "Platoon Inspector", href: "/inspector" },
    { label: "Secretariat", href: "/secretariat" },
    { label: "Camp Admin", href: "/admin" },
  ];

  return (
    <header className="sticky top-0 z-40 w-full bg-[#0a1811]/95 backdrop-blur-md border-b border-[#1e382b]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          {/* Logo & Brand matching official portal */}
          <Link href="/" className="flex items-center gap-3 group">
            {/* White pill banner matching portal.nysc.org.ng */}
            <div className="bg-white px-3 py-1.5 rounded-full flex items-center gap-2 shadow-md border border-slate-200 group-hover:shadow-green-500/20 transition-all">
              <img
                src="/assets/NYSC_LOGO.svg"
                alt="NYSC Crest"
                width={36}
                height={36}
                className="w-8 h-8 sm:w-9 sm:h-9 object-contain shrink-0"
              />
              <div className="flex flex-col">
                <span className="text-[10px] sm:text-xs font-black tracking-wider text-[#008751] uppercase leading-tight font-serif">
                  National Youth Service Corps
                </span>
                <span className="text-[8px] sm:text-[9px] font-bold tracking-widest text-[#842029] uppercase leading-none">
                  • Service and Humility •
                </span>
              </div>
            </div>
            <span className="hidden xl:inline-block px-2.5 py-1 text-xs font-medium rounded-full bg-[#12271c] text-emerald-400 border border-emerald-800/40">
              Kit Portal
            </span>
          </Link>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-1.5">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                    isActive
                      ? "bg-[#008751] text-white shadow-sm shadow-green-900/50"
                      : "text-slate-300 hover:text-white hover:bg-[#12271c]"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* User Session Info / Badges */}
          <div className="hidden lg:flex items-center gap-3">
            {userRole ? (
              <div className="flex items-center gap-2.5 bg-[#12271c] px-3.5 py-1.5 rounded-xl border border-[#1e382b]">
                <div className="w-8 h-8 rounded-full bg-[#008751]/20 flex items-center justify-center text-emerald-400 font-bold text-xs border border-[#008751]/40">
                  {platoon ? `P${platoon}` : <User className="w-4 h-4" />}
                </div>
                <div className="text-left">
                  <div className="text-xs font-bold text-white leading-tight">
                    {userName || stateCode || userRole}
                  </div>
                  <div className="text-[10px] text-emerald-400 font-medium">
                    {userRole === "CORPS_MEMBER"
                      ? `Platoon ${platoon}`
                      : userRole === "PLATOON_INSPECTOR"
                      ? `Inspector P${platoon}`
                      : userRole}
                  </div>
                </div>
                {onLogout && (
                  <button
                    onClick={onLogout}
                    className="ml-2 text-[11px] text-slate-400 hover:text-red-400 px-2 py-1 rounded bg-black/30 border border-slate-700/50"
                  >
                    Exit
                  </button>
                )}
              </div>
            ) : (
              <div className="text-right">
                <div className="text-[11px] text-slate-400">Orientation Camp</div>
                <div className="text-xs font-semibold text-emerald-400">Batch C, 2026</div>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center gap-2">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg bg-[#12271c] text-slate-200 border border-[#1e382b] focus:outline-none"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-[#0c1a13] border-b border-[#1e382b] px-4 pt-2 pb-4 space-y-1">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-3 py-2.5 rounded-lg text-sm font-semibold ${
                  isActive
                    ? "bg-[#008751] text-white"
                    : "text-slate-300 hover:bg-[#12271c] hover:text-white"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
          {onLogout && (
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                onLogout();
              }}
              className="w-full text-left px-3 py-2 text-sm text-red-400 font-semibold hover:bg-red-950/20 rounded-lg mt-2"
            >
              Log Out
            </button>
          )}
        </div>
      )}
    </header>
  );
}

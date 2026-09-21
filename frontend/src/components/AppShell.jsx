import { NavLink, Outlet } from "react-router-dom";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { motion } from "motion/react";
import { Plant, Storefront, MagnifyingGlass } from "@phosphor-icons/react";

const NAV = [
  { to: "/", label: "Farmer", icon: Plant },
  { to: "/buyer", label: "Buyer", icon: Storefront },
  { to: "/ledger", label: "Public ledger", icon: MagnifyingGlass },
];

export function AppShell() {
  return (
    <div className="grain min-h-[100dvh] bg-paper">
      <Header />
      <main className="mx-auto w-full max-w-[1400px] px-4 pb-24 pt-8 md:px-8 md:pt-12 lg:px-12">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-ink-200/60 bg-paper/85 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-[1400px] items-center justify-between gap-4 px-4 py-3 md:px-8 lg:px-12">
        <div className="flex items-baseline gap-3">
          <NavLink to="/" className="flex items-center gap-2.5">
            <Mark />
            <span className="text-[15px] font-semibold tracking-tight text-ink-950">VeriPanen</span>
          </NavLink>
          <span className="hidden font-mono text-[11px] uppercase tracking-[0.14em] text-ink-400 sm:inline">
            bnb testnet · 97
          </span>
        </div>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                [
                  "relative flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors duration-200",
                  isActive ? "text-ink-950" : "text-ink-500 hover:text-ink-800",
                ].join(" ")
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span
                      layoutId="nav-pill"
                      className="absolute inset-0 -z-10 rounded-lg bg-ink-100"
                      transition={{ type: "spring", stiffness: 320, damping: 30 }}
                    />
                  )}
                  <Icon size={16} weight={isActive ? "fill" : "regular"} />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <ConnectButton
            chainStatus="icon"
            accountStatus={{ smallScreen: "avatar", largeScreen: "full" }}
            showBalance={false}
          />
        </div>
      </div>

      <MobileNav />
    </header>
  );
}

function MobileNav() {
  return (
    <div className="border-t border-ink-200/60 bg-paper md:hidden">
      <div className="flex items-center gap-1 px-3 py-1.5">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              [
                "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-[12px] font-medium transition-colors",
                isActive ? "bg-ink-100 text-ink-950" : "text-ink-500",
              ].join(" ")
            }
          >
            <Icon size={15} />
            {label}
          </NavLink>
        ))}
      </div>
    </div>
  );
}

function Mark() {
  return (
    <span className="grid size-7 place-items-center rounded-lg bg-ink-950">
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path
          d="M8 14V6.5M8 6.5C8 4 6.4 2 4 2c0 2.6 1.6 4.5 4 4.5ZM8 6.5C8 4.4 9.4 2.6 11.6 2.6c0 2.2-1.4 3.9-3.6 3.9Z"
          stroke="#4bb07b"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

function Footer() {
  return (
    <footer className="border-t border-ink-200/60">
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-4 px-4 py-8 text-[12px] text-ink-500 md:flex-row md:items-center md:justify-between md:px-8 lg:px-12">
        <p className="max-w-[52ch] leading-relaxed">
          AI produces a standardized automated assessment. The on-chain record makes that result
          persistent and auditable. It does not make the AI correct.
        </p>
        <span className="font-mono uppercase tracking-[0.12em] text-ink-400">
          #WhereBuildersBuild
        </span>
      </div>
    </footer>
  );
}

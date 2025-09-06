import { Authenticated, Unauthenticated, useConvexAuth } from "convex/react";
import { SignInForm } from "./SignInForm";
import { SignOutButton } from "./SignOutButton";
import { Toaster, toast } from "sonner";
import { useEffect, useState } from "react";
import Gallery from "./Gallery";
import Blog from "./Blog";
import { About } from "./About";
import { Profile } from "./Profile";
import BackgroundVideo from "./components/BackgroundVideo";
import ActionButtons from "./components/ActionButtons";

export default function App() {
  const [currentPage, setCurrentPage] = useState<"profile" | "gallery" | "blog" | "about">("profile");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { isAuthenticated } = useConvexAuth();

  // Close mobile menu on route/page change (defensive in case navigation occurs elsewhere)
  useEffect(() => {
    setIsMenuOpen(false);
  }, [currentPage]);

  // Disable background scroll while the slide-in menu is open (avoid scroll lock inconsistencies)
  useEffect(() => {
    const body = document.body;
    const prev = body.style.overflow;
    if (isMenuOpen) {
      body.style.overflow = "hidden";
    } else {
      body.style.overflow = prev || "";
    }
    return () => {
      body.style.overflow = prev || "";
    };
  }, [isMenuOpen]);

  // Allow closing the menu with Escape key
  useEffect(() => {
    if (!isMenuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isMenuOpen]);

  // Skip to main content handler
  const skipToMain = () => {
    const mainContent = document.querySelector('main');
    if (mainContent) {
      mainContent.focus();
      mainContent.scrollIntoView({ behavior: 'smooth' });
    }
  };
   
  // Left-side pills in header
  const menuItems = [
    { id: "gallery" as const, label: "Timeline" },
    { id: "blog" as const, label: "Messages" },
    { id: "about" as const, label: "About" },
  ];

  // Lightweight welcome-back toast after auth (once per tab session)
  useEffect(() => {
    if (!isAuthenticated) return;
    try {
      if (!sessionStorage.getItem("ep:welcomedBack")) {
        toast("Welcome back! Visit Messages to share.", {
          action: {
            label: "Open Messages",
            onClick: () => setCurrentPage("blog"),
          },
        });
        sessionStorage.setItem("ep:welcomedBack", "1");
      }
    } catch {
      // non-blocking
    }
  }, [isAuthenticated]);

  return (
    <>
      {/* Skip to main content link for accessibility */}
      <a
        href="#main-content"
        onClick={skipToMain}
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 glassmorphic-btn px-4 py-2 text-sm font-medium rounded-lg"
      >
        Skip to main content
      </a>

      <BackgroundVideo />
      <div className="relative z-[10] min-h-screen flex flex-col bg-transparent">
        <header className="sticky top-0 z-10 glass-elevated glass-3d text-contrast p-6 mx-4 mt-4 rounded-2xl" role="banner">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <img src="/logo2.png" alt="Emerald Palace" className="w-10 h-10" />
              <h2 className="text-3xl font-semibold">Emerald Palace</h2>
            </div>
            {/* Desktop/Tablet nav - direct links */}
            <nav className="hidden md:flex gap-2 items-center" role="navigation" aria-label="Main navigation">
              {menuItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setCurrentPage(item.id)}
                  className={`ep-btn ${currentPage === item.id ? "ep-btn--pink" : ""}`}
                  aria-current={currentPage === item.id ? "page" : undefined}
                  aria-describedby={`${item.id}-description`}
                  title={`Navigate to ${item.label} page`}
                >
                  {item.label}
                  <span id={`${item.id}-description`} className="sr-only">
                    {item.id === "gallery" && "View and explore your timeline of memories"}
                    {item.id === "blog" && "Open Messages to write notes to Emily and read what others have shared"}
                    {item.id === "about" && "Learn more about Emerald Palace"}
                  </span>
                </button>
              ))}
            </nav>
            {/* Spacer pushes user icon to far right */}
            <div className="ml-auto hidden md:flex items-center gap-3">
              <button
                onClick={() => setCurrentPage("profile")}
                className={`ep-btn ${currentPage === "profile" ? "ep-btn--pink" : ""}`}
                aria-current={currentPage === "profile" ? "page" : undefined}
                title="Go to your profile"
              >
                👤 Profile
              </button>
            </div>
            {/* Hamburger button - only on mobile */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="md:hidden ml-auto p-3 hover:bg-white/10 rounded-lg flex items-center gap-2 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-white/30"
              aria-label={isMenuOpen ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={isMenuOpen}
              aria-controls="mobile-navigation"
              title={isMenuOpen ? "Close menu" : "Open menu"}
            >
              <span className="sr-only">{isMenuOpen ? "Close" : "Open"} menu</span>
              <span className="text-sm font-medium">Menu</span>
              <div className="w-6 h-5 relative flex flex-col justify-between" aria-hidden="true">
                <span className={`block h-0.5 w-full bg-current transform transition-transform duration-200 ${isMenuOpen ? "rotate-45 translate-y-2" : ""}`} />
                <span className={`block h-0.5 w-full bg-current transition-opacity duration-200 ${isMenuOpen ? "opacity-0" : ""}`} />
                <span className={`block h-0.5 w-full bg-current transform transition-transform duration-200 ${isMenuOpen ? "-rotate-45 -translate-y-2" : ""}`} />
              </div>
            </button>
          </div>

          {/* Mobile slide-in menu */}
          {isMenuOpen && (
            <>
            {/* Backdrop – click to close */}
            <button
              type="button"
              aria-label="Close menu backdrop"
              className="ep-slide-overlay md:hidden"
              onClick={() => setIsMenuOpen(false)}
            />
            <nav
              id="mobile-navigation"
              className="ep-slide-menu open md:hidden"
              role="dialog"
              aria-modal="true"
              aria-label="Mobile navigation menu"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="font-semibold">Menu</div>
                <button
                  type="button"
                  className="ep-btn"
                  onClick={() => setIsMenuOpen(false)}
                  aria-label="Close menu"
                >
                  Close
                </button>
              </div>
              {menuItems.map((item, index) => (
                <button
                  key={item.id}
                  onClick={() => { setCurrentPage(item.id); setIsMenuOpen(false); }}
                  className="ep-btn ep-btn--pink ep-menu-link"
                  aria-current={currentPage === item.id ? "page" : undefined}
                  autoFocus={index === 0}
                >
                  {item.label}
                </button>
              ))}
              <div className="mt-4">
                <button
                  onClick={() => { setCurrentPage("profile"); setIsMenuOpen(false); }}
                  className="ep-btn ep-btn--pink ep-menu-link"
                  aria-current={currentPage === "profile" ? "page" : undefined}
                >
                  👤 Profile
                </button>
              </div>
            </nav>
            </>
          )}
        </header>

        <main id="main-content" className="flex-1 p-6 mx-4 mb-4" role="main" tabIndex={-1}>
          <Unauthenticated>
            <div className="max-w-md mx-auto glass-elevated glass-3d rounded-2xl border border-white/20 p-6 text-contrast" role="region" aria-labelledby="welcome-heading">
               <div className="flex justify-center mb-8">
                 <img src="/logo2.png" alt="Emerald Palace logo" className="w-20 h-20" />
               </div>
               <h1 id="welcome-heading" className="text-4xl font-bold text-center mb-8 text-contrast">Welcome to Emerald Palace</h1>
               <p className="text-center text-white/90 text-contrast-shadow mb-8" role="status" aria-live="polite">
                 <span className="sr-only">Welcome message: </span>
                 Save your profile by signing up with an email and make a password. Otherwise, sign in anonymously without an email.
                 <span className="sr-only">Use the form below to get started.</span>
               </p>
               <SignInForm />
             </div>
          </Unauthenticated>
          
          <Authenticated>
            {/* Page-specific help text for screen readers */}
            <div className="sr-only" aria-live="polite" aria-atomic="true">
              {currentPage === "profile" && "Profile page: View and manage your personal information and settings."}
              {currentPage === "gallery" && "Timeline page: Explore and manage your media collection and memories."}
              {currentPage === "blog" && "Messages page: Send messages to Emily and read what others have shared."}
              {currentPage === "about" && "About page: Learn more about Emerald Palace and how to use it."}
            </div>

            {currentPage === "profile" && <Profile />}
            {currentPage === "gallery" && <Gallery />}
            {currentPage === "blog" && <Blog />}
            {currentPage === "about" && <About />}
          </Authenticated>
        </main>
        <ActionButtons />
        <Toaster />
      </div>
    </>
  );
}

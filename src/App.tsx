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
   
  // Left-side pills in header
  const menuItems = [
    { id: "gallery" as const, label: "Timeline" },
    { id: "blog" as const, label: "Forum" },
    { id: "about" as const, label: "About" },
  ];

  // Lightweight welcome-back toast after auth (once per tab session)
  useEffect(() => {
    if (!isAuthenticated) return;
    try {
      if (!sessionStorage.getItem("ep:welcomedBack")) {
        toast("Welcome back! Visit the Forum to share.", {
          action: {
            label: "Open Forum",
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
      <BackgroundVideo />
      <div className="relative z-[1] min-h-screen flex flex-col bg-transparent">
        <header className="sticky top-0 z-10 glass-elevated glass-3d text-contrast p-6 mx-4 mt-4 rounded-2xl">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <img src="/logo.svg" alt="Emerald Palace" className="w-10 h-10" />
              <h2 className="text-3xl font-semibold">Emerald Palace</h2>
            </div>
            {/* Desktop navigation - left side */}
            <nav className="hidden @[600px]:flex gap-2 items-center">
              {menuItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setCurrentPage(item.id)}
                  className={`pill-link ${currentPage === item.id ? "bg-white/20" : ""}`}
                >
                  {item.label}
                </button>
              ))}
            </nav>
            {/* Spacer pushes sign out + hamburger to far right */}
            <div className="ml-auto hidden @[600px]:flex items-center gap-3">
              <SignOutButton />
            </div>
            {/* Hamburger button - only visible below 600px */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="@[600px]:hidden ml-auto p-2 hover:bg-white/10 rounded flex items-center gap-2"
              aria-label="Toggle menu"
              aria-expanded={isMenuOpen}
              aria-controls="mobile-navigation"
            >
              <span>Menu</span>
              <div className="w-6 h-5 relative flex flex-col justify-between">
                <span className={`block h-0.5 w-full bg-white transform transition-transform ${isMenuOpen ? "rotate-45 translate-y-2" : ""}`} />
                <span className={`block h-0.5 w-full bg-white transition-opacity ${isMenuOpen ? "opacity-0" : ""}`} />
                <span className={`block h-0.5 w-full bg-white transform transition-transform ${isMenuOpen ? "-rotate-45 -translate-y-2" : ""}`} />
              </div>
            </button>
          </div>

          {/* Mobile navigation - only visible below 600px when menu is open */}
          <nav
            id="mobile-navigation"
            className={`${isMenuOpen ? "flex" : "hidden"} @[600px]:hidden flex-col gap-2 mt-4 glass-elevated glass-3d rounded-xl p-3 border border-white/20`}
          >
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setCurrentPage(item.id);
                  setIsMenuOpen(false);
                }}
                className={`pill-link ${currentPage === item.id ? "bg-white/20" : ""}`}
              >
                {item.label}
              </button>
            ))}
            <div className="pt-2 mt-2 border-t border-white/15">
              <div className="px-1 py-2">
                <SignOutButton />
              </div>
            </div>
          </nav>
        </header>

        <main className="flex-1 p-6 mx-4 mb-4">
          <Unauthenticated>
            <div className="max-w-md mx-auto glass-elevated glass-3d rounded-2xl border border-white/20 p-6 text-contrast">
               <div className="flex justify-center mb-8">
                 <img src="/logo.svg" alt="Emerald Palace" className="w-20 h-20" />
               </div>
               <h1 className="text-4xl font-bold text-center mb-8 text-contrast">Welcome to Emerald Palace</h1>
               <p className="text-center text-white/90 text-contrast-shadow mb-8">
                 Save your profile by signing up with an email and make a password. Otherwise, sign in anonymously without an email.
               </p>
               <SignInForm />
             </div>
          </Unauthenticated>
          
          <Authenticated>
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

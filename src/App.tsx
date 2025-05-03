import { Authenticated, Unauthenticated, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { SignInForm } from "./SignInForm";
import { SignOutButton } from "./SignOutButton";
import { Toaster } from "sonner";
import { useState } from "react";
import Gallery from "./Gallery";
import Blog from "./Blog";
import { About } from "./About";
import { Profile } from "./Profile";

export default function App() {
  const [currentPage, setCurrentPage] = useState<"profile" | "gallery" | "blog" | "about">("profile");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  const menuItems = [
    { id: "profile", label: "Profile" },
    { id: "gallery", label: "Photographs & Videos" },
    { id: "blog", label: "Memories" },
    { id: "about", label: "About" },
  ] as const;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-10 bg-emerald-800/90 text-white backdrop-blur-sm p-4">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-semibold">Emerald Palace</h2>
          
          {/* Hamburger button - only visible below 600px */}
          <button 
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="@[600px]:hidden p-2 hover:bg-emerald-700 rounded"
            aria-label="Toggle menu"
          >
            <div className="w-6 h-5 relative flex flex-col justify-between">
              <span className={`block h-0.5 w-full bg-white transform transition-transform ${isMenuOpen ? 'rotate-45 translate-y-2' : ''}`} />
              <span className={`block h-0.5 w-full bg-white transition-opacity ${isMenuOpen ? 'opacity-0' : ''}`} />
              <span className={`block h-0.5 w-full bg-white transform transition-transform ${isMenuOpen ? '-rotate-45 -translate-y-2' : ''}`} />
            </div>
          </button>

          {/* Desktop navigation - hidden below 600px */}
          <nav className="hidden @[600px]:flex gap-4 items-center">
            {menuItems.map(item => (
              <button 
                key={item.id}
                onClick={() => setCurrentPage(item.id)}
                className={`px-3 py-1 rounded ${currentPage === item.id ? "bg-emerald-600" : "hover:bg-emerald-700"}`}
              >
                {item.label}
              </button>
            ))}
            <SignOutButton />
          </nav>
        </div>

        {/* Mobile navigation - only visible below 600px when menu is open */}
        <nav className={`${isMenuOpen ? 'flex' : 'hidden'} @[600px]:hidden flex-col gap-2 mt-4`}>
          {menuItems.map(item => (
            <button 
              key={item.id}
              onClick={() => {
                setCurrentPage(item.id);
                setIsMenuOpen(false);
              }}
              className={`px-3 py-2 rounded text-left ${
                currentPage === item.id ? "bg-emerald-600" : "hover:bg-emerald-700"
              }`}
            >
              {item.label}
            </button>
          ))}
          <div className="pt-2 mt-2 border-t border-emerald-700">
            <div className="px-3 py-2 rounded hover:bg-emerald-700">
              <SignOutButton />
            </div>
          </div>
        </nav>
      </header>
      
      <main className="flex-1 p-8">
        <Unauthenticated>
          <div className="max-w-md mx-auto">
            <h1 className="text-4xl font-bold text-center mb-8 text-emerald-800">Welcome to Emerald Palace</h1>
            <p className="text-center text-gray-600 mb-8">
              Please sign in with your username and password to access your personal digital palace.
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
      <Toaster />
    </div>
  );
}

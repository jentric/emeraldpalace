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
  
  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-10 bg-emerald-800/90 text-white backdrop-blur-sm p-4 flex justify-between items-center">
        <h2 className="text-2xl font-semibold">Emerald Palace</h2>
        <nav className="flex gap-4 items-center">
          <button 
            onClick={() => setCurrentPage("profile")}
            className={`px-3 py-1 rounded ${currentPage === "profile" ? "bg-emerald-600" : "hover:bg-emerald-700"}`}
          >
            Profile
          </button>
          <button 
            onClick={() => setCurrentPage("gallery")}
            className={`px-3 py-1 rounded ${currentPage === "gallery" ? "bg-emerald-600" : "hover:bg-emerald-700"}`}
          >
            Photographs & Videos
          </button>
          <button 
            onClick={() => setCurrentPage("blog")}
            className={`px-3 py-1 rounded ${currentPage === "blog" ? "bg-emerald-600" : "hover:bg-emerald-700"}`}
          >
            Memories
          </button>
          <button 
            onClick={() => setCurrentPage("about")}
            className={`px-3 py-1 rounded ${currentPage === "about" ? "bg-emerald-600" : "hover:bg-emerald-700"}`}
          >
            About
          </button>
          <SignOutButton />
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

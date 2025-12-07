import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import { ModeToggle } from "./ui/mode-toggle"

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20)
    }
    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  const navLinks = [
    { name: "Templates", href: "/templates" },
    { name: "Boards", href: "#boards" },
    { name: "GitHub", href: "https://github.com/shivamd20/liva", external: true },
    { name: "Book a demo", href: "https://calendar.app.google/uxqDsCepVjkX6MXj6", external: true },
  ]

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ease-out ${scrolled ? "py-3" : "py-5"}`}
      >
        <div className="max-w-7xl mx-auto px-6">
          <div
            className={`relative flex items-center justify-between rounded-2xl transition-all duration-500 ease-out ${scrolled
              ? "bg-background/70 backdrop-blur-2xl border border-border/50 shadow-lg shadow-black/[0.03] px-6 py-3"
              : "bg-transparent px-2 py-2"
              }`}
            style={{
              boxShadow: scrolled ? "0 0 0 1px rgba(255,255,255,0.05) inset, 0 4px 24px -4px rgba(0,0,0,0.08)" : "none",
            }}
          >
            {/* Logo */}
            <Link to="/" className="flex items-center gap-3 group">
              <div className="relative w-9 h-9 flex items-center justify-center">
                <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-accent/20 to-accent/5 group-hover:from-accent/30 group-hover:to-accent/10 transition-all duration-300" />
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="relative z-10">
                  <rect
                    x="3"
                    y="3"
                    width="18"
                    height="18"
                    rx="3"
                    className="stroke-foreground"
                    strokeWidth="1.5"
                    fill="none"
                  />
                  <circle cx="8" cy="8" r="2" className="fill-accent" />
                  <circle cx="16" cy="16" r="2" className="fill-accent/60" />
                  <path
                    d="M8 8L16 16"
                    className="stroke-foreground/40"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeDasharray="2 3"
                  />
                  <rect
                    x="13"
                    y="6"
                    width="5"
                    height="4"
                    rx="1"
                    className="fill-foreground/10 stroke-foreground/30"
                    strokeWidth="1"
                  />
                </svg>
              </div>
              <span className="text-lg font-semibold tracking-tight text-foreground">Liva</span>
              <span className="hidden sm:inline-flex badge-beta text-[10px] py-0.5 px-2">Beta</span>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.name}
                  to={link.href}
                  target={link.external ? "_blank" : undefined}
                  rel={link.external ? "noopener noreferrer" : undefined}
                  className="relative px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors duration-200 rounded-lg hover:bg-foreground/[0.04] group"
                >
                  <span className="relative z-10 flex items-center gap-1.5">
                    {link.name}
                    {link.external && (
                      <svg
                        width="10"
                        height="10"
                        viewBox="0 0 12 12"
                        fill="none"
                        className="opacity-50 group-hover:opacity-70 transition-opacity"
                      >
                        <path
                          d="M3.5 8.5L8.5 3.5M8.5 3.5H4.5M8.5 3.5V7.5"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </span>
                </Link>
              ))}
            </div>

            {/* CTA Buttons */}
            <div className="hidden md:flex items-center gap-3">
              <ModeToggle />
              <Link
                to="https://calendar.app.google/uxqDsCepVjkX6MXj6"
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors duration-200 rounded-lg hover:bg-foreground/[0.04]"
              >
                Book a Call
              </Link>
              <Link
                to="/boards"
                className="group relative px-5 py-2.5 text-sm font-semibold text-primary-foreground rounded-xl overflow-hidden transition-all duration-300"
              >
                <div className="absolute inset-0 bg-foreground rounded-xl transition-transform duration-300 group-hover:scale-105" />
                <span className="relative z-10 flex items-center gap-2">
                  Get Started
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 16 16"
                    fill="none"
                    className="transition-transform duration-300 group-hover:translate-x-0.5"
                  >
                    <path
                      d="M3 8H13M13 8L9 4M13 8L9 12"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              </Link>
            </div>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden relative w-10 h-10 flex items-center justify-center rounded-xl hover:bg-foreground/[0.04] transition-colors"
              aria-label="Toggle menu"
            >
              <div className="w-5 h-4 flex flex-col justify-between">
                <span
                  className={`block h-0.5 w-full bg-foreground rounded-full transition-all duration-300 origin-center ${mobileMenuOpen ? "rotate-45 translate-y-1.5" : ""}`}
                />
                <span
                  className={`block h-0.5 w-full bg-foreground rounded-full transition-all duration-300 ${mobileMenuOpen ? "opacity-0 scale-0" : ""}`}
                />
                <span
                  className={`block h-0.5 w-full bg-foreground rounded-full transition-all duration-300 origin-center ${mobileMenuOpen ? "-rotate-45 -translate-y-2" : ""}`}
                />
              </div>
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile menu overlay */}
      <div
        className={`fixed inset-0 z-40 md:hidden transition-all duration-300 ${mobileMenuOpen ? "pointer-events-auto" : "pointer-events-none"}`}
      >
        <div
          className={`absolute inset-0 bg-background/80 backdrop-blur-xl transition-opacity duration-300 ${mobileMenuOpen ? "opacity-100" : "opacity-0"}`}
          onClick={() => setMobileMenuOpen(false)}
        />
        <div
          className={`absolute top-24 left-6 right-6 bg-card/95 backdrop-blur-2xl rounded-2xl border border-border/50 shadow-2xl transition-all duration-500 ease-out ${mobileMenuOpen ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4"}`}
        >
          <div className="p-6 space-y-2">
            {navLinks.map((link, index) => (
              <Link
                key={link.name}
                to={link.href}
                target={link.external ? "_blank" : undefined}
                rel={link.external ? "noopener noreferrer" : undefined}
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-between px-4 py-3 text-base font-medium text-foreground hover:bg-foreground/[0.04] rounded-xl transition-colors"
                style={{ transitionDelay: mobileMenuOpen ? `${index * 50}ms` : "0ms" }}
              >
                <span>{link.name}</span>
                {link.external && (
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="text-muted-foreground">
                    <path
                      d="M5 11L11 5M11 5H6M11 5V10"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </Link>
            ))}
          </div>
          <div className="border-t border-border/50 p-6 space-y-3">
            <div className="flex items-center justify-center mb-3">
              <ModeToggle />
            </div>
            <Link
              to="https://calendar.app.google/uxqDsCepVjkX6MXj6"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center justify-center w-full px-5 py-3 text-base font-medium text-foreground border border-border rounded-xl hover:bg-foreground/[0.04] transition-colors"
            >
              Book a Call
            </Link>
            <Link
              to="/boards"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center justify-center gap-2 w-full px-5 py-3 text-base font-semibold text-primary-foreground bg-foreground rounded-xl hover:bg-foreground/90 transition-colors"
            >
              Get Started
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}

"use client"

import { useState, useEffect } from "react"
import { Link, useNavigate, useLocation } from "react-router-dom"
import { useSession, signOut, signIn } from "../../lib/auth-client"
import * as DropdownMenu from "@radix-ui/react-dropdown-menu"
import { LogOut } from "lucide-react"
import { queryClient } from "../../main"
import { ModeToggle } from "../ui/mode-toggle"

interface BoardsHeaderProps {
  searchQuery: string
  onSearchChange: (query: string) => void
}

export default function BoardsHeader({ searchQuery, onSearchChange }: BoardsHeaderProps) {
  const [scrolled, setScrolled] = useState(false)
  const [showSwitchConfirm, setShowSwitchConfirm] = useState(false)

  const { data: session, isPending: isAuthPending } = useSession()
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10)
    }
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  const navLinks = [
    { name: "Boards", href: "/boards" },
    { name: "Integrations", href: "/app/integrations" },
  ]

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ease-out ${scrolled ? "py-3" : "py-4"}`}
    >
      <div className="max-w-7xl mx-auto px-6">
        <div
          className={`relative flex items-center justify-between rounded-2xl transition-all duration-500 ease-out ${scrolled
            ? "bg-background/70 backdrop-blur-2xl border border-border/50 shadow-lg shadow-black/[0.03] px-5 py-2.5"
            : "bg-background/50 backdrop-blur-xl border border-border/30 px-5 py-3"
            }`}
          style={{
            boxShadow: scrolled
              ? "0 0 0 1px rgba(255,255,255,0.05) inset, 0 4px 24px -4px rgba(0,0,0,0.08)"
              : "0 0 0 1px rgba(255,255,255,0.03) inset, 0 2px 12px -4px rgba(0,0,0,0.04)",
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
            <span className="text-lg font-semibold tracking-tight text-foreground hidden sm:inline">Liva</span>
          </Link>

          {/* Center Navigation */}
          <nav className="hidden md:flex items-center gap-1 absolute left-1/2 -translate-x-1/2">
            {navLinks.map((link) => {
              const isActive = link.href === "/boards"
                ? location.pathname === "/boards" && !location.search.includes("filter=shared")
                : link.href === "/boards?filter=shared"
                  ? location.pathname === "/boards" && location.search.includes("filter=shared")
                  : location.pathname.startsWith(link.href)

              return (
                <Link
                  key={link.name}
                  to={link.href}
                  className={`relative px-4 py-2 text-sm font-medium transition-colors duration-200 rounded-lg ${isActive
                    ? "text-foreground bg-foreground/[0.06]"
                    : "text-muted-foreground hover:text-foreground hover:bg-foreground/[0.04]"
                    }`}
                >
                  {link.name}
                </Link>
              )
            })}
          </nav>

          {/* Right side: Search + Settings + Avatar */}
          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative hidden sm:block">
              <svg
                width="16"
                height="16"
                viewBox="0 0 20 20"
                fill="none"
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
              >
                <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.5" />
                <path d="M13.5 13.5L17 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <input
                type="text"
                placeholder="Search boards..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-48 lg:w-64 pl-9 pr-4 py-2 text-sm bg-foreground/[0.04] border border-border/50 rounded-xl placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 transition-all duration-200"
              />
            </div>

            {/* Theme Toggle */}
            <ModeToggle />

            {/* Avatar */}
            {/* Avatar */}
            {isAuthPending ? (
              <div className="w-10 h-10 bg-gray-100 rounded-full animate-pulse" />
            ) : session?.user ? (
              <DropdownMenu.Root onOpenChange={(open) => !open && setShowSwitchConfirm(false)}>
                <DropdownMenu.Trigger asChild>
                  <button
                    className="w-10 h-10 rounded-full bg-gradient-to-br from-accent to-blue-500 flex items-center justify-center text-white text-sm font-semibold shadow-md shadow-accent/20 hover:shadow-lg hover:shadow-accent/30 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:ring-offset-2 focus:ring-offset-background overflow-hidden relative"
                    aria-label="Account menu"
                  >
                    {session.user.image ? (
                      <img src={session.user.image} alt={session.user.name || 'User'} className="w-full h-full object-cover" />
                    ) : (
                      session.user.name ? session.user.name.charAt(0).toUpperCase() : 'U'
                    )}
                    {session.user.isAnonymous && (
                      <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                      </div>
                    )}
                  </button>
                </DropdownMenu.Trigger>

                <DropdownMenu.Portal>
                  <DropdownMenu.Content
                    className="min-w-[260px] bg-popover/95 backdrop-blur-sm rounded-xl shadow-xl border border-border/50 p-1.5 z-50 animate-in fade-in zoom-in-95 duration-100"
                    sideOffset={8}
                    align="end"
                  >
                    <div className="px-2 py-2.5 mb-1 bg-muted/30 rounded-lg">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {session.user.name || 'User'}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {session.user.email || 'Guest User'}
                      </p>
                    </div>

                    {session.user.isAnonymous ? (
                      <>
                        {showSwitchConfirm ? (
                          <div className="p-2 bg-amber-50 rounded-md border border-amber-100 mb-1">
                            <p className="text-xs text-amber-800 font-medium mb-2 leading-snug">
                              <span className="block font-bold mb-0.5">Wait! Read this.</span>
                              Logging in to a new account will <span className="underline decoration-amber-500/50">discard</span> your current guest boards.
                            </p>
                            <div className="flex gap-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowSwitchConfirm(false);
                                }}
                                className="flex-1 px-2 py-1.5 text-xs font-medium text-amber-700 bg-amber-100/50 hover:bg-amber-100 rounded transition-colors"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  await signOut();
                                  await signIn.social({
                                    provider: 'google',
                                    callbackURL: '/boards'
                                  });
                                }}
                                className="flex-1 px-2 py-1.5 text-xs font-medium text-white bg-amber-600 hover:bg-amber-700 rounded transition-colors shadow-sm"
                              >
                                Continue
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            {/* Option 1: Continue/Merge (Primary) */}
                            <DropdownMenu.Item
                              onSelect={async () => {
                                // Link/Merge current anonymous session
                                await signIn.social({
                                  provider: 'google',
                                  callbackURL: '/boards'
                                });
                              }}
                              className="flex flex-col gap-1 px-2 py-2.5 bg-blue-50/50 hover:bg-blue-50 text-blue-700 rounded-md cursor-pointer outline-none transition-all mb-1"
                            >
                              <div className="flex items-center gap-2 font-medium">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-4 h-4">
                                  <path d="M12 4V20M20 12H4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                                Continue with Google
                              </div>
                              <span className="text-[10px] text-blue-600/80 leading-tight">
                                Save your current boards to a Google account
                              </span>
                            </DropdownMenu.Item>

                            <DropdownMenu.Separator className="h-px bg-border/50 my-1" />

                            {/* Option 2: Switch/Login Fresh */}
                            <DropdownMenu.Item
                              onSelect={(e) => {
                                e.preventDefault();
                                setShowSwitchConfirm(true);
                              }}
                              className="flex items-center gap-2 px-2 py-2 text-sm text-foreground hover:bg-muted rounded-md cursor-pointer outline-none transition-all"
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-muted-foreground"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><polyline points="10 17 15 12 10 7" /><line x1="15" y1="12" x2="3" y2="12" /></svg>
                              Log in to another account
                            </DropdownMenu.Item>
                          </>
                        )}

                        <DropdownMenu.Item
                          onSelect={async () => {
                            if (window.confirm("This will clear your local guest session and data. Are you sure?")) {
                              await signOut();
                              queryClient.invalidateQueries();
                              navigate('/');
                              window.location.reload();
                            }
                          }}
                          className="flex items-center gap-2 px-2 py-2 text-sm text-red-600 hover:bg-red-50 rounded-md cursor-pointer outline-none transition-all"
                        >
                          <LogOut className="w-4 h-4" />
                          Clear Data
                        </DropdownMenu.Item>
                      </>
                    ) : (
                      <>
                        <DropdownMenu.Item
                          onSelect={async () => {
                            // Switch Account: Sign out first, then immediately trigger Google login
                            await signOut();
                            await signIn.social({
                              provider: 'google',
                              callbackURL: '/boards'
                            });
                          }}
                          className="flex items-center gap-2 px-2 py-2 text-sm text-foreground hover:bg-muted rounded-md cursor-pointer outline-none transition-all"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-muted-foreground"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                          Switch Google Account
                        </DropdownMenu.Item>
                        <DropdownMenu.Item
                          onSelect={async () => {
                            await signOut();
                            queryClient.invalidateQueries()
                            navigate('/');
                          }}
                          className="flex items-center gap-2 px-2 py-2 text-sm text-red-600 hover:bg-red-50 rounded-md cursor-pointer outline-none transition-all"
                        >
                          <LogOut className="w-4 h-4" />
                          Sign Out
                        </DropdownMenu.Item>
                      </>
                    )}
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            ) : (
              <button
                onClick={() => signIn.social({
                  provider: 'google',
                  callbackURL: '/board'
                })}
                className="text-sm font-medium px-4 py-2 bg-foreground text-background rounded-full hover:bg-foreground/90 transition-colors"
              >
                Sign In
              </button>
            )}


          </div>
        </div>
      </div>
    </header>
  )
}

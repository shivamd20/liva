import { Github, Twitter, Linkedin } from "lucide-react"

const links = {
  product: [
    { name: "Features", href: "#features" },
    { name: "Use Cases", href: "#use-cases" },
  ],
  resources: [
    { name: "GitHub", href: "https://github.com/shivamd20/liva" },
  ],
  company: [
    { name: "Contact", href: "https://calendar.app.google/uxqDsCepVjkX6MXj6" },
    { name: "Privacy Policy", href: "/privacy" },
  ],
}

const socialLinks = {
  github: "https://github.com/shivamd20",
  twitter: "https://x.com/final_const",
  linkedin: "https://www.linkedin.com/in/shvm-in/",
}

export default function Footer() {
  return (
    <footer className="border-t border-border bg-secondary/20">
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-16">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-foreground flex items-center justify-center">
                <span className="text-background font-bold text-sm">L</span>
              </div>
              <span className="font-semibold text-lg">Liva</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              The AI-native infinite canvas for teams who think together.
            </p>
          </div>

          <div>
            <h4 className="font-semibold mb-4 text-sm">Product</h4>
            <ul className="space-y-3">
              {links.product.map((link) => (
                <li key={link.name}>
                  <a href={link.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    {link.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4 text-sm">Resources</h4>
            <ul className="space-y-3">
              {links.resources.map((link) => (
                <li key={link.name}>
                  <a
                    href={link.href}
                    target={link.href.startsWith("http") ? "_blank" : undefined}
                    rel={link.href.startsWith("http") ? "noopener noreferrer" : undefined}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4 text-sm">Company</h4>
            <ul className="space-y-3">
              {links.company.map((link) => (
                <li key={link.name}>
                  <a
                    href={link.href}
                    target={link.href.startsWith("http") ? "_blank" : undefined}
                    rel={link.href.startsWith("http") ? "noopener noreferrer" : undefined}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-8 border-t border-border">
          <p className="text-sm text-muted-foreground">&copy; {new Date().getFullYear()} Liva. Open source under MIT.</p>
          <div className="flex items-center gap-4">
            <a href={socialLinks.github} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors" aria-label="GitHub">
              <Github className="w-5 h-5" />
            </a>
            <a href={socialLinks.twitter} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors" aria-label="Twitter">
              <Twitter className="w-5 h-5" />
            </a>
            <a href={socialLinks.linkedin} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors" aria-label="LinkedIn">
              <Linkedin className="w-5 h-5" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}

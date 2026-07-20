import { SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from "@/components/ui/sidebar";
import { Link, useLocation } from "wouter";
import { LayoutDashboard, Users, Megaphone, Inbox, UserCircle, MessageSquare, ClipboardCheck, Wrench, FlaskConical, History, Settings, Sun, Moon } from "lucide-react";
import React from "react";
import { useTheme } from "@/hooks/use-theme";
import { useLang } from "@/hooks/use-lang";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { theme, setTheme } = useTheme();
  const { lang, setLang, tr } = useLang();

  const mainNav = [
    { name: tr.overview, href: "/", icon: LayoutDashboard },
    { name: tr.clients, href: "/clients", icon: Users },
    { name: tr.personas, href: "/personas", icon: UserCircle },
    { name: tr.campaigns, href: "/campaigns", icon: Megaphone },
    { name: tr.draftReplies, href: "/drafts", icon: Inbox },
    { name: tr.replyHistory, href: "/reply-history", icon: History },
    { name: tr.slackApproval, href: "/slack-approval", icon: MessageSquare },
  ];

  const internalNav = [
    { name: tr.testFlow, href: "/test-flow", icon: FlaskConical },
    { name: tr.clientOnboarding, href: "/onboarding", icon: ClipboardCheck },
    { name: tr.internalSetup, href: "/internal-setup", icon: Wrench },
    { name: tr.settings, href: "/settings", icon: Settings },
  ];

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background font-sans text-foreground">
        <Sidebar className="border-r border-border bg-card">
          <SidebarHeader className="p-4 border-b border-border flex flex-row items-center gap-2">
            <img src="/logo.png" alt="DraftFly" className="h-6 w-auto" />
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {mainNav.map((item) => (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={location === item.href || (location.startsWith(item.href) && item.href !== "/")}
                        className="data-[active=true]:border-t data-[active=true]:border-primary/20 data-[active=true]:bg-accent/50 transition-all"
                      >
                        <Link href={item.href} className="flex items-center gap-3" data-testid={`nav-${item.href.replace(/^\//, '') || 'overview'}`}>
                          <item.icon className="h-4 w-4" />
                          <span className="text-sm font-medium">{item.name}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            <SidebarGroup>
              <SidebarGroupLabel className="text-xs text-muted-foreground/50 uppercase tracking-widest px-2 pt-2">{tr.internal}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {internalNav.map((item) => (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={location === item.href || (location.startsWith(item.href) && item.href !== "/")}
                        className="data-[active=true]:border-t data-[active=true]:border-primary/20 data-[active=true]:bg-accent/50 transition-all"
                      >
                        <Link href={item.href} className="flex items-center gap-3" data-testid={`nav-${item.href.replace(/^\//, '')}`}>
                          <item.icon className="h-4 w-4" />
                          <span className="text-sm font-medium">{item.name}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {/* ─── Theme + Language toggles ────────────────────────────── */}
            <div className="mt-auto p-4 border-t border-border space-y-2">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setTheme("light")}
                  title="Light theme"
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                    theme === "light"
                      ? "bg-primary/15 text-primary border border-primary/30"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/50 border border-transparent"
                  }`}
                >
                  <Sun className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setTheme("dark")}
                  title="Dark theme"
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                    theme === "dark"
                      ? "bg-primary/15 text-primary border border-primary/30"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/50 border border-transparent"
                  }`}
                >
                  <Moon className="h-3.5 w-3.5" />
                </button>
                <div className="flex-1" />
                <button
                  onClick={() => setLang("en")}
                  className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                    lang === "en"
                      ? "bg-primary/15 text-primary border border-primary/30"
                      : "text-muted-foreground hover:text-foreground border border-transparent"
                  }`}
                >
                  EN
                </button>
                <button
                  onClick={() => setLang("ru")}
                  className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                    lang === "ru"
                      ? "bg-primary/15 text-primary border border-primary/30"
                      : "text-muted-foreground hover:text-foreground border border-transparent"
                  }`}
                >
                  RU
                </button>
              </div>
            </div>
          </SidebarContent>
        </Sidebar>
        <main className="flex-1 overflow-auto flex flex-col">
          <div className="flex-1 p-6 lg:p-8 max-w-6xl mx-auto w-full">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}

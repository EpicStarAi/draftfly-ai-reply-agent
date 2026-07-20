import { SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from "@/components/ui/sidebar";
import { Link, useLocation } from "wouter";
import { LayoutDashboard, Users, Megaphone, Inbox, UserCircle, MessageSquare, ClipboardCheck, Wrench, FlaskConical, History, Settings } from "lucide-react";
import React from "react";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const mainNav = [
    { name: "Overview", href: "/", icon: LayoutDashboard },
    { name: "Clients", href: "/clients", icon: Users },
    { name: "Personas", href: "/personas", icon: UserCircle },
    { name: "Campaigns", href: "/campaigns", icon: Megaphone },
    { name: "Draft Replies", href: "/drafts", icon: Inbox },
    { name: "Reply History", href: "/reply-history", icon: History },
    { name: "Slack Approval", href: "/slack-approval", icon: MessageSquare },
  ];

  const internalNav = [
    { name: "Test Flow", href: "/test-flow", icon: FlaskConical },
    { name: "Client Onboarding", href: "/onboarding", icon: ClipboardCheck },
    { name: "Internal Setup", href: "/internal-setup", icon: Wrench },
    { name: "Settings", href: "/settings", icon: Settings },
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
                        <Link href={item.href} className="flex items-center gap-3" data-testid={`nav-${item.name.toLowerCase().replace(/\s+/g, '-')}`}>
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
              <SidebarGroupLabel className="text-xs text-muted-foreground/50 uppercase tracking-widest px-2 pt-2">Internal</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {internalNav.map((item) => (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={location === item.href || (location.startsWith(item.href) && item.href !== "/")}
                        className="data-[active=true]:border-t data-[active=true]:border-primary/20 data-[active=true]:bg-accent/50 transition-all"
                      >
                        <Link href={item.href} className="flex items-center gap-3" data-testid={`nav-${item.name.toLowerCase().replace(/\s+/g, '-')}`}>
                          <item.icon className="h-4 w-4" />
                          <span className="text-sm font-medium">{item.name}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
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

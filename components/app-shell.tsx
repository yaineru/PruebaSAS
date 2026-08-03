import Link from "next/link";
import {
  BarChart3,
  Bell,
  Building2,
  CalendarDays,
  Clock,
  LogOut,
  Mail,
  Menu,
  Palette,
  Plug,
  ShieldCheck
} from "lucide-react";
import { signOut } from "@/lib/actions/auth";
import { modules } from "@/lib/modules";
import { applyCompanySettings, getCompanySettings } from "@/lib/company-settings";
import { Button } from "@/components/ui/button";
import { getTenantContext } from "@/lib/tenant";
import { NotificationBell } from "@/components/notification-bell";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const tenant = await getTenantContext();
  const settings = await getCompanySettings(tenant.companyId, tenant.companyName);
  const visibleModules = modules.map((module) => applyCompanySettings(module, settings));
  const mobileItems = visibleModules.slice(0, 6).map((module) => ({ 
    href: module.href, 
    label: module.title.slice(0, 8), 
    icon: module.icon 
  }));

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur lg:hidden">
        <div className="flex h-14 items-center justify-between px-4">
          <div className="flex min-w-0 items-center gap-2">
            <Menu className="h-5 w-5 shrink-0 text-muted-foreground" />
            <span className="truncate font-semibold">EmpresaOS</span>
          </div>
          <div className="flex items-center gap-1">
            <NotificationBell companyId={tenant.companyId} />
            <form action={signOut}>
              <Button size="icon" variant="ghost" aria-label="Cerrar sesión">
                <LogOut className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </div>
        <nav className="flex gap-2 overflow-x-auto px-4 pb-3">
          <Link className="shrink-0 rounded-md border px-3 py-2 text-sm" href="/">
            Panel general
          </Link>
          {visibleModules.map((item) => (
            <Link className="shrink-0 rounded-md border px-3 py-2 text-sm" href={item.href} key={item.href}>
              {item.title}
            </Link>
          ))}
        </nav>
      </header>

      <aside className="fixed inset-y-0 left-0 z-20 hidden w-72 border-r bg-card lg:block">
        <div className="flex h-full flex-col">
          <div className="border-b p-5">
            <Link href="/" className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <Building2 className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold">EmpresaOS</p>
                <p className="truncate text-sm text-muted-foreground">{settings.companyName}</p>
              </div>
            </Link>
          </div>
          <nav className="flex-1 space-y-1 p-3">
            <Link className="block rounded-md px-3 py-2 text-sm font-medium hover:bg-muted" href="/">
              Panel general
            </Link>
            {visibleModules.map((item) => (
              <Link
                className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
                href={item.href}
                key={item.href}
              >
                <item.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                {item.title}
              </Link>
            ))}
            {tenant.role === "ADMIN" ? (
              <>
                <Link
                  className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
                  href="/admin/report-templates"
                >
                  <Palette className="h-4 w-4 shrink-0 text-muted-foreground" />
                  Plantillas de informes
                </Link>
                <Link
                  className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
                  href="/admin/report-schedules"
                >
                  <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
                  Programación de informes
                </Link>
                <Link
                  className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
                  href="/settings/email"
                >
                  <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
                  Correo (SMTP)
                </Link>
              </>
            ) : null}
            <Link
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
              href="/agenda"
            >
              <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
              Agenda
            </Link>
            <Link
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
              href="/notificaciones"
            >
              <Bell className="h-4 w-4 shrink-0 text-muted-foreground" />
              Notificaciones
            </Link>
            <Link
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
              href="/analytics"
            >
              <BarChart3 className="h-4 w-4 shrink-0 text-muted-foreground" />
              Analytics
            </Link>
            <Link
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
              href="/settings/integrations"
            >
              <Plug className="h-4 w-4 shrink-0 text-muted-foreground" />
              Integraciones
            </Link>
            {tenant.role === "SUPER_ADMIN" ? (
              <Link
                className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
                href="/super-admin/auditoria"
              >
                <ShieldCheck className="h-4 w-4 shrink-0 text-muted-foreground" />
                Auditoria
              </Link>
            ) : null}
          </nav>
          <div className="border-t p-3">
            <Link href="/perfil" className="mb-3 block rounded-md bg-muted p-3 text-sm hover:bg-muted/70">
              <p className="font-medium">{tenant.role}</p>
              <p className="text-muted-foreground">Mi perfil y contraseña</p>
            </Link>
            <form action={signOut}>
              <Button variant="outline" className="w-full">
                <LogOut className="h-4 w-4" />
                Cerrar sesión
              </Button>
            </form>
          </div>
        </div>
      </aside>

      <main className="pb-20 lg:pb-0 lg:pl-72">
        <div className="mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8">{children}</div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-6 border-t bg-background/95 px-2 py-2 backdrop-blur lg:hidden">
        {mobileItems.map((item) => (
          <Link
            className="flex flex-col items-center justify-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            href={item.href}
            key={item.href}
          >
            <item.icon className="h-4 w-4" />
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}

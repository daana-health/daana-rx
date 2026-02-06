"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter, usePathname } from 'next/navigation';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../store';
import { logout } from '../../store/authSlice';
import { useAuth } from '../../hooks/useAuth';
import { ClinicSwitcher } from '../ClinicSwitcher';
import { AppInitializer } from '../AppInitializer';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Home,
  PackageCheck,
  PackageMinus,
  QrCode,
  Package,
  FileText,
  Settings,
  LogOut,
  MapPin,
  Menu,
  Loader2,
  ClipboardList,
} from 'lucide-react';

interface AppShellProps {
  children: React.ReactNode;
}

interface NavItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href: string;
  badge?: string;
}

function NavLink({
  item,
  isActive,
  onNavigate,
}: {
  item: NavItem;
  isActive: boolean;
  onNavigate: (href: string) => void;
}) {
  const handleClick = useCallback(() => {
    onNavigate(item.href);
  }, [item.href, onNavigate]);

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        'group flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200',
        isActive
          ? 'bg-primary text-primary-foreground shadow-soft'
          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground hover:shadow-soft'
      )}
    >
      <item.icon className={cn(
        "h-5 w-5 transition-transform duration-200",
        isActive ? "scale-110" : "group-hover:scale-110"
      )} />
      <span className="flex-1 text-left font-medium">{item.label}</span>
      {item.badge && (
        <span className="ml-auto rounded-full bg-primary-foreground/20 px-2.5 py-0.5 text-xs font-semibold">
          {item.badge}
        </span>
      )}
    </button>
  );
}

function Sidebar({ navItems, pathname, onNavigate }: {
  navItems: NavItem[];
  pathname: string;
  onNavigate: (href: string) => void;
}) {
  return (
    <div className="flex h-full flex-col gap-2 py-6">
      <div className="px-4 mb-2">
        <h2 className="px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Navigation
        </h2>
      </div>
      <ScrollArea className="flex-1 px-4">
        <div className="space-y-2">
          {navItems.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              isActive={pathname === item.href}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

export function AppShell({ children }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const dispatch = useDispatch();
  const { user } = useSelector((state: RootState) => state.auth);
  const { isAuthenticated, hasHydrated } = useAuth();

  const handleLogout = useCallback(() => {
    dispatch(logout(undefined));
    router.push('/auth/signin');
  }, [dispatch, router]);

  const handleNavigation = useCallback(
    (href: string) => {
      router.push(href);
      setMobileOpen(false);
    },
    [router]
  );

  // Must compute navItems before early returns to maintain hook order
  const navItems: NavItem[] = useMemo(() => {
    const baseNav: NavItem[] = [
      { icon: Home, label: 'Home', href: '/' },
      { icon: PackageCheck, label: 'Check In', href: '/checkin' },
      { icon: PackageMinus, label: 'Check Out', href: '/checkout' },
      { icon: QrCode, label: 'Scan/Lookup', href: '/scan' },
      { icon: Package, label: 'Inventory', href: '/inventory' },
      { icon: ClipboardList, label: 'Logs', href: '/logs' },
      { icon: FileText, label: 'Reports', href: '/reports' },
    ];

    if (user?.userRole === 'admin' || user?.userRole === 'superadmin') {
      baseNav.push({ icon: MapPin, label: 'Admin', href: '/admin' });
      baseNav.push({ icon: Settings, label: 'Settings', href: '/settings' });
    }

    return baseNav;
  }, [user?.userRole]);

  if (!hasHydrated) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <AppInitializer>
      <div className="flex h-screen overflow-hidden bg-muted/30 antialiased">
        {/* Desktop Sidebar */}
        <aside className="hidden w-72 border-r bg-card/50 backdrop-blur-xl lg:block">
          <div className="flex h-20 items-center border-b px-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-soft">
                <span className="text-lg font-bold">D</span>
              </div>
              <div className="flex flex-col">
                <h1 className="text-lg font-bold leading-none">DaanaRX</h1>
                <span className="text-xs text-muted-foreground">Medication Tracking</span>
              </div>
            </div>
          </div>
          <Sidebar navItems={navItems} pathname={pathname} onNavigate={handleNavigation} />
        </aside>

        {/* Main Content */}
        <div className="flex flex-1 flex-col">
          {/* Header */}
          <header className="sticky top-0 z-50 flex h-20 items-center gap-4 border-b bg-background/80 backdrop-blur-xl px-4 shadow-soft lg:px-8 flex-shrink-0">
            {/* Mobile Menu */}
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="lg:hidden">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Toggle menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0">
                <div className="flex h-20 items-center border-b px-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-soft">
                      <span className="text-lg font-bold">D</span>
                    </div>
                    <div className="flex flex-col">
                      <h1 className="text-lg font-bold leading-none">DaanaRX</h1>
                      <span className="text-xs text-muted-foreground">Medication Tracking</span>
                    </div>
                  </div>
                </div>
                <Sidebar navItems={navItems} pathname={pathname} onNavigate={handleNavigation} />
              </SheetContent>
            </Sheet>

            <div className="flex flex-1 items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3 lg:hidden">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-soft">
                    <span className="text-base font-bold">D</span>
                  </div>
                  <h1 className="text-lg font-bold">DaanaRX</h1>
                </div>
                <ClinicSwitcher />
              </div>

              <div className="flex items-center gap-3">
                <div className="hidden rounded-lg bg-muted/50 px-4 py-2 text-sm md:block">
                  <span className="font-semibold">{user?.username}</span>
                  <span className="ml-2 text-muted-foreground capitalize">({user?.userRole})</span>
                </div>
                <Separator orientation="vertical" className="hidden h-6 md:block" />
                <Button variant="outline" size="sm" onClick={handleLogout} className="gap-2">
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">Sign Out</span>
                </Button>
              </div>
            </div>
          </header>

          {/* Page Content */}
          <main className="flex-1 overflow-auto bg-background pt-8 sm:pt-10 lg:pt-12">
            <div className="container-responsive pb-8 lg:pb-12">
              {children}
            </div>
          </main>
        </div>
      </div>
    </AppInitializer>
  );
}

'use client';

import { useQuery, gql } from '@apollo/client';
import { useRouter } from 'next/navigation';
import { useSelector } from 'react-redux';
import { 
  Package,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  PackageCheck,
  PackageMinus,
  QrCode,
  FileText,
  LayoutGrid,
  ArrowRight,
} from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { RootState } from '@/store';

const GET_DASHBOARD_STATS = gql`
  query GetDashboardStats($clinicId: ID) {
    getDashboardStats(clinicId: $clinicId) {
      totalUnits
      unitsExpiringSoon
      recentCheckIns
      recentCheckOuts
      lowStockAlerts
    }
  }
`;

interface QuickActionCardProps {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  href: string;
}

function QuickActionCard({ title, description, icon: Icon, color, href }: QuickActionCardProps) {
  const router = useRouter();

  return (
    <Card
      className="group cursor-pointer transition-all duration-200 hover:shadow-large hover:border-primary/20 active:scale-[0.98] animate-fade-in"
      onClick={() => router.push(href)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && router.push(href)}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div className={cn(
          "rounded-xl p-3 transition-all duration-200 group-hover:scale-110",
          color === "blue" && "bg-primary/10 text-primary",
          color === "green" && "bg-success/10 text-success",
          color === "violet" && "bg-violet-500/10 text-violet-600 dark:text-violet-400",
          color === "teal" && "bg-primary/15 text-primary",
          color === "indigo" && "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
        )}>
          <Icon className="h-6 w-6" />
        </div>
        <ArrowRight className="h-5 w-5 text-muted-foreground transition-all duration-200 group-hover:translate-x-1 group-hover:text-primary" />
      </CardHeader>
      <CardContent>
        <CardTitle className="text-base sm:text-lg mb-2">{title}</CardTitle>
        <CardDescription className="text-sm">{description}</CardDescription>
      </CardContent>
    </Card>
  );
}

function StatCard({
  title,
  value,
  icon: Icon,
  color,
  variant = 'default'
}: {
  title: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  variant?: 'default' | 'warning' | 'danger';
}) {
  return (
    <Card className="animate-slide-in">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3 gap-3">
        <CardTitle className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-muted-foreground flex-1 min-w-0">
          {title}
        </CardTitle>
        <div className={cn(
          "rounded-xl shadow-soft flex items-center justify-center h-10 w-10 flex-shrink-0",
          color === "blue" && "bg-primary/10 text-primary",
          color === "orange" && "bg-warning/10 text-warning",
          color === "red" && "bg-destructive/10 text-destructive",
          color === "green" && "bg-success/10 text-success",
          color === "teal" && "bg-primary/15 text-primary",
        )}>
          <Icon className="h-5 w-5" />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-2xl sm:text-3xl font-bold tracking-tight break-words">{value.toLocaleString()}</div>
        {variant === 'warning' && value > 0 && (
          <Badge variant="outline" className="border-warning text-warning bg-warning/10 font-medium">
            Needs attention
          </Badge>
        )}
        {variant === 'danger' && value > 0 && (
          <Badge variant="outline" className="border-destructive text-destructive bg-destructive/10 font-medium">
            Action required
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}

export default function HomePage() {
  const clinicId = useSelector((state: RootState) => state.auth.clinic?.clinicId);
  const { data, loading, error } = useQuery(GET_DASHBOARD_STATS, {
    variables: { clinicId },
    // Clinic is selected via header/variable; avoid cross-clinic cache reuse.
    fetchPolicy: 'network-only',
  });
  const router = useRouter();

  // Only show loading skeleton if we have no data and are loading
  // This prevents flash of loading state when navigating with cached data
  const showLoading = loading && !data;

  return (
    <AppShell>
      <div className="space-y-8 sm:space-y-10">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-base sm:text-lg text-muted-foreground">
            Overview of your clinic&apos;s medication inventory
          </p>
        </div>

        {/* Stats Grid */}
        {showLoading ? (
          <div className="grid gap-4 sm:gap-5 md:gap-6 grid-cols-1 min-[500px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {[...Array(5)].map((_, i) => (
              <Card key={i}>
                <CardHeader className="space-y-0 pb-3">
                  <Skeleton className="h-4 w-24" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-16" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : error ? (
          <Alert variant="destructive" className="animate-slide-in">
            <AlertCircle className="h-5 w-5" />
            <AlertDescription className="text-base">
              Error loading dashboard: {error.message}
            </AlertDescription>
          </Alert>
        ) : data ? (
          <div className="grid gap-4 sm:gap-5 md:gap-6 grid-cols-1 min-[500px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <StatCard
              title="Units"
              value={data.getDashboardStats.totalUnits}
              icon={Package}
              color="blue"
            />
            <StatCard
              title="Expiring"
              value={data.getDashboardStats.unitsExpiringSoon}
              icon={AlertTriangle}
              color="orange"
              variant="warning"
            />
            <StatCard
              title="Low Stock"
              value={data.getDashboardStats.lowStockAlerts}
              icon={AlertCircle}
              color="red"
              variant="danger"
            />
            <StatCard
              title="Check-Ins"
              value={data.getDashboardStats.recentCheckIns}
              icon={TrendingUp}
              color="green"
            />
            <StatCard
              title="Check-Outs"
              value={data.getDashboardStats.recentCheckOuts}
              icon={TrendingDown}
              color="teal"
            />
          </div>
        ) : null}

        {/* Quick Actions */}
        <div className="space-y-5">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Quick Actions</h2>
            <p className="text-sm sm:text-base text-muted-foreground mt-1">
              Common tasks and workflows
            </p>
          </div>

          <div className="grid gap-4 sm:gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            <QuickActionCard
              title="Check In Medications"
              description="Add new medications to inventory"
              icon={PackageCheck}
              color="blue"
              href="/checkin"
            />
            <QuickActionCard
              title="Check Out Medications"
              description="Dispense medications to patients"
              icon={PackageMinus}
              color="green"
              href="/checkout"
            />
            <QuickActionCard
              title="Scan QR Code"
              description="Quick lookup and actions"
              icon={QrCode}
              color="violet"
              href="/scan"
            />
            <QuickActionCard
              title="View Inventory"
              description="Browse all medications"
              icon={LayoutGrid}
              color="teal"
              href="/inventory"
            />
            <QuickActionCard
              title="Reports & Analytics"
              description="View detailed reports"
              icon={FileText}
              color="indigo"
              href="/reports"
            />
          </div>
        </div>

        {/* Alerts Section */}
        {data && (data.getDashboardStats.unitsExpiringSoon > 0 || data.getDashboardStats.lowStockAlerts > 0) && (
          <div className="space-y-5">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Alerts</h2>
            <div className="grid gap-4 sm:gap-5 grid-cols-1 md:grid-cols-2">
              {data.getDashboardStats.unitsExpiringSoon > 0 && (
                <Alert className="border-warning/50 bg-warning/5 animate-fade-in">
                  <AlertTriangle className="h-5 w-5 text-warning" />
                  <AlertDescription>
                    <div className="font-semibold text-base mb-3">
                      {data.getDashboardStats.unitsExpiringSoon} unit(s) expiring soon
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push('/inventory')}
                      className="w-full sm:w-auto"
                    >
                      View in Inventory
                    </Button>
                  </AlertDescription>
                </Alert>
              )}
              {data.getDashboardStats.lowStockAlerts > 0 && (
                <Alert variant="destructive" className="animate-fade-in">
                  <AlertCircle className="h-5 w-5" />
                  <AlertDescription>
                    <div className="font-semibold text-base mb-3">
                      {data.getDashboardStats.lowStockAlerts} drug(s) with low stock
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push('/inventory')}
                      className="w-full sm:w-auto"
                    >
                      View in Inventory
                    </Button>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

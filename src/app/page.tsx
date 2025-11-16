'use client';

import { useQuery, gql } from '@apollo/client';
import { useRouter } from 'next/navigation';
import { 
  Grid, 
  Card, 
  Text, 
  Title, 
  Group, 
  Stack, 
  Loader, 
  Center, 
  Box,
  UnstyledButton,
  ThemeIcon,
  SimpleGrid,
} from '@mantine/core';
import {
  IconPackage,
  IconAlertTriangle,
  IconArrowUp,
  IconArrowDown,
  IconExclamationCircle,
  IconBoxSeam,
  IconShoppingCart,
  IconQrcode,
  IconFileAnalytics,
  IconStack2,
  IconChevronRight,
} from '@tabler/icons-react';
import { AppShell } from '../components/layout/AppShell';

const GET_DASHBOARD_STATS = gql`
  query GetDashboardStats {
    getDashboardStats {
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
  icon: React.ComponentType<{ size?: string | number }>;
  color: string;
  href: string;
}

function QuickActionCard({ title, description, icon: Icon, color, href }: QuickActionCardProps) {
  const router = useRouter();

  return (
    <UnstyledButton
      onClick={() => router.push(href)}
      style={{
        width: '100%',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-4px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      <Card
        shadow="sm"
        padding="xl"
        radius="md"
        withBorder
        style={{
          height: '100%',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
        }}
      >
        <Group justify="space-between" wrap="nowrap">
          <Group wrap="nowrap">
            <ThemeIcon size={50} radius="md" color={color} variant="light">
              <Icon size={28} />
            </ThemeIcon>
            <div>
              <Text size="lg" fw={600} mb={4}>
                {title}
              </Text>
              <Text size="sm" c="dimmed">
                {description}
              </Text>
            </div>
          </Group>
          <IconChevronRight size={24} style={{ opacity: 0.5, flexShrink: 0 }} />
        </Group>
      </Card>
    </UnstyledButton>
  );
}

function StatCard({
  title,
  value,
  icon: Icon,
  color,
}: {
  title: string;
  value: number;
  icon: React.ComponentType<{ size?: string | number; style?: React.CSSProperties }>;
  color: string;
}) {
  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder>
      <Group justify="apart">
        <div>
          <Text c="dimmed" size="sm" fw={500}>
            {title}
          </Text>
          <Title order={2} mt="xs">
            {value}
          </Title>
        </div>
        <Icon size={40} style={{ color }} />
      </Group>
    </Card>
  );
}

export default function HomePage() {
  const { data, loading, error } = useQuery(GET_DASHBOARD_STATS);

  return (
    <AppShell>
      <Stack gap="xl">
        <div>
          <Title order={1}>Dashboard</Title>
          <Text c="dimmed" size="sm">
            Overview of your clinic&apos;s inventory
          </Text>
        </div>

        {loading && (
          <Center h={300}>
            <Loader size="lg" />
          </Center>
        )}

        {error && (
          <Center h={300}>
            <Text c="red">Error loading dashboard: {error.message}</Text>
          </Center>
        )}

        {data && (
          <Grid>
            <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
              <StatCard
                title="Total Units"
                value={data.getDashboardStats.totalUnits}
                icon={IconPackage}
                color="blue"
              />
            </Grid.Col>

            <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
              <StatCard
                title="Expiring Soon"
                value={data.getDashboardStats.unitsExpiringSoon}
                icon={IconAlertTriangle}
                color="orange"
              />
            </Grid.Col>

            <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
              <StatCard
                title="Low Stock Alerts"
                value={data.getDashboardStats.lowStockAlerts}
                icon={IconExclamationCircle}
                color="red"
              />
            </Grid.Col>

            <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
              <StatCard
                title="Recent Check-Ins (7d)"
                value={data.getDashboardStats.recentCheckIns}
                icon={IconArrowUp}
                color="green"
              />
            </Grid.Col>

            <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
              <StatCard
                title="Recent Check-Outs (7d)"
                value={data.getDashboardStats.recentCheckOuts}
                icon={IconArrowDown}
                color="teal"
              />
            </Grid.Col>
          </Grid>
        )}

        <Box mt="xl">
          <Title order={2} mb="lg">
            Quick Actions
          </Title>
          <SimpleGrid
            cols={{ base: 1, sm: 2 }}
            spacing="md"
          >
            <QuickActionCard
              title="Check In Medications"
              description="Add new medications to inventory"
              icon={IconBoxSeam}
              color="blue"
              href="/checkin"
            />
            <QuickActionCard
              title="Check Out Medications"
              description="Dispense medications to patients"
              icon={IconShoppingCart}
              color="green"
              href="/checkout"
            />
            <QuickActionCard
              title="Scan QR Code"
              description="Quick lookup and actions"
              icon={IconQrcode}
              color="violet"
              href="/scan"
            />
            <QuickActionCard
              title="View Inventory"
              description="Browse all medications"
              icon={IconStack2}
              color="teal"
              href="/inventory"
            />
            <QuickActionCard
              title="Reports & Analytics"
              description="View detailed reports"
              icon={IconFileAnalytics}
              color="indigo"
              href="/reports"
            />
          </SimpleGrid>
        </Box>
      </Stack>
    </AppShell>
  );
}

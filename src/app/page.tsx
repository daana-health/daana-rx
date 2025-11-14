'use client';

import { useQuery, gql } from '@apollo/client';
import { Grid, Card, Text, Title, Group, Stack, Loader, Center } from '@mantine/core';
import {
  IconPackage,
  IconAlertTriangle,
  IconArrowUp,
  IconArrowDown,
  IconExclamationCircle,
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

        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Title order={3} mb="md">
            Quick Actions
          </Title>
          <Stack>
            <Text>• Check in new medications</Text>
            <Text>• Dispense medications to patients</Text>
            <Text>• Scan QR codes for quick lookup</Text>
            <Text>• View inventory and reports</Text>
          </Stack>
        </Card>
      </Stack>
    </AppShell>
  );
}

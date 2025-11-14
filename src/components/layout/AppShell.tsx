'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSelector, useDispatch } from 'react-redux';
import { AppShell as MantineAppShell, Burger, Group, NavLink, Text, Button } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { RootState } from '../../store';
import { restoreAuth, logout } from '../../store/authSlice';
import {
  IconHome,
  IconPackageImport,
  IconPackageExport,
  IconQrcode,
  IconList,
  IconFileText,
  IconSettings,
  IconLogout,
  IconLocation,
} from '@tabler/icons-react';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [opened, { toggle }] = useDisclosure();
  const router = useRouter();
  const dispatch = useDispatch();
  const { isAuthenticated, user, clinic, expiresAt, hasHydrated } = useSelector(
    (state: RootState) => state.auth
  );

  useEffect(() => {
    dispatch(restoreAuth());
  }, [dispatch]);

  useEffect(() => {
    if (!hasHydrated) {
      return;
    }

    if (!isAuthenticated) {
      router.push('/auth/signin');
    }
  }, [hasHydrated, isAuthenticated, router]);

  useEffect(() => {
    if (!expiresAt) {
      return;
    }

    const remaining = expiresAt - Date.now();

    if (remaining <= 0) {
      dispatch(logout());
      return;
    }

    const timeoutId = window.setTimeout(() => {
      dispatch(logout());
    }, remaining);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [dispatch, expiresAt]);

  const handleLogout = () => {
    dispatch(logout());
    router.push('/auth/signin');
  };

  if (!hasHydrated) {
    return null;
  }

  if (!isAuthenticated) {
    return null;
  }

  const navItems = [
    { icon: IconHome, label: 'Home', href: '/' },
    { icon: IconPackageImport, label: 'Check In', href: '/checkin' },
    { icon: IconPackageExport, label: 'Check Out', href: '/checkout' },
    { icon: IconQrcode, label: 'Scan/Lookup', href: '/scan' },
    { icon: IconList, label: 'Inventory', href: '/inventory' },
    { icon: IconFileText, label: 'Reports', href: '/reports' },
  ];

  // Add Admin for admin and superadmin
  if (user?.userRole === 'admin' || user?.userRole === 'superadmin') {
    navItems.push({ icon: IconLocation, label: 'Admin', href: '/admin' });
  }

  // Add Settings for superadmin only
  if (user?.userRole === 'superadmin') {
    navItems.push({ icon: IconSettings, label: 'Settings', href: '/settings' });
  }

  return (
    <MantineAppShell
      header={{ height: 60 }}
      navbar={{ width: 250, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding="md"
    >
      <MantineAppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <Text size="xl" fw={700}>
              {clinic?.name || 'DaanaRx'}
            </Text>
          </Group>
          <Group>
            <Text size="sm" c="dimmed">
              {user?.username} ({user?.userRole})
            </Text>
            <Button
              variant="subtle"
              leftSection={<IconLogout size={16} />}
              onClick={handleLogout}
            >
              Logout
            </Button>
          </Group>
        </Group>
      </MantineAppShell.Header>

      <MantineAppShell.Navbar p="md">
        {navItems.map((item) => (
          <NavLink
            key={item.href}
            href={item.href}
            label={item.label}
            leftSection={<item.icon size={20} />}
            onClick={() => {
              router.push(item.href);
              if (opened) toggle();
            }}
          />
        ))}
      </MantineAppShell.Navbar>

      <MantineAppShell.Main>{children}</MantineAppShell.Main>
    </MantineAppShell>
  );
}

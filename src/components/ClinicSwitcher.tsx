'use client';

import { useSelector, useDispatch } from 'react-redux';
import { Menu, Button, Text, Group, Avatar } from '@mantine/core';
import { IconChevronDown, IconBuildingHospital } from '@tabler/icons-react';
import { RootState } from '../store';
import { switchClinic } from '../store/authSlice';
import { Clinic } from '../types';
import { apolloClient } from '../lib/apollo';

export function ClinicSwitcher() {
  const dispatch = useDispatch();
  const { clinic, clinics } = useSelector((state: RootState) => state.auth);

  // If user only has one clinic, just show the clinic name without dropdown
  if (!clinics || clinics.length <= 1) {
    return (
      <Group gap="xs">
        <IconBuildingHospital size={20} />
        <Text size="sm" fw={500}>
          {clinic?.name || 'No Clinic'}
        </Text>
      </Group>
    );
  }

  const handleClinicSwitch = async (selectedClinic: Clinic) => {
    dispatch(switchClinic(selectedClinic));
    
    // Clear Apollo cache to ensure fresh data for the new clinic
    if (apolloClient) {
      await apolloClient.clearStore();
    }
    
    // Refresh the page to reload data for the new clinic
    window.location.reload();
  };

  return (
    <Menu shadow="md" width={250} position="bottom-start">
      <Menu.Target>
        <Button
          variant="subtle"
          leftSection={<IconBuildingHospital size={20} />}
          rightSection={<IconChevronDown size={16} />}
          styles={(theme) => ({
            root: {
              '&:hover': {
                backgroundColor: theme.colors.gray[0],
              },
            },
          })}
        >
          <Text size="sm" fw={500}>
            {clinic?.name || 'Select Clinic'}
          </Text>
        </Button>
      </Menu.Target>

      <Menu.Dropdown>
        <Menu.Label>Switch Clinic</Menu.Label>
        {clinics.map((c) => (
          <Menu.Item
            key={c.clinicId}
            onClick={() => handleClinicSwitch(c)}
            leftSection={
              <Avatar
                size={24}
                radius="xl"
                color={c.primaryColor || 'blue'}
                src={c.logoUrl}
              >
                {c.name.charAt(0).toUpperCase()}
              </Avatar>
            }
            disabled={c.clinicId === clinic?.clinicId}
            style={{
              backgroundColor:
                c.clinicId === clinic?.clinicId ? 'var(--mantine-color-gray-1)' : undefined,
            }}
          >
            <div>
              <Text size="sm" fw={500}>
                {c.name}
              </Text>
              {c.userRole && (
                <Text size="xs" c="dimmed">
                  {c.userRole}
                </Text>
              )}
            </div>
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  );
}

'use client';

import { useState } from 'react';
import { useQuery, useMutation, gql } from '@apollo/client';
import {
  Stack,
  Title,
  Text,
  Card,
  Button,
  TextInput,
  Select,
  Table,
  Group,
  Modal,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { AppShell } from '../../components/layout/AppShell';
import { GetLocationsResponse, LocationData } from '../../types/graphql';

const GET_LOCATIONS = gql`
  query GetLocations {
    getLocations {
      locationId
      name
      temp
      createdAt
    }
  }
`;

const CREATE_LOCATION = gql`
  mutation CreateLocation($input: CreateLocationInput!) {
    createLocation(input: $input) {
      locationId
      name
      temp
    }
  }
`;

const UPDATE_LOCATION = gql`
  mutation UpdateLocation($input: UpdateLocationInput!) {
    updateLocation(input: $input) {
      locationId
      name
      temp
    }
  }
`;

const DELETE_LOCATION = gql`
  mutation DeleteLocation($locationId: ID!) {
    deleteLocation(locationId: $locationId)
  }
`;

export default function AdminPage() {
  const [modalOpened, setModalOpened] = useState(false);
  const [editingLocation, setEditingLocation] = useState<LocationData | null>(null);
  const [name, setName] = useState('');
  const [temp, setTemp] = useState<string>('room_temp');

  const { data, refetch } = useQuery<GetLocationsResponse>(GET_LOCATIONS);

  const [createLocation, { loading: creating }] = useMutation(CREATE_LOCATION, {
    onCompleted: () => {
      notifications.show({
        title: 'Success',
        message: 'Location created successfully',
        color: 'green',
      });
      setModalOpened(false);
      setName('');
      setTemp('room_temp');
      refetch();
    },
    onError: (error) => {
      notifications.show({
        title: 'Error',
        message: error.message,
        color: 'red',
      });
    },
  });

  const [updateLocation, { loading: updating }] = useMutation(UPDATE_LOCATION, {
    onCompleted: () => {
      notifications.show({
        title: 'Success',
        message: 'Location updated successfully',
        color: 'green',
      });
      setModalOpened(false);
      setEditingLocation(null);
      setName('');
      setTemp('room_temp');
      refetch();
    },
    onError: (error) => {
      notifications.show({
        title: 'Error',
        message: error.message,
        color: 'red',
      });
    },
  });

  const [deleteLocation] = useMutation(DELETE_LOCATION, {
    onCompleted: () => {
      notifications.show({
        title: 'Success',
        message: 'Location deleted successfully',
        color: 'green',
      });
      refetch();
    },
    onError: (error) => {
      notifications.show({
        title: 'Error',
        message: error.message,
        color: 'red',
      });
    },
  });

  const handleSubmit = () => {
    if (editingLocation) {
      updateLocation({
        variables: {
          input: {
            locationId: editingLocation.locationId,
            name,
            temp: temp as 'fridge' | 'room_temp',
          },
        },
      });
    } else {
      createLocation({
        variables: {
          input: {
            name,
            temp: temp as 'fridge' | 'room_temp',
          },
        },
      });
    }
  };

  const handleEdit = (location: LocationData) => {
    setEditingLocation(location);
    setName(location.name);
    setTemp(location.temp === 'room temp' ? 'room_temp' : 'fridge');
    setModalOpened(true);
  };

  const handleDelete = (locationId: string) => {
    if (confirm('Are you sure you want to delete this location?')) {
      deleteLocation({ variables: { locationId } });
    }
  };

  const openCreateModal = () => {
    setEditingLocation(null);
    setName('');
    setTemp('room_temp');
    setModalOpened(true);
  };

  return (
    <AppShell>
      <Stack gap="xl">
        <Group justify="apart">
          <div>
            <Title order={1}>Admin</Title>
            <Text c="dimmed" size="sm">
              Manage locations and clinic settings
            </Text>
          </div>
          <Button onClick={openCreateModal}>Create Location</Button>
        </Group>

        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Title order={3} mb="md">
            Locations
          </Title>
          {data?.getLocations && data.getLocations.length > 0 ? (
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Name</Table.Th>
                  <Table.Th>Temperature</Table.Th>
                  <Table.Th>Created</Table.Th>
                  <Table.Th>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {data?.getLocations.map((location: LocationData) => (
                  <Table.Tr key={location.locationId}>
                    <Table.Td>{location.name}</Table.Td>
                    <Table.Td>{location.temp}</Table.Td>
                    <Table.Td>{new Date(location.createdAt).toLocaleDateString()}</Table.Td>
                    <Table.Td>
                      <Group gap="xs">
                        <Button size="xs" onClick={() => handleEdit(location)}>
                          Edit
                        </Button>
                        <Button
                          size="xs"
                          color="red"
                          onClick={() => handleDelete(location.locationId)}
                        >
                          Delete
                        </Button>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          ) : (
            <Text c="dimmed">No locations created yet</Text>
          )}
        </Card>

        <Modal
          opened={modalOpened}
          onClose={() => setModalOpened(false)}
          title={editingLocation ? 'Edit Location' : 'Create Location'}
        >
          <Stack>
            <TextInput
              label="Location Name"
              placeholder="e.g., Main Refrigerator"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />

            <Select
              label="Temperature"
              placeholder="Select temperature type"
              required
              data={[
                { value: 'fridge', label: 'Refrigerated (Fridge)' },
                { value: 'room_temp', label: 'Room Temperature' },
              ]}
              value={temp}
              onChange={(value) => setTemp(value || 'room_temp')}
            />

            <Button onClick={handleSubmit} loading={creating || updating}>
              {editingLocation ? 'Update' : 'Create'}
            </Button>
          </Stack>
        </Modal>
      </Stack>
    </AppShell>
  );
}

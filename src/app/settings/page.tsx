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
import { GetUsersResponse, UserData } from '../../types/graphql';

const GET_USERS = gql`
  query GetUsers {
    getUsers {
      userId
      username
      email
      userRole
      createdAt
    }
  }
`;

const INVITE_USER = gql`
  mutation InviteUser($input: InviteUserInput!) {
    inviteUser(input: $input) {
      userId
      username
      email
      userRole
    }
  }
`;

export default function SettingsPage() {
  const [modalOpened, setModalOpened] = useState(false);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [userRole, setUserRole] = useState<string>('employee');

  const { data, refetch } = useQuery<GetUsersResponse>(GET_USERS);

  const [inviteUser, { loading }] = useMutation(INVITE_USER, {
    onCompleted: () => {
      notifications.show({
        title: 'Success',
        message: 'User invited successfully',
        color: 'green',
      });
      setModalOpened(false);
      setEmail('');
      setUsername('');
      setUserRole('employee');
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

  const handleInvite = () => {
    inviteUser({
      variables: {
        input: {
          email,
          username,
          userRole: userRole as 'superadmin' | 'admin' | 'employee',
        },
      },
    });
  };

  return (
    <AppShell>
      <Stack gap="xl">
        <Group justify="apart">
          <div>
            <Title order={1}>Settings</Title>
            <Text c="dimmed" size="sm">
              Manage users and clinic configuration
            </Text>
          </div>
          <Button onClick={() => setModalOpened(true)}>Invite User</Button>
        </Group>

        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Title order={3} mb="md">
            Users
          </Title>
          {data?.getUsers && data.getUsers.length > 0 ? (
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Username</Table.Th>
                  <Table.Th>Email</Table.Th>
                  <Table.Th>Role</Table.Th>
                  <Table.Th>Created</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {data?.getUsers.map((user: UserData) => (
                  <Table.Tr key={user.userId}>
                    <Table.Td>{user.username}</Table.Td>
                    <Table.Td>{user.email}</Table.Td>
                    <Table.Td>{user.userRole}</Table.Td>
                    <Table.Td>{new Date(user.createdAt).toLocaleDateString()}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          ) : (
            <Text c="dimmed">No users found</Text>
          )}
        </Card>

        <Modal
          opened={modalOpened}
          onClose={() => setModalOpened(false)}
          title="Invite New User"
        >
          <Stack>
            <TextInput
              label="Email"
              placeholder="user@example.com"
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <TextInput
              label="Username"
              placeholder="johndoe"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />

            <Select
              label="Role"
              placeholder="Select role"
              required
              data={[
                { value: 'admin', label: 'Admin' },
                { value: 'employee', label: 'Employee' },
              ]}
              value={userRole}
              onChange={(value) => setUserRole(value || 'employee')}
            />

            <Button onClick={handleInvite} loading={loading}>
              Send Invitation
            </Button>
          </Stack>
        </Modal>
      </Stack>
    </AppShell>
  );
}

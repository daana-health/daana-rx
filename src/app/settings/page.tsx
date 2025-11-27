'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSelector, useDispatch } from 'react-redux';
import { useQuery, useMutation, gql } from '@apollo/client';
import { RootState } from '../../store';
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
  Badge,
  ActionIcon,
  Tooltip,
  PasswordInput,
} from '@mantine/core';
import { IconMail, IconTrash, IconCopy, IconPlus } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { AppShell } from '../../components/layout/AppShell';
import { PageHeader } from '../../components/PageHeader';
import { GetUsersResponse, UserData } from '../../types/graphql';
import { setAuth } from '../../store/authSlice';

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

const GET_INVITATIONS = gql`
  query GetInvitations {
    getInvitations {
      invitationId
      email
      userRole
      status
      invitationToken
      createdAt
      expiresAt
      acceptedAt
      invitedByUser {
        username
        email
      }
    }
  }
`;

const SEND_INVITATION = gql`
  mutation SendInvitation($input: SendInvitationInput!) {
    sendInvitation(input: $input) {
      invitationId
      email
      status
      invitationToken
    }
  }
`;

const RESEND_INVITATION = gql`
  mutation ResendInvitation($invitationId: ID!) {
    resendInvitation(invitationId: $invitationId) {
      invitationId
      email
    }
  }
`;

const CANCEL_INVITATION = gql`
  mutation CancelInvitation($invitationId: ID!) {
    cancelInvitation(invitationId: $invitationId)
  }
`;

const CREATE_CLINIC = gql`
  mutation CreateClinic($input: CreateClinicInput!) {
    createClinic(input: $input) {
      token
      user {
        userId
        username
        email
        clinicId
        userRole
      }
      clinic {
        clinicId
        name
        primaryColor
        secondaryColor
        logoUrl
      }
    }
  }
`;

interface Invitation {
  invitationId: string;
  email: string;
  userRole: string;
  status: string;
  invitationToken: string;
  createdAt: string;
  expiresAt: string;
  acceptedAt?: string;
  invitedByUser: {
    username: string;
    email: string;
  };
}

export default function SettingsPage() {
  const router = useRouter();
  const dispatch = useDispatch();
  const { user: currentUser } = useSelector((state: RootState) => state.auth);
  const isSuperadmin = currentUser?.userRole === 'superadmin';
  
  const [modalOpened, setModalOpened] = useState(false);
  const [createClinicModalOpened, setCreateClinicModalOpened] = useState(false);
  const [email, setEmail] = useState('');
  const [userRole, setUserRole] = useState<string>('employee');
  const [newClinicName, setNewClinicName] = useState('');
  const [password, setPassword] = useState('');

  // Only fetch user management data for superadmins
  const { data: usersData } = useQuery<GetUsersResponse>(GET_USERS, {
    skip: !isSuperadmin,
  });
  const { data: invitationsData, refetch: refetchInvitations } = useQuery<{
    getInvitations: Invitation[];
  }>(GET_INVITATIONS, {
    skip: !isSuperadmin,
  });

  const [sendInvitation, { loading }] = useMutation(SEND_INVITATION, {
    onCompleted: (data) => {
      const invitationUrl = `${window.location.origin}/auth/signup?invitation=${data.sendInvitation.invitationToken}`;
      
      // Copy to clipboard
      navigator.clipboard.writeText(invitationUrl).then(() => {
        notifications.show({
          title: 'Invitation Created!',
          message: 'Invitation link copied to clipboard. Share it with the user.',
          color: 'green',
          autoClose: 8000,
        });
      }).catch(() => {
        notifications.show({
          title: 'Invitation Created!',
          message: `Share this link: ${invitationUrl}`,
          color: 'green',
          autoClose: false,
        });
      });
      
      setModalOpened(false);
      setEmail('');
      setUserRole('employee');
      refetchInvitations();
    },
    onError: (error) => {
      notifications.show({
        title: 'Error',
        message: error.message,
        color: 'red',
      });
    },
  });

  const [resendInvitation] = useMutation(RESEND_INVITATION, {
    onCompleted: () => {
      notifications.show({
        title: 'Success',
        message: 'Invitation resent successfully',
        color: 'green',
      });
      refetchInvitations();
    },
    onError: (error) => {
      notifications.show({
        title: 'Error',
        message: error.message,
        color: 'red',
      });
    },
  });

  const [cancelInvitation] = useMutation(CANCEL_INVITATION, {
    onCompleted: () => {
      notifications.show({
        title: 'Success',
        message: 'Invitation cancelled successfully',
        color: 'green',
      });
      refetchInvitations();
    },
    onError: (error) => {
      notifications.show({
        title: 'Error',
        message: error.message,
        color: 'red',
      });
    },
  });

  const [createClinic, { loading: createClinicLoading }] = useMutation(CREATE_CLINIC, {
    onCompleted: (data) => {
      dispatch(
        setAuth({
          user: data.createClinic.user,
          clinic: data.createClinic.clinic,
          token: data.createClinic.token,
        })
      );

      notifications.show({
        title: 'Success',
        message: `Clinic "${data.createClinic.clinic.name}" created successfully!`,
        color: 'green',
      });

      setCreateClinicModalOpened(false);
      setNewClinicName('');
      setPassword('');

      // Reload the page to switch to the new clinic
      router.push('/');
    },
    onError: (error) => {
      notifications.show({
        title: 'Error',
        message: error.message,
        color: 'red',
      });
    },
  });

  const handleSendInvitation = () => {
    if (!email || !userRole) {
      notifications.show({
        title: 'Error',
        message: 'Please fill in all fields',
        color: 'red',
      });
      return;
    }

    sendInvitation({
      variables: {
        input: {
          email,
          userRole,
        },
      },
    });
  };

  const handleResend = (invitationId: string) => {
    resendInvitation({
      variables: { invitationId },
    });
  };

  const handleCancel = (invitationId: string) => {
    cancelInvitation({
      variables: { invitationId },
    });
  };

  const handleCreateClinic = () => {
    if (!newClinicName || !password) {
      notifications.show({
        title: 'Error',
        message: 'Please fill in all fields',
        color: 'red',
      });
      return;
    }

    createClinic({
      variables: {
        input: {
          name: newClinicName,
          password,
        },
      },
    });
  };

  const copyInvitationLink = (invitationToken: string, email: string) => {
    const invitationUrl = `${window.location.origin}/auth/signup?invitation=${invitationToken}`;

    navigator.clipboard.writeText(invitationUrl).then(() => {
      notifications.show({
        title: 'Link Copied!',
        message: `Invitation link for ${email} copied to clipboard`,
        color: 'green',
      });
    }).catch(() => {
      notifications.show({
        title: 'Copy Failed',
        message: invitationUrl,
        color: 'yellow',
        autoClose: false,
      });
    });
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      invited: 'blue',
      accepted: 'green',
      expired: 'red',
    };
    return (
      <Badge color={colors[status] || 'gray'} variant="light">
        {status.toUpperCase()}
      </Badge>
    );
  };

  return (
    <AppShell>
      <Stack gap="xl">
        <Group justify="space-between" align="flex-start">
          <PageHeader 
            title="Settings" 
            description={isSuperadmin ? "Manage users and clinic configuration" : "Create and manage your clinics"} 
            showBackButton={true} 
          />
          <Group>
            <Button
              onClick={() => setCreateClinicModalOpened(true)}
              size="md"
              mt={4}
              variant="light"
              leftSection={<IconPlus size={16} />}
            >
              Create New Clinic
            </Button>
            {isSuperadmin && (
              <Button onClick={() => setModalOpened(true)} size="md" mt={4}>
                Send Invitation
              </Button>
            )}
          </Group>
        </Group>

        {/* Invitations Card - Superadmin only */}
        {isSuperadmin && (
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Title order={3} mb="md">
              Pending Invitations
            </Title>
            {invitationsData?.getInvitations && invitationsData.getInvitations.length > 0 ? (
              <Table highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Email</Table.Th>
                    <Table.Th>Role</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th>Invited By</Table.Th>
                    <Table.Th>Sent</Table.Th>
                    <Table.Th>Expires</Table.Th>
                    <Table.Th>Actions</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {invitationsData.getInvitations.map((invitation) => (
                    <Table.Tr key={invitation.invitationId}>
                      <Table.Td>{invitation.email}</Table.Td>
                      <Table.Td>
                        <Badge variant="outline">{invitation.userRole}</Badge>
                      </Table.Td>
                      <Table.Td>{getStatusBadge(invitation.status)}</Table.Td>
                      <Table.Td>{invitation.invitedByUser.username}</Table.Td>
                      <Table.Td>{new Date(invitation.createdAt).toLocaleDateString()}</Table.Td>
                      <Table.Td>
                        {invitation.status === 'invited' ? (
                          <Text size="sm">
                            {new Date(invitation.expiresAt).toLocaleDateString()}
                          </Text>
                        ) : invitation.acceptedAt ? (
                          <Text size="sm" c="green">
                            Accepted {new Date(invitation.acceptedAt).toLocaleDateString()}
                          </Text>
                        ) : (
                          <Text size="sm" c="red">
                            Expired
                          </Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Group gap="xs">
                          {invitation.status === 'invited' && (
                            <>
                              <Tooltip label="Copy invitation link">
                                <ActionIcon
                                  variant="light"
                                  color="grape"
                                  onClick={() => copyInvitationLink(invitation.invitationToken, invitation.email)}
                                >
                                  <IconCopy size={16} />
                                </ActionIcon>
                              </Tooltip>
                              <Tooltip label="Resend invitation">
                                <ActionIcon
                                  variant="light"
                                  color="blue"
                                  onClick={() => handleResend(invitation.invitationId)}
                                >
                                  <IconMail size={16} />
                                </ActionIcon>
                              </Tooltip>
                              <Tooltip label="Cancel invitation">
                                <ActionIcon
                                  variant="light"
                                  color="red"
                                  onClick={() => handleCancel(invitation.invitationId)}
                                >
                                  <IconTrash size={16} />
                                </ActionIcon>
                              </Tooltip>
                            </>
                          )}
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            ) : (
              <Text c="dimmed">No pending invitations</Text>
            )}
          </Card>
        )}

        {/* Users Card - Superadmin only */}
        {isSuperadmin && (
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Title order={3} mb="md">
              Active Users
            </Title>
            {usersData?.getUsers && usersData.getUsers.length > 0 ? (
              <Table highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Username</Table.Th>
                    <Table.Th>Email</Table.Th>
                    <Table.Th>Role</Table.Th>
                    <Table.Th>Created</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {usersData.getUsers.map((user: UserData) => (
                    <Table.Tr key={user.userId}>
                      <Table.Td>{user.username}</Table.Td>
                      <Table.Td>{user.email}</Table.Td>
                      <Table.Td>
                        <Badge variant="outline">{user.userRole}</Badge>
                      </Table.Td>
                      <Table.Td>{new Date(user.createdAt).toLocaleDateString()}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            ) : (
              <Text c="dimmed">No users found</Text>
            )}
          </Card>
        )}

        {/* Invitation Modal - Superadmin only */}
        {isSuperadmin && (
          <Modal
            opened={modalOpened}
            onClose={() => setModalOpened(false)}
            title="Send Invitation"
            size="md"
          >
            <Stack>
              <Text size="sm" c="dimmed">
                Send an invitation email to a new user. They will receive a link to create their
                account and join your clinic.
              </Text>

              <TextInput
                label="Email Address"
                placeholder="user@example.com"
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                description="The user will receive an invitation email at this address"
              />

              <Select
                label="User Role"
                placeholder="Select role"
                required
                data={[
                  { value: 'admin', label: 'Admin' },
                  { value: 'employee', label: 'Employee' },
                ]}
                value={userRole}
                onChange={(value) => setUserRole(value || 'employee')}
                description="Admin can manage users, Employee has limited access"
              />

              <Group justify="flex-end" mt="md">
                <Button variant="subtle" onClick={() => setModalOpened(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSendInvitation} loading={loading}>
                  Send Invitation
                </Button>
              </Group>
            </Stack>
          </Modal>
        )}

        {/* Create New Clinic Modal */}
        <Modal
          opened={createClinicModalOpened}
          onClose={() => setCreateClinicModalOpened(false)}
          title="Create New Clinic"
          size="md"
        >
          <Stack>
            <Text size="sm" c="dimmed">
              Create a new clinic and become its superadmin. You'll be able to switch between your clinics using the clinic switcher in the top left.
            </Text>

            <TextInput
              label="Clinic Name"
              placeholder="My New Clinic"
              required
              value={newClinicName}
              onChange={(e) => setNewClinicName(e.target.value)}
              description="Choose a name for your new clinic"
            />

            <PasswordInput
              label="Your Password"
              placeholder="Enter your password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              description="Verify your identity by entering your account password"
            />

            <Group justify="flex-end" mt="md">
              <Button variant="subtle" onClick={() => setCreateClinicModalOpened(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateClinic} loading={createClinicLoading}>
                Create Clinic
              </Button>
            </Group>
          </Stack>
        </Modal>
      </Stack>
    </AppShell>
  );
}

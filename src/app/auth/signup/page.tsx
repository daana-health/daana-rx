'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useDispatch } from 'react-redux';
import { 
  TextInput, 
  PasswordInput, 
  Button, 
  Paper, 
  Title, 
  Container, 
  Text, 
  Anchor, 
  Stack,
  Alert,
  Loader,
  Center
} from '@mantine/core';
import { IconInfoCircle } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useMutation, useQuery, gql } from '@apollo/client';
import { setAuth } from '../../../store/authSlice';

const SIGN_UP_MUTATION = gql`
  mutation SignUp($input: SignUpInput!) {
    signUp(input: $input) {
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

const ACCEPT_INVITATION_MUTATION = gql`
  mutation AcceptInvitation($input: AcceptInvitationInput!) {
    acceptInvitation(input: $input) {
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

const GET_INVITATION_BY_TOKEN = gql`
  query GetInvitationByToken($invitationToken: ID!) {
    getInvitationByToken(invitationToken: $invitationToken) {
      invitationId
      email
      userRole
      status
      expiresAt
      clinic {
        clinicId
        name
        primaryColor
        secondaryColor
        logoUrl
      }
      invitedByUser {
        username
      }
    }
  }
`;

function SignUpContent() {
  const searchParams = useSearchParams();
  const invitationToken = searchParams.get('invitation');
  
  return invitationToken ? (
    <AcceptInvitationForm invitationToken={invitationToken} />
  ) : (
    <RegularSignUpForm />
  );
}

function AcceptInvitationForm({ invitationToken }: { invitationToken: string }) {
  const router = useRouter();
  const dispatch = useDispatch();
  const [password, setPassword] = useState('');

  const { data: invitationData, loading: invitationLoading, error: invitationError } = useQuery(
    GET_INVITATION_BY_TOKEN,
    {
      variables: { invitationToken },
      fetchPolicy: 'network-only',
    }
  );

  const [acceptInvitation, { loading }] = useMutation(ACCEPT_INVITATION_MUTATION, {
    onCompleted: (data) => {
      dispatch(
        setAuth({
          user: data.acceptInvitation.user,
          clinic: data.acceptInvitation.clinic,
          token: data.acceptInvitation.token,
        })
      );

      notifications.show({
        title: 'Success',
        message: 'Welcome to DaanaRX!',
        color: 'green',
      });

      router.push('/');
    },
    onError: (error) => {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to accept invitation',
        color: 'red',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    acceptInvitation({
      variables: {
        input: {
          invitationToken,
          password,
        },
      },
    });
  };

  if (invitationLoading) {
    return (
      <Container size={420} my={40}>
        <Center>
          <Loader size="lg" />
        </Center>
        <Text ta="center" mt="md" c="dimmed">
          Loading invitation...
        </Text>
      </Container>
    );
  }

  if (invitationError || !invitationData?.getInvitationByToken) {
    return (
      <Container size={420} my={40}>
        <Title ta="center" mb="md">
          DaanaRX
        </Title>

        <Paper withBorder shadow="md" p={30} radius="md">
          <Alert icon={<IconInfoCircle size={16} />} title="Invalid Invitation" color="red">
            This invitation link is invalid or has expired. Please contact your administrator for a
            new invitation.
          </Alert>

          <Button
            fullWidth
            mt="md"
            variant="outline"
            onClick={() => router.push('/auth/signin')}
          >
            Go to Sign In
          </Button>
        </Paper>
      </Container>
    );
  }

  const invitation = invitationData.getInvitationByToken;

  return (
    <Container size={420} my={40}>
      <Title ta="center" mb="md">
        DaanaRx
      </Title>
      <Text c="dimmed" size="sm" ta="center" mb="xl">
        Complete your account setup
      </Text>

      <Paper withBorder shadow="md" p={30} radius="md">
        <Alert icon={<IconInfoCircle size={16} />} title="You've been invited!" color="blue" mb="lg">
          <Text size="sm">
            <strong>{invitation.invitedByUser.username}</strong> has invited you to join{' '}
            <strong>{invitation.clinic?.name || 'the clinic'}</strong> as a{' '}
            <strong>{invitation.userRole}</strong>.
          </Text>
        </Alert>

        <form onSubmit={handleSubmit}>
          <Stack>
            <TextInput
              label="Clinic Name"
              value={invitation.clinic?.name || ''}
              disabled
              description="You're joining this clinic"
            />

            <TextInput
              label="Email"
              value={invitation.email}
              disabled
              description="Your account email address"
            />

            <PasswordInput
              label="Create Password"
              placeholder="Choose a secure password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              description="Choose a strong password to secure your account"
            />

            <Button type="submit" fullWidth loading={loading} mt="md">
              Complete Sign Up
            </Button>

            <Text size="xs" c="dimmed" ta="center">
              By signing up, you agree to join the clinic and follow their policies.
            </Text>
          </Stack>
        </form>
      </Paper>
    </Container>
  );
}

function RegularSignUpForm() {
  const router = useRouter();
  const dispatch = useDispatch();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [clinicName, setClinicName] = useState('');

  const [signUp, { loading }] = useMutation(SIGN_UP_MUTATION, {
    onCompleted: (data) => {
      dispatch(
        setAuth({
          user: data.signUp.user,
          clinic: data.signUp.clinic,
          token: data.signUp.token,
        })
      );

      notifications.show({
        title: 'Success',
        message: 'Account created successfully',
        color: 'green',
      });

      router.push('/');
    },
    onError: (error) => {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to create account',
        color: 'red',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    signUp({ variables: { input: { email, password, clinicName } } });
  };

  return (
    <Container size={420} my={40}>
      <Title ta="center" mb="md">
        DaanaRx
      </Title>
      <Text c="dimmed" size="sm" ta="center" mb="xl">
        Create your clinic account
      </Text>

      <Paper withBorder shadow="md" p={30} radius="md">
        <form onSubmit={handleSubmit}>
          <Stack>
            <TextInput
              label="Clinic Name"
              placeholder="Your Clinic Name"
              required
              value={clinicName}
              onChange={(e) => setClinicName(e.target.value)}
            />

            <TextInput
              label="Email"
              placeholder="your@email.com"
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <PasswordInput
              label="Password"
              placeholder="Create a password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            <Button type="submit" fullWidth loading={loading}>
              Create Account
            </Button>

            <Text size="sm" ta="center">
              Already have an account?{' '}
              <Anchor href="/auth/signin" size="sm">
                Sign in
              </Anchor>
            </Text>
          </Stack>
        </form>
      </Paper>
    </Container>
  );
}

export default function SignUpPage() {
  return (
    <Suspense
      fallback={
        <Container size={420} my={40}>
          <Center>
            <Loader size="lg" />
          </Center>
        </Container>
      }
    >
      <SignUpContent />
    </Suspense>
  );
}

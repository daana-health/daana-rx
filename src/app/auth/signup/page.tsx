'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDispatch } from 'react-redux';
import { TextInput, PasswordInput, Button, Paper, Title, Container, Text, Anchor, Stack } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useMutation, gql } from '@apollo/client';
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

export default function SignUpPage() {
  const router = useRouter();
  const dispatch = useDispatch();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [clinicName, setClinicName] = useState('');

  const [signUp, { loading }] = useMutation(SIGN_UP_MUTATION, {
    onCompleted: (data) => {
      dispatch(setAuth({
        user: data.signUp.user,
        clinic: data.signUp.clinic,
        token: data.signUp.token,
      }));

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

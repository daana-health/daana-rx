'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDispatch } from 'react-redux';
import { TextInput, PasswordInput, Button, Paper, Title, Container, Text, Anchor, Stack } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useMutation, gql } from '@apollo/client';
import { setAuth } from '../../../store/authSlice';

const SIGN_IN_MUTATION = gql`
  mutation SignIn($input: SignInInput!) {
    signIn(input: $input) {
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

export default function SignInPage() {
  const router = useRouter();
  const dispatch = useDispatch();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [signIn, { loading }] = useMutation(SIGN_IN_MUTATION, {
    onCompleted: (data) => {
      dispatch(setAuth({
        user: data.signIn.user,
        clinic: data.signIn.clinic,
        token: data.signIn.token,
      }));

      notifications.show({
        title: 'Success',
        message: 'Signed in successfully',
        color: 'green',
      });

      router.push('/');
    },
    onError: (error) => {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to sign in',
        color: 'red',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    signIn({ variables: { input: { email, password } } });
  };

  return (
    <Container size={420} my={40}>
      <Title ta="center" mb="md">
        DaanaRx
      </Title>
      <Text c="dimmed" size="sm" ta="center" mb="xl">
        Medication Tracking System
      </Text>

      <Paper withBorder shadow="md" p={30} radius="md">
        <form onSubmit={handleSubmit}>
          <Stack>
            <TextInput
              label="Email"
              placeholder="your@email.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <PasswordInput
              label="Password"
              placeholder="Your password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            <Button type="submit" fullWidth loading={loading}>
              Sign In
            </Button>

            <Text size="sm" ta="center">
              Don&apos;t have an account?{' '}
              <Anchor href="/auth/signup" size="sm">
                Sign up
              </Anchor>
            </Text>
          </Stack>
        </form>
      </Paper>
    </Container>
  );
}

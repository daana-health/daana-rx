'use client';

import { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useLazyQuery, gql } from '@apollo/client';
import { Center, Loader, Stack, Text, Progress } from '@mantine/core';
import { RootState } from '../store';
import { setAuth } from '../store/authSlice';

// Query to prefetch all essential data
const PREFETCH_DATA = gql`
  query PrefetchData {
    me {
      userId
      username
      email
      clinicId
      userRole
    }
    getClinic {
      clinicId
      name
      primaryColor
      secondaryColor
      logoUrl
    }
    getDashboardStats {
      totalUnits
      unitsExpiringSoon
      recentCheckIns
      recentCheckOuts
      lowStockAlerts
    }
    getLocations {
      locationId
      name
      temp
    }
  }
`;

// Query to get all user's clinics
const GET_USER_CLINICS = gql`
  query GetUserClinics {
    getUserClinics {
      clinicId
      name
      primaryColor
      secondaryColor
      logoUrl
      userRole
      joinedAt
    }
  }
`;

interface AppInitializerProps {
  children: React.ReactNode;
}

export function AppInitializer({ children }: AppInitializerProps) {
  const dispatch = useDispatch();
  const { isAuthenticated, hasHydrated, user, clinic } = useSelector((state: RootState) => state.auth);
  const [isInitialized, setIsInitialized] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('Initializing...');

  const [prefetchData] = useLazyQuery(PREFETCH_DATA, {
    fetchPolicy: 'network-only',
    onCompleted: () => {
      setLoadingProgress(60);
      setLoadingMessage('Loading your clinics...');
    },
    onError: (error) => {
      console.error('Prefetch error:', error);
      setIsInitialized(true);
    },
  });

  const [getUserClinics] = useLazyQuery(GET_USER_CLINICS, {
    fetchPolicy: 'network-only',
    onCompleted: (data) => {
      setLoadingProgress(100);
      setLoadingMessage('Ready!');

      // Update auth state with all clinics
      if (user && clinic && data.getUserClinics) {
        dispatch(
          setAuth({
            user,
            clinic,
            token: localStorage.getItem('authToken') || '',
            clinics: data.getUserClinics,
          })
        );
      }

      setTimeout(() => setIsInitialized(true), 300);
    },
    onError: (error) => {
      console.error('Get user clinics error:', error);
      setIsInitialized(true);
    },
  });

  useEffect(() => {
    const initializeApp = async () => {
      if (!isAuthenticated || !hasHydrated) {
        setIsInitialized(true);
        return;
      }

      setLoadingProgress(20);
      setLoadingMessage('Loading your data...');

      try {
        // Prefetch essential data
        await prefetchData();

        setLoadingProgress(50);
        setLoadingMessage('Loading clinic information...');

        // Get all user's clinics
        await getUserClinics();
      } catch (error) {
        console.error('App initialization error:', error);
        setIsInitialized(true);
      }
    };

    // Only initialize once
    if (!isInitialized && hasHydrated) {
      initializeApp();
    }
  }, [isAuthenticated, hasHydrated, isInitialized, prefetchData, getUserClinics]);

  // Show loading screen while initializing
  if (isAuthenticated && !isInitialized) {
    return (
      <Center h="100vh" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
        <Stack align="center" gap="lg">
          <Loader size="xl" color="white" />
          <Text size="xl" fw={600} c="white">
            DaanaRX
          </Text>
          <Stack w={300} gap="xs">
            <Progress value={loadingProgress} color="white" size="sm" radius="xl" animated />
            <Text size="sm" c="white" ta="center">
              {loadingMessage}
            </Text>
          </Stack>
        </Stack>
      </Center>
    );
  }

  return <>{children}</>;
}

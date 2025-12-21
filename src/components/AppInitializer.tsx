'use client';

import { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useLazyQuery, gql } from '@apollo/client';
import { apolloClient } from '../lib/apollo';
import { RootState } from '../store';
import { setAuth } from '../store/authSlice';
import { Progress } from '@/components/ui/progress';
import { Loader2, Package } from 'lucide-react';

// Query to prefetch all essential data
const PREFETCH_DATA = gql`
  query PrefetchData($clinicId: ID) {
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
    getDashboardStats(clinicId: $clinicId) {
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

  const [prefetchData, { data: prefetchDataResult, error: prefetchError }] = useLazyQuery(PREFETCH_DATA, {
    fetchPolicy: 'cache-first', // Use cache if available
  });

  const [getUserClinics, { data: clinicsData, error: clinicsError }] = useLazyQuery(GET_USER_CLINICS, {
    fetchPolicy: 'cache-first', // Use cache if available
  });

  // Handle prefetch data completion
  useEffect(() => {
    if (prefetchDataResult) {
      setLoadingProgress(60);
      setLoadingMessage('Loading your clinics...');
    }
  }, [prefetchDataResult]);

  // Handle prefetch errors
  useEffect(() => {
    if (prefetchError) {
      console.error('Prefetch error:', prefetchError);
      setIsInitialized(true);
    }
  }, [prefetchError]);

  // Handle user clinics data completion
  useEffect(() => {
    if (clinicsData?.getUserClinics) {
      setLoadingProgress(100);
      setLoadingMessage('Ready!');

      // Update auth state with all clinics
      if (user && clinic) {
        dispatch(
          setAuth({
            user,
            clinic,
            token: localStorage.getItem('authToken') || '',
            clinics: clinicsData.getUserClinics,
          })
        );
      }

      setTimeout(() => setIsInitialized(true), 300);
    }
  }, [clinicsData, user, clinic, dispatch]);

  // Handle clinics errors
  useEffect(() => {
    if (clinicsError) {
      console.error('Get user clinics error:', clinicsError);
      setIsInitialized(true);
    }
  }, [clinicsError]);

  useEffect(() => {
    const initializeApp = async () => {
      if (!isAuthenticated || !hasHydrated) {
        setIsInitialized(true);
        return;
      }

      // Check if data is already in cache by trying to read it synchronously
      try {
        const cachedPrefetchData = apolloClient.readQuery({
          query: PREFETCH_DATA,
          variables: { clinicId: clinic?.clinicId },
        });
        const cachedClinicsData = apolloClient.readQuery({ query: GET_USER_CLINICS });
        
        // If both queries are cached, skip loading and initialize immediately
        if (cachedPrefetchData && cachedClinicsData) {
          console.log('Using cached data, skipping initialization fetch');
          
          // Update auth state with cached clinics
          if (user && clinic && cachedClinicsData.getUserClinics) {
            dispatch(
              setAuth({
                user,
                clinic,
                token: localStorage.getItem('authToken') || '',
                clinics: cachedClinicsData.getUserClinics,
              })
            );
          }
          
          setIsInitialized(true);
          return;
        }
      } catch (e) {
        // Cache miss, continue with normal initialization
        console.log('Cache miss, fetching data...');
      }

      setLoadingProgress(20);
      setLoadingMessage('Loading your data...');

      try {
        // Prefetch essential data
        await prefetchData({ variables: { clinicId: clinic?.clinicId } });

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
  }, [isAuthenticated, hasHydrated, isInitialized, prefetchData, getUserClinics, user, clinic, dispatch]);

  // Show loading screen while initializing
  if (isAuthenticated && !isInitialized) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-blue-600 to-purple-700">
        <div className="flex flex-col items-center gap-6">
          <div className="relative">
            <Loader2 className="h-16 w-16 animate-spin text-white" />
            <Package className="absolute inset-0 m-auto h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">DaanaRX</h1>
          <div className="w-[300px] space-y-2">
            <Progress value={loadingProgress} className="h-2 bg-white/20" />
            <p className="text-center text-sm text-white">{loadingMessage}</p>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

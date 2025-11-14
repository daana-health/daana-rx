import { useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useRouter, usePathname } from 'next/navigation';
import { logout, refreshActivity, RootState } from '../store/authSlice';

const ACTIVITY_CHECK_INTERVAL = 60 * 1000; // Check every minute
const INACTIVITY_TIMEOUT = 2 * 60 * 60 * 1000; // 2 hours in milliseconds

export function useAuth() {
  const dispatch = useDispatch();
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, lastActivity, hasHydrated } = useSelector(
    (state: RootState) => state.auth
  );

  // Track user activity
  const handleActivity = useCallback(() => {
    if (isAuthenticated) {
      dispatch(refreshActivity());
    }
  }, [dispatch, isAuthenticated]);

  // Set up activity listeners
  useEffect(() => {
    if (!isAuthenticated || !hasHydrated) return;

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    
    events.forEach((event) => {
      window.addEventListener(event, handleActivity);
    });

    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [isAuthenticated, hasHydrated, handleActivity]);

  // Check for inactivity timeout
  useEffect(() => {
    if (!isAuthenticated || !hasHydrated || !lastActivity) return;

    const checkInactivity = () => {
      const now = Date.now();
      const timeSinceLastActivity = now - lastActivity;

      if (timeSinceLastActivity >= INACTIVITY_TIMEOUT) {
        dispatch(logout());
        router.push('/auth/signin?timeout=true');
      }
    };

    const intervalId = setInterval(checkInactivity, ACTIVITY_CHECK_INTERVAL);

    return () => clearInterval(intervalId);
  }, [isAuthenticated, hasHydrated, lastActivity, dispatch, router]);

  // Redirect to login if not authenticated (except on auth pages)
  useEffect(() => {
    if (!hasHydrated) return;

    const isAuthPage = pathname?.startsWith('/auth/');
    
    if (!isAuthenticated && !isAuthPage) {
      router.push('/auth/signin');
    }
  }, [isAuthenticated, hasHydrated, pathname, router]);

  return {
    isAuthenticated,
    hasHydrated,
  };
}


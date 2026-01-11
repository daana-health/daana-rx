import { ApolloClient, InMemoryCache, createHttpLink, from } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { onError } from '@apollo/client/link/error';
import { store } from '../store';
import { logout } from '../store/authSlice';

const httpLink = createHttpLink({
  uri: process.env.NEXT_PUBLIC_GRAPHQL_URL || 'https://daanarx-backend.onrender.com/graphql',
});

const authLink = setContext((_, { headers }) => {
  if (typeof window === 'undefined') {
    return { headers };
  }

  // Get token and active clinic from localStorage
  const token = localStorage.getItem('authToken');
  const clinicStr = localStorage.getItem('clinic');
  let activeClinicId: string | null = null;

  if (clinicStr) {
    try {
      const clinic = JSON.parse(clinicStr);
      activeClinicId = clinic.clinicId;
    } catch {
      // Ignore parse errors
    }
  }

  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : '',
      ...(activeClinicId && { 'x-clinic-id': activeClinicId }),
    },
  };
});

const errorLink = onError(({ graphQLErrors, networkError }) => {
  if (graphQLErrors) {
    graphQLErrors.forEach(({ message, locations, path, extensions }) => {
      console.error(`[GraphQL error]: Message: ${message}, Location: ${locations}, Path: ${path}`);
      
      // Check for authentication errors
      const code = extensions?.code as string;
      if (
        code === 'UNAUTHENTICATED' ||
        message.toLowerCase().includes('not authenticated') ||
        message.toLowerCase().includes('invalid token') ||
        message.toLowerCase().includes('token expired') ||
        message.toLowerCase().includes('jwt expired')
      ) {
        // Determine the specific reason
        let reason = 'session_expired';
        if (message.toLowerCase().includes('token expired') || message.toLowerCase().includes('jwt expired')) {
          reason = 'token_expired';
        } else if (message.toLowerCase().includes('invalid token')) {
          reason = 'invalid_token';
        }
        
        // Logout user and redirect to signin
        if (typeof window !== 'undefined') {
          store.dispatch(logout(reason));
          window.location.href = `/auth/signin?reason=${reason}`;
        }
      }
    });
  }

  if (networkError) {
    console.error(`[Network error]: ${networkError}`);
    
    // Check for 401 Unauthorized
    if ('statusCode' in networkError && networkError.statusCode === 401) {
      if (typeof window !== 'undefined') {
        store.dispatch(logout('invalid_token'));
        window.location.href = '/auth/signin?reason=invalid_token';
      }
    }
  }
});

export const apolloClient = new ApolloClient({
  link: from([errorLink, authLink, httpLink]),
  cache: new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          // Configure how individual queries should be cached
          getUnits: {
            // Merge incoming data with existing cache
            merge(_existing, incoming) {
              return incoming;
            },
          },
          getDashboardStats: {
            merge(_existing, incoming) {
              return incoming;
            },
          },
        },
      },
    },
  }),
  defaultOptions: {
    watchQuery: {
      fetchPolicy: 'cache-first', // Use cache first, only fetch if not cached
      nextFetchPolicy: 'cache-first', // Keep using cache after initial fetch
    },
    query: {
      fetchPolicy: 'cache-first', // Use cache for all queries
      errorPolicy: 'all', // Return both data and errors
    },
    mutate: {
      errorPolicy: 'all',
    },
  },
});

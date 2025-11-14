'use client';

import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { ApolloProvider } from '@apollo/client';
import { Provider } from 'react-redux';
import { apolloClient } from '../lib/apollo';
import { store } from '../store';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <Provider store={store}>
      <ApolloProvider client={apolloClient!}>
        <MantineProvider>
          <Notifications position="top-right" />
          {children}
        </MantineProvider>
      </ApolloProvider>
    </Provider>
  );
}

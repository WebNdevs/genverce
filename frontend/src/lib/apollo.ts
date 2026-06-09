import { ApolloClient, ApolloLink, InMemoryCache, Observable, createHttpLink, makeVar } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { onError } from '@apollo/client/link/error';
import { useAuthStore } from './auth';

export const globalNetworkActivityVar = makeVar(0);

const httpLink = createHttpLink({
  uri: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/graphql`,
});

const authLink = setContext((_, { headers }) => {
  let token = '';
  if (typeof window !== 'undefined') {
    token = localStorage.getItem('genverce_token') || '';
  }

  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : '',
    },
  };
});

const errorLink = onError(({ graphQLErrors, networkError }) => {
  let isUnauthorized = false;
  if (graphQLErrors) {
    for (const err of graphQLErrors) {
      if (err.extensions?.code === 'UNAUTHENTICATED' || err.message.toLowerCase().includes('unauthorized')) {
        isUnauthorized = true;
      }
    }
  }
  if (networkError && 'statusCode' in networkError && networkError.statusCode === 401) {
    isUnauthorized = true;
  }

  if (isUnauthorized && typeof window !== 'undefined') {
    useAuthStore.getState().logout();
    if (!window.location.pathname.startsWith('/login') && !window.location.pathname.startsWith('/signup')) {
      window.location.href = '/login';
    }
  }
});

const loadingLink = new ApolloLink((operation, forward) => {
  if (!forward) return null;
  globalNetworkActivityVar(globalNetworkActivityVar() + 1);

  return new Observable((observer) => {
    const sub = forward(operation).subscribe({
      next: (value) => observer.next(value),
      error: (err) => observer.error(err),
      complete: () => observer.complete(),
    });

    return () => {
      globalNetworkActivityVar(Math.max(0, globalNetworkActivityVar() - 1));
      sub.unsubscribe();
    };
  });
});

export const apolloClient = new ApolloClient({
  link: ApolloLink.from([loadingLink, errorLink, authLink.concat(httpLink)]),
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: { fetchPolicy: 'cache-and-network' },
  },
});

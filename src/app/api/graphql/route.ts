import { ApolloServer } from '@apollo/server';
import { HeaderMap } from '@apollo/server';
import { NextRequest, NextResponse } from 'next/server';
import { typeDefs, resolvers } from '../../../../../server/graphql';
import { createGraphQLContext } from '../../../../../server/middleware';

const server = new ApolloServer({
  typeDefs,
  resolvers,
  introspection: true,
  formatError: (error) => {
    console.error('GraphQL Error:', error);
    return {
      message: error.message,
      code: error.extensions?.code || 'INTERNAL_SERVER_ERROR',
    };
  },
});

// Start the server (only once)
const serverStart = server.start();

async function handleRequest(req: NextRequest) {
  await serverStart;

  const body = await req.text();
  const headers = new HeaderMap();
  req.headers.forEach((value, key) => {
    headers.set(key, value);
  });

  const httpGraphQLResponse = await server.executeHTTPGraphQLRequest({
    httpGraphQLRequest: {
      method: req.method!.toUpperCase(),
      headers,
      body,
      search: req.nextUrl.search,
    },
    context: async () => createGraphQLContext({ req }),
  });

  const responseHeaders: Record<string, string> = {};
  for (const [key, value] of httpGraphQLResponse.headers) {
    responseHeaders[key] = value;
  }

  // Convert body to string
  const bodyString = httpGraphQLResponse.body.kind === 'complete'
    ? httpGraphQLResponse.body.string
    : '';

  return new NextResponse(bodyString, {
    status: httpGraphQLResponse.status || 200,
    headers: responseHeaders,
  });
}

export async function GET(req: NextRequest) {
  return handleRequest(req);
}

export async function POST(req: NextRequest) {
  return handleRequest(req);
}


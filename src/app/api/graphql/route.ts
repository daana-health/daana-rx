import { ApolloServer } from '@apollo/server';
import { NextRequest, NextResponse } from 'next/server';
import { typeDefs, resolvers } from '@server/graphql';
import { createGraphQLContextFromNextRequest } from '@server/middleware';

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

const serverStartPromise = server.start();

async function handler(req: NextRequest) {
  await serverStartPromise;

  try {
    const body = await req.json();

    const result = await server.executeOperation(
      {
        query: body.query,
        variables: body.variables,
        operationName: body.operationName,
      },
      {
        contextValue: await createGraphQLContextFromNextRequest(req),
      }
    );

    // Handle the response based on kind
    if (result.body.kind === 'single') {
      return NextResponse.json(result.body.singleResult, {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    // For incremental responses, return the initial result
    return NextResponse.json(
      { errors: [{ message: 'Incremental responses not supported' }] },
      { status: 500 }
    );
  } catch (error) {
    console.error('GraphQL request error:', error);
    return NextResponse.json(
      {
        errors: [
          {
            message: 'Internal server error',
            extensions: { code: 'INTERNAL_SERVER_ERROR' },
          },
        ],
      },
      { status: 500 }
    );
  }
}

export { handler as GET, handler as POST };


import express from 'express';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { typeDefs, resolvers } from './graphql/index.js';
import { authMiddleware, createGraphQLContext } from './middleware/index.js';

const PORT = process.env.GRAPHQL_PORT || process.env.PORT || 4000;

async function startServer() {
  const app = express();
  const httpServer = http.createServer(app);

  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
    crossOriginEmbedderPolicy: false,
  }));

  // CORS configuration
  app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true,
  }));

  // Rate limiting
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
  });
  app.use('/graphql', limiter);

  // Body parsing middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Apollo Server setup
  const server = new ApolloServer({
    typeDefs,
    resolvers,
    plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
    introspection: process.env.NODE_ENV !== 'production',
    formatError: (error) => {
      console.error('GraphQL Error:', error);
      return {
        message: error.message,
        code: error.extensions?.code || 'INTERNAL_SERVER_ERROR',
      };
    },
  });

  await server.start();

  // GraphQL endpoint with auth middleware
  app.use(
    '/graphql',
    authMiddleware,
    expressMiddleware(server, {
      context: async ({ req }: any) => createGraphQLContext({ req }),
    }) as any
  );

  // Root endpoint
  app.get('/', (_req, res) => {
    res.json({
      name: 'DaanaRx GraphQL API',
      version: '1.0.0',
      status: 'running',
      endpoints: {
        graphql: '/graphql',
        health: '/health',
      },
      timestamp: new Date().toISOString(),
    });
  });

  // Health check endpoint
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Start server
  await new Promise<void>((resolve) => httpServer.listen({ port: PORT }, resolve));
  console.log(`🚀 DaanaRx Server ready at http://localhost:${PORT}/graphql`);
}

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

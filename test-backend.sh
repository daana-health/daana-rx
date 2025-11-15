#!/bin/bash

# Test Backend Deployment Script
# Usage: ./test-backend.sh <your-railway-url>

if [ -z "$1" ]; then
    echo "❌ Error: Please provide your Railway backend URL"
    echo "Usage: ./test-backend.sh https://your-app.railway.app"
    exit 1
fi

BACKEND_URL="$1"
GRAPHQL_ENDPOINT="${BACKEND_URL}/graphql"

echo "🧪 Testing DaanaRx Backend at: $GRAPHQL_ENDPOINT"
echo ""

# Test 1: Check if server is responding
echo "📡 Test 1: Server Health Check..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL")

if [ "$HTTP_CODE" -eq 200 ] || [ "$HTTP_CODE" -eq 404 ]; then
    echo "✅ Server is responding (HTTP $HTTP_CODE)"
else
    echo "❌ Server not responding (HTTP $HTTP_CODE)"
    exit 1
fi

# Test 2: GraphQL Introspection Query
echo ""
echo "📡 Test 2: GraphQL Endpoint Check..."
RESPONSE=$(curl -s -X POST "$GRAPHQL_ENDPOINT" \
  -H "Content-Type: application/json" \
  -d '{"query":"{ __schema { queryType { name } } }"}')

if echo "$RESPONSE" | grep -q "queryType"; then
    echo "✅ GraphQL endpoint is working!"
    echo "Response: $RESPONSE"
else
    echo "❌ GraphQL endpoint error"
    echo "Response: $RESPONSE"
    exit 1
fi

echo ""
echo "✅ All tests passed! Your backend is ready to use."
echo ""
echo "📋 Next steps:"
echo "1. Add this to Vercel environment variables:"
echo "   NEXT_PUBLIC_GRAPHQL_URL=${GRAPHQL_ENDPOINT}"
echo ""
echo "2. Redeploy your Vercel frontend"
echo ""
echo "3. Test the full application!"


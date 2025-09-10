#!/bin/bash

echo "🚀 Starting application..."

# Wait for database to be ready
echo "⏳ Waiting for database to be ready..."
sleep 10

# Run migrations with error handling
echo "📦 Running database migrations..."
npm run migrate:up:safe

migration_result=$?

if [ $migration_result -eq 0 ]; then
    echo "✅ Migrations completed successfully"
else
    echo "⚠️ Migrations failed, but continuing with startup..."
    echo "🔍 This might be expected if migrations were already applied"
fi

# Start the application
echo "🌟 Starting server..."
npm start

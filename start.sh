#!/bin/bash

echo "🚀 Starting application..."

# Wait for database to be ready
echo "⏳ Waiting for database to be ready..."
sleep 10

# Show environment info
echo "🔧 Environment check:"
echo "NODE_ENV: $NODE_ENV"
echo "DATABASE_URL: ${DATABASE_URL:0:50}..." # Show first 50 chars only
echo "PWD: $PWD"

# Check if migrations directory exists
echo "📁 Checking migrations directory..."
if [ -d "src/db/migrations" ]; then
    echo "✅ Migrations directory found"
    ls -la src/db/migrations/
else
    echo "❌ Migrations directory not found!"
    ls -la src/db/ || echo "src/db directory doesn't exist"
fi

# Check if node-pg-migrate is available
echo "📦 Checking node-pg-migrate..."
which node-pg-migrate || npm list node-pg-migrate

# Run migrations with detailed logging
echo "📦 Running database migrations..."
echo "Command: npm run migrate:up:render"

npm run migrate:up:render 2>&1

migration_result=$?

echo "📊 Migration result: $migration_result"

if [ $migration_result -eq 0 ]; then
    echo "✅ Migrations completed successfully"
else
    echo "❌ Migrations failed with exit code: $migration_result"
    echo "🔍 Trying alternative migration approach..."
    
    # Try direct node-pg-migrate call
    echo "📦 Attempting direct migration..."
    ./node_modules/.bin/node-pg-migrate up --migrations-dir src/db/migrations --verbose 2>&1
    
    direct_result=$?
    if [ $direct_result -eq 0 ]; then
        echo "✅ Direct migration succeeded"
    else
        echo "❌ Direct migration also failed with exit code: $direct_result"
        echo "⚠️ Continuing startup anyway - app will report database issues"
    fi
fi

# Final check
echo "🔍 Final migration status check..."
npm run migrate:up -- --dry-run 2>&1 || echo "Migration status check failed"

# Start the application
echo "🌟 Starting server..."
npm start

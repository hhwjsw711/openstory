#!/bin/bash

# DevContainer startup script for Velro development environment
# This script initializes Supabase and QStash services

set -e

echo "🚀 Starting Velro development environment..."

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 10

# Check if Supabase is ready
echo "🔧 Checking Supabase status..."
if command -v supabase &> /dev/null; then
    # Initialize Supabase if not already done
    if [ ! -f "/workspace/supabase/.branches/_current_branch" ]; then
        echo "📦 Initializing Supabase..."
        cd /workspace
        supabase db reset --local
    else
        echo "✅ Supabase already initialized"
    fi
else
    echo "⚠️  Supabase CLI not found"
fi

# Check QStash status
echo "📨 Checking QStash status..."
if curl -f http://qstash:8080/health > /dev/null 2>&1; then
    echo "✅ QStash is running"
else
    echo "⚠️  QStash not ready yet"
fi

# Setup Vercel project linking and environment variables
echo "🔗 Setting up Vercel integration..."
cd /workspace

# Check if already linked
if [ -f ".vercel/project.json" ]; then
    echo "✅ Vercel project already linked"
else
    echo "🔧 Linking to Vercel project..."
    echo "⚠️  You'll need to authenticate with Vercel and select your project"
    vercel link || echo "⚠️  Vercel linking skipped - you can run 'vercel link' manually later"
fi

# Pull environment variables if project is linked
if [ -f ".vercel/project.json" ]; then
    echo "📥 Pulling environment variables from Vercel..."
    vercel env pull .env.local --yes || echo "⚠️  Failed to pull env vars - you may need to authenticate"
    
    if [ -f ".env.local" ]; then
        echo "✅ Environment variables pulled successfully"
        # Show which env vars were pulled (without values for security)
        echo "📋 Environment variables available:"
        grep -E "^[A-Z_]+" .env.local | cut -d'=' -f1 | sed 's/^/   - /' || echo "   (none found)"
    fi
else
    echo "⚠️  Vercel project not linked - using default environment variables"
fi

echo "🎉 Development environment is ready!"
echo ""
echo "📍 Service URLs:"
echo "   - Next.js App:      http://localhost:3000"
echo "   - Supabase API:     http://localhost:54321"  
echo "   - Supabase Studio:  http://localhost:54323"
echo "   - QStash Local:     http://localhost:8080"
echo ""
echo "🔑 Environment variables:"
if [ -f ".env.local" ]; then
    echo "   - Pulled from Vercel project"
else
    echo "   - Using devcontainer defaults for local services"
fi
echo ""
echo "💡 To start your Next.js app, run: npm run dev"
echo "💡 To manually link Vercel project, run: vercel link"
echo "💡 To pull latest env vars, run: vercel env pull .env.local"
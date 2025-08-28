#!/bin/bash

# Vercel sync script for easy environment variable management

set -e

echo "🔗 Vercel Environment Sync"
echo ""

# Function to check if project is linked
check_linked() {
    if [ ! -f ".vercel/project.json" ]; then
        echo "❌ Project not linked to Vercel"
        echo "💡 Run 'vercel link' first to connect your project"
        exit 1
    fi
}

# Function to show help
show_help() {
    echo "Usage: ./.devcontainer/vercel-sync.sh [command]"
    echo ""
    echo "Commands:"
    echo "  link      - Link project to Vercel"
    echo "  pull      - Pull environment variables from Vercel"
    echo "  push      - Push local .env.local to Vercel"
    echo "  status    - Show current project status"
    echo "  help      - Show this help message"
    echo ""
    echo "Examples:"
    echo "  ./.devcontainer/vercel-sync.sh link"
    echo "  ./.devcontainer/vercel-sync.sh pull"
}

case "${1:-help}" in
    "link")
        echo "🔗 Linking to Vercel project..."
        vercel link
        if [ -f ".vercel/project.json" ]; then
            echo "✅ Successfully linked to Vercel"
            echo "💡 Now run: ./.devcontainer/vercel-sync.sh pull"
        fi
        ;;
    
    "pull")
        check_linked
        echo "📥 Pulling environment variables from Vercel..."
        vercel env pull .env.local --yes
        if [ -f ".env.local" ]; then
            echo "✅ Environment variables pulled successfully"
            echo "📋 Variables available:"
            grep -E "^[A-Z_]+" .env.local | cut -d'=' -f1 | sed 's/^/   - /' || echo "   (none found)"
            echo ""
            echo "💡 Restart your dev server to use the new variables"
        fi
        ;;
    
    "push")
        check_linked
        if [ ! -f ".env.local" ]; then
            echo "❌ No .env.local file found"
            echo "💡 Create .env.local with your environment variables first"
            exit 1
        fi
        echo "📤 Pushing environment variables to Vercel..."
        echo "⚠️  This will update environment variables in your Vercel project"
        read -p "Continue? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            # Push each env var individually
            while IFS='=' read -r key value; do
                if [[ $key =~ ^[A-Z_]+ ]] && [[ ! -z "$value" ]]; then
                    echo "Setting $key..."
                    echo "$value" | vercel env add "$key" production --yes >/dev/null 2>&1 || true
                fi
            done < .env.local
            echo "✅ Environment variables pushed to Vercel"
        else
            echo "❌ Push cancelled"
        fi
        ;;
    
    "status")
        if [ -f ".vercel/project.json" ]; then
            echo "✅ Project linked to Vercel"
            PROJECT_NAME=$(cat .vercel/project.json | grep -o '"name":"[^"]*' | cut -d'"' -f4)
            ORG_ID=$(cat .vercel/project.json | grep -o '"orgId":"[^"]*' | cut -d'"' -f4)
            echo "📁 Project: $PROJECT_NAME"
            echo "🏢 Org ID: $ORG_ID"
            
            if [ -f ".env.local" ]; then
                ENV_COUNT=$(grep -c "^[A-Z_]*=" .env.local || echo "0")
                echo "🔑 Local env vars: $ENV_COUNT"
            else
                echo "🔑 No local .env.local file"
            fi
        else
            echo "❌ Project not linked to Vercel"
            echo "💡 Run 'vercel link' to connect your project"
        fi
        ;;
    
    "help"|*)
        show_help
        ;;
esac
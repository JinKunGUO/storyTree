#!/bin/bash
# StoryTree Git Repository Setup Script
# 统一初始化整个项目的Git仓库

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

echo -e "${BLUE}"
echo "╔══════════════════════════════════════════╗"
echo "║     🌳 StoryTree Git Setup Wizard        ║"
echo "╚══════════════════════════════════════════╝"
echo -e "${NC}"
echo ""

# Check if git is installed
if ! command -v git &> /dev/null; then
  echo -e "${RED}❌ Git is not installed!${NC}"
  echo "Please install Git first: https://git-scm.com/downloads"
  exit 1
fi

# Check if already a git repo
if [ -d ".git" ]; then
  echo -e "${YELLOW}⚠️  Git repository already exists!${NC}"
  read -p "Reconfigure? (y/N): " -n 1 -r
  echo ""
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${GREEN}✅ Using existing repository${NC}"
    exit 0
  fi
fi

# Initialize git repository
echo -e "${BLUE}📦 Initializing Git repository...${NC}"
git init

# Configure git hooks
echo -e "${BLUE}🔗 Configuring Git hooks...${NC}"
if [ -d ".githooks" ]; then
  git config core.hooksPath .githooks
  chmod +x .githooks/*
  echo -e "${GREEN}✅ Git hooks configured (.githooks/)${NC}"
fi

# Check for .gitignore
if [ ! -f ".gitignore" ]; then
  echo -e "${YELLOW}⚠️  .gitignore not found. Creating...${NC}"
  cat > .gitignore << 'EOF'
# Dependencies
node_modules/
package-lock.json
yarn.lock

# Environment
.env
.env.local

# Database
*.db
*.db-journal
*.sqlite

# Build outputs
dist/
build/

# IDE
.idea/
.vscode/
*.swp
.DS_Store

# Logs
*.log
EOF
  echo -e "${GREEN}✅ Created .gitignore${NC}"
fi

# Initialize version if not exists
if [ ! -f "VERSION.json" ]; then
  echo -e "${BLUE}📝 Creating VERSION.json...${NC}"
  cat > VERSION.json << 'EOF'
{
  "name": "storytree",
  "version": "1.0.0",
  "codename": "M1-Seed",
  "stage": "MVP",
  "buildDate": "2025-02-10T00:00:00.000Z",
  "commitHash": "initial",
  "branch": "main",
  "repository": "storytree",
  "description": "分支式AI协作小说创作平台",
  "features": [],
  "changelog": {}
}
EOF
  echo -e "${GREEN}✅ Created VERSION.json${NC}"
fi

# Install dependencies if needed
echo ""
echo -e "${BLUE}📦 Checking dependencies...${NC}"

if [ -f "api/package.json" ]; then
  if [ ! -d "api/node_modules" ]; then
    echo "Installing API dependencies..."
    cd api && npm install && cd "$PROJECT_ROOT"
  else
    echo -e "${GREEN}✅ API dependencies already installed${NC}"
  fi
fi

# Add all files
echo ""
echo -e "${BLUE}📂 Staging files...${NC}"
git add .

# Show status
echo ""
echo -e "${BLUE}📊 Git Status:${NC}"
git status --short

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ✅ Git repository setup complete!       ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo ""
echo "  1. Review changes:"
echo -e "     ${BLUE}git status${NC}"
echo ""
echo "  2. Make initial commit:"
echo -e "     ${BLUE}git commit -m \"feat: initial StoryTree MVP\"${NC}"
echo ""
echo "  3. Start development:"
echo -e "     ${BLUE}cd api && npm run dev${NC}"
echo -e "     ${BLUE}cd web && python3 -m http.server 3000${NC}"
echo ""
echo "  4. Add remote (optional):"
echo -e "     ${BLUE}git remote add origin <your-repo-url>${NC}"
echo -e "     ${BLUE}git push -u origin main${NC}"
echo ""
echo -e "${GREEN}Version Management:${NC}"
echo -e "  ${BLUE}node scripts/version-manager.js${NC}         # Show version"
echo -e "  ${BLUE}node scripts/version-manager.js patch${NC}    # Bump patch"
echo -e "  ${BLUE}node scripts/version-manager.js stage M2${NC}  # Change stage"
echo ""

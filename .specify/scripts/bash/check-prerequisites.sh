#!/usr/bin/env bash

# Check prerequisites for spec-kit workflow

set -e

# Source common utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

print_info "Checking spec-kit prerequisites..."

# Check git
if ! command -v git &> /dev/null; then
    print_error "git is not installed"
    exit 1
fi
print_success "git is installed"

# Check if in git repo
if ! check_git_repo; then
    exit 1
fi
print_success "In git repository"

# Check for spec-kit structure
if ! dir_exists ".specify"; then
    print_error ".specify directory not found. Run initialization first."
    exit 1
fi
print_success ".specify directory exists"

# Check for templates
if ! dir_exists ".specify/templates"; then
    print_error ".specify/templates directory not found"
    exit 1
fi
print_success "Templates directory exists"

# Check for constitution
if ! file_exists ".specify/memory/constitution.md"; then
    print_warning "Constitution not found (optional)"
else
    print_success "Constitution exists"
fi

# Check for specs directory
if ! dir_exists "specs"; then
    print_warning "specs/ directory not found. Will be created when first feature is added."
else
    print_success "specs/ directory exists"
fi

# Check for Claude commands
if ! dir_exists ".claude/commands"; then
    print_warning ".claude/commands directory not found (optional)"
else
    print_success "Claude commands directory exists"
fi

print_success "All prerequisites met!"

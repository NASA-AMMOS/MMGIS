#!/usr/bin/env bash

# Common utilities for spec-kit bash scripts

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print colored output
print_error() {
    echo -e "${RED}Error: $1${NC}" >&2
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# Check if we're in a git repository
check_git_repo() {
    if ! git rev-parse --git-dir > /dev/null 2>&1; then
        print_error "Not in a git repository"
        return 1
    fi
    return 0
}

# Get the project root (git root)
get_project_root() {
    git rev-parse --show-toplevel 2>/dev/null
}

# Check if a file exists
file_exists() {
    test -f "$1"
}

# Check if a directory exists
dir_exists() {
    test -d "$1"
}

# Get next feature number
get_next_feature_number() {
    local specs_dir="${1:-specs}"
    local max_num=0

    if dir_exists "$specs_dir"; then
        for dir in "$specs_dir"/[0-9][0-9][0-9]-*/; do
            if [ -d "$dir" ]; then
                local num=$(basename "$dir" | cut -d'-' -f1)
                if [ "$num" -gt "$max_num" ]; then
                    max_num=$num
                fi
            fi
        done
    fi

    printf "%03d" $((max_num + 1))
}

# Convert string to kebab-case
to_kebab_case() {
    echo "$1" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]\+/-/g' | sed 's/^-\|-$//g'
}

# Validate feature name
validate_feature_name() {
    local name="$1"
    if [ -z "$name" ]; then
        print_error "Feature name cannot be empty"
        return 1
    fi
    if [[ ! "$name" =~ ^[a-z0-9-]+$ ]]; then
        print_error "Feature name must be kebab-case (lowercase, hyphens only)"
        return 1
    fi
    return 0
}

# Check if constitution exists
check_constitution() {
    local const_file=".specify/memory/constitution.md"
    if ! file_exists "$const_file"; then
        print_warning "Constitution not found at $const_file"
        return 1
    fi
    return 0
}

# Get constitution principles
get_constitution_principles() {
    local const_file=".specify/memory/constitution.md"
    if file_exists "$const_file"; then
        grep -E "^###? " "$const_file" | sed 's/^###\? //' | head -10
    fi
}

# Export functions for use in other scripts
export -f print_error print_success print_warning print_info
export -f check_git_repo get_project_root
export -f file_exists dir_exists
export -f get_next_feature_number to_kebab_case validate_feature_name
export -f check_constitution get_constitution_principles

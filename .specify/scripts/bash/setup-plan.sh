#!/usr/bin/env bash

# Setup or validate a plan.md file

set -e

# Source common utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

# Get feature directory from argument
FEATURE_DIR="$1"

if [ -z "$FEATURE_DIR" ]; then
    print_error "Usage: $0 <feature-directory>"
    exit 1
fi

if ! dir_exists "$FEATURE_DIR"; then
    print_error "Feature directory not found: $FEATURE_DIR"
    exit 1
fi

PLAN_FILE="$FEATURE_DIR/plan.md"
SPEC_FILE="$FEATURE_DIR/spec.md"

# Check if spec exists
if ! file_exists "$SPEC_FILE"; then
    print_error "spec.md not found in $FEATURE_DIR"
    print_info "Create spec.md first before planning"
    exit 1
fi

# Check if plan already exists
if file_exists "$PLAN_FILE"; then
    print_warning "plan.md already exists"
    read -p "Overwrite? (y/N): " confirm
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        print_info "Keeping existing plan.md"
        exit 0
    fi
fi

# Copy template
TEMPLATE_FILE=".specify/templates/plan-template.md"
if ! file_exists "$TEMPLATE_FILE"; then
    print_error "Plan template not found: $TEMPLATE_FILE"
    exit 1
fi

# Extract feature name from directory
FEATURE_NAME=$(basename "$FEATURE_DIR" | sed 's/^[0-9]\{3\}-//')

cp "$TEMPLATE_FILE" "$PLAN_FILE"
sed -i "s/\[Feature Name\]/$FEATURE_NAME/g" "$PLAN_FILE"
sed -i "s/\[Date\]/$(date +%Y-%m-%d)/g" "$PLAN_FILE"
sed -i "s|\[Link to spec.md\]|spec.md|g" "$PLAN_FILE"

print_success "Created plan.md in $FEATURE_DIR"

# Check constitution
if check_constitution; then
    print_info "Remember to check plan against constitution principles:"
    get_constitution_principles | sed 's/^/  - /'
fi

print_info "Next steps:"
echo "  1. Fill out technical context and dependencies"
echo "  2. Design the architecture and components"
echo "  3. Define API contracts"
echo "  4. Document technical decisions"
echo "  5. Break down into tasks (setup-tasks.sh)"

#!/usr/bin/env bash

# Create a new feature spec directory structure

set -e

# Source common utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

# Get feature name from argument or prompt
FEATURE_NAME="$1"

if [ -z "$FEATURE_NAME" ]; then
    read -p "Enter feature name (kebab-case): " FEATURE_NAME
fi

# Convert to kebab-case
FEATURE_NAME=$(to_kebab_case "$FEATURE_NAME")

# Validate
if ! validate_feature_name "$FEATURE_NAME"; then
    exit 1
fi

# Get next feature number
FEATURE_NUM=$(get_next_feature_number "specs")
FEATURE_DIR="specs/${FEATURE_NUM}-${FEATURE_NAME}"

print_info "Creating feature: $FEATURE_DIR"

# Create directory
if dir_exists "$FEATURE_DIR"; then
    print_error "Feature directory already exists: $FEATURE_DIR"
    exit 1
fi

mkdir -p "$FEATURE_DIR"
print_success "Created directory: $FEATURE_DIR"

# Copy templates
TEMPLATE_DIR=".specify/templates"

if file_exists "$TEMPLATE_DIR/spec-template.md"; then
    sed "s/\[Feature Name\]/$FEATURE_NAME/g" "$TEMPLATE_DIR/spec-template.md" > "$FEATURE_DIR/spec.md"
    sed -i "s/\[Date\]/$(date +%Y-%m-%d)/g" "$FEATURE_DIR/spec.md"
    print_success "Created spec.md"
fi

if file_exists "$TEMPLATE_DIR/plan-template.md"; then
    sed "s/\[Feature Name\]/$FEATURE_NAME/g" "$TEMPLATE_DIR/plan-template.md" > "$FEATURE_DIR/plan.md"
    sed -i "s/\[Date\]/$(date +%Y-%m-%d)/g" "$FEATURE_DIR/plan.md"
    sed -i "s|\[Link to spec.md\]|spec.md|g" "$FEATURE_DIR/plan.md"
    print_success "Created plan.md"
fi

if file_exists "$TEMPLATE_DIR/tasks-template.md"; then
    sed "s/\[Feature Name\]/$FEATURE_NAME/g" "$TEMPLATE_DIR/tasks-template.md" > "$FEATURE_DIR/tasks.md"
    sed -i "s/\[Date\]/$(date +%Y-%m-%d)/g" "$FEATURE_DIR/tasks.md"
    sed -i "s|\[Link to plan.md\]|plan.md|g" "$FEATURE_DIR/tasks.md"
    print_success "Created tasks.md"
fi

print_success "Feature created successfully: $FEATURE_DIR"
print_info "Next steps:"
echo "  1. Edit $FEATURE_DIR/spec.md to define requirements"
echo "  2. Edit $FEATURE_DIR/plan.md to design the solution"
echo "  3. Edit $FEATURE_DIR/tasks.md to break down implementation"
echo "  4. Start implementing!"

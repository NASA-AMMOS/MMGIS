#!/usr/bin/env bash

# Update AGENTS.md with current feature list

set -e

# Source common utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

AGENTS_FILE="AGENTS.md"
SPECS_DIR="specs"

print_info "Updating $AGENTS_FILE with current features..."

# Check if AGENTS.md exists
if ! file_exists "$AGENTS_FILE"; then
    print_error "$AGENTS_FILE not found"
    exit 1
fi

# Check if specs directory exists
if ! dir_exists "$SPECS_DIR"; then
    print_warning "No specs directory found, skipping feature list update"
    exit 0
fi

# Build feature list
FEATURE_LIST=""
for dir in "$SPECS_DIR"/[0-9][0-9][0-9]-*/; do
    if [ -d "$dir" ]; then
        FEATURE_DIR=$(basename "$dir")
        SPEC_FILE="$dir/spec.md"
        TASKS_FILE="$dir/tasks.md"

        # Extract feature name and number
        FEATURE_NUM=$(echo "$FEATURE_DIR" | cut -d'-' -f1)
        FEATURE_NAME=$(echo "$FEATURE_DIR" | sed 's/^[0-9]\{3\}-//' | tr '-' ' ')

        # Get description from spec.md if available
        DESCRIPTION=""
        if file_exists "$SPEC_FILE"; then
            DESCRIPTION=$(grep -m1 "^## Overview" -A2 "$SPEC_FILE" | tail -1 | sed 's/^\[//' | sed 's/\]$//')
        fi

        # Determine status from tasks.md
        STATUS="📋 Not Started"
        if file_exists "$TASKS_FILE"; then
            TOTAL=$(grep -c "^**TASK-" "$TASKS_FILE" || true)
            COMPLETED=$(grep -c "Status.*✅ Complete" "$TASKS_FILE" || true)
            if [ "$TOTAL" -gt 0 ]; then
                if [ "$COMPLETED" -eq "$TOTAL" ]; then
                    STATUS="✅ Complete ($COMPLETED/$TOTAL tasks)"
                elif [ "$COMPLETED" -gt 0 ]; then
                    PERCENT=$((COMPLETED * 100 / TOTAL))
                    STATUS="🚧 In Progress ($COMPLETED/$TOTAL tasks, $PERCENT%)"
                fi
            fi
        fi

        # Build entry
        FEATURE_LIST="$FEATURE_LIST
### $FEATURE_DIR
$DESCRIPTION
📄 Spec: [$SPECS_DIR/$FEATURE_DIR/spec.md]($SPECS_DIR/$FEATURE_DIR/spec.md)
📋 Plan: [$SPECS_DIR/$FEATURE_DIR/plan.md]($SPECS_DIR/$FEATURE_DIR/plan.md)
**Status**: $STATUS
"
    fi
done

# Update AGENTS.md
# Find the Active Features section and replace it
if grep -q "^## Active Features" "$AGENTS_FILE"; then
    # Create temporary file with updated content
    awk -v features="$FEATURE_LIST" '
        /^## Active Features/ {
            print $0
            print ""
            print features
            skip=1
            next
        }
        /^## / && skip { skip=0 }
        !skip { print }
    ' "$AGENTS_FILE" > "$AGENTS_FILE.tmp"

    mv "$AGENTS_FILE.tmp" "$AGENTS_FILE"
    print_success "Updated Active Features section in $AGENTS_FILE"
else
    print_warning "No 'Active Features' section found in $AGENTS_FILE"
    print_info "Consider adding one for better AI agent context"
fi

print_success "Agent context updated successfully"

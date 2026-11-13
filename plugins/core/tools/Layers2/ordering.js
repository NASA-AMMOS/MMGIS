const isHeader = (row) => row?.type === 'header'

export function flatten(configLayers) {
    const flat = []

    const visit = (layers, depth) => {
        for (const node of layers || []) {
            flat.push({
                key: node.uuid || node.name,
                name: node.name,
                type: node.type,
                depth,
                node,
            })
            if (node.type === 'header') visit(node.sublayers, depth + 1)
        }
    }

    visit(configLayers, 0)
    return flat
}

export function parentOf(flat, index) {
    const row = flat[index]
    if (!row || row.depth <= 0) return null
    const parentDepth = row.depth - 1
    for (let i = index - 1; i >= 0; i -= 1) {
        if (flat[i].depth < parentDepth) return null
        if (flat[i].depth === parentDepth && isHeader(flat[i])) return i
    }
    return null
}

export function descendantsOf(flat, index) {
    const row = flat[index]
    if (!row || !isHeader(row)) return []
    let end = index + 1
    while (end < flat.length && flat[end].depth > row.depth) end += 1
    return flat.slice(index + 1, end)
}

function expanded(expandedMap, header) {
    if (expandedMap instanceof Map)
        return expandedMap.get(header.name) !== false
    return expandedMap?.[header.name] !== false
}

export function isHidden(flat, index, expandedMap) {
    let parent = parentOf(flat, index)
    while (parent != null) {
        if (!expanded(expandedMap, flat[parent])) return true
        parent = parentOf(flat, parent)
    }
    return false
}

export function layerOrder(flat) {
    return flat
        .filter((row) => row.type !== 'header' && row.name != null)
        .map((row) => row.name)
}

function setExpanded(expandedMap, header, value) {
    if (expandedMap instanceof Map) expandedMap.set(header.name, value)
    else expandedMap[header.name] = value
}

function searchHidden(expandedMap, row) {
    const hidden = expandedMap?.searchHidden
    return hidden instanceof Set
        ? hidden.has(row.key) || hidden.has(row.name)
        : Array.isArray(hidden)
          ? hidden.includes(row.key) || hidden.includes(row.name)
          : false
}

function rowOn(flat, index, expandedMap) {
    void expandedMap
    return flat[index]?.on !== false
}

function rowHasHeight(flat, index, expandedMap) {
    return (
        rowOn(flat, index, expandedMap) &&
        flat[index]?.height > 0 &&
        !searchHidden(expandedMap, flat[index])
    )
}

function nthChild(flat, index) {
    // Sortable's replay callbacks use DOM nth-child's 1-based coordinates.
    return index > 0 ? flat[index - 1] : undefined
}

function toggleHeader(flat, index, expandedMap, headerToggles, expandedFn) {
    const header = flat[index]
    if (!isHeader(header)) return
    const wasExpanded = expanded(expandedMap, header)
    const onState = !wasExpanded
    setExpanded(expandedMap, header, onState)
    header.childrenon = onState
    const depths = [header.depth]
    const wasOn = [wasExpanded]
    let currentHeaderIndex = 0
    for (let i = index + 1; i < flat.length; i += 1) {
        const row = flat[i]
        if (row.depth <= depths[currentHeaderIndex]) {
            while (row.depth <= depths[currentHeaderIndex]) {
                depths.pop()
                wasOn.pop()
                currentHeaderIndex -= 1
                if (currentHeaderIndex < 0) return
            }
        }
        const nextDepth = row.depth > depths[currentHeaderIndex]
        const hide =
            currentHeaderIndex === 0
                ? wasOn[0] === true
                : !wasOn.every((wasExpanded) => wasExpanded === false)
        if (hide) {
            if (nextDepth) row.on = false
            row.height = 0
        } else {
            if (row.on === true || nextDepth) row.height = 1
            if (nextDepth) row.on = true
        }
        if (isHeader(row)) {
            depths.push(row.depth)
            wasOn.push(!expanded(expandedMap, row))
            currentHeaderIndex += 1
        }
    }
    const toggle = { name: header.name, expanded: onState }
    headerToggles.push(toggle)
    if (typeof expandedFn === 'function') expandedFn(toggle, header)
}

function sortOnChange(flat, item, newIndex, expandedMap, options = {}) {
    let newDepth = 0
    let headerState = 0

    if (newIndex > 0) {
        let above
        let upIndex = newIndex
        if (options.downward === true) upIndex += 1

        while (upIndex >= 0) {
            above = nthChild(flat, upIndex)
            if (above == null || rowOn(flat, flat.indexOf(above), expandedMap))
                upIndex = 0
            upIndex -= 1
        }

        if (above) {
            const aboveIndex = flat.indexOf(above)
            newDepth = above.depth
            const isExpanded = expanded(expandedMap, above)
            if (
                (options.afterHeader === 0 && !isExpanded) ||
                (options.afterHeader === 1 && isExpanded)
            ) {
                toggleHeader(
                    flat,
                    aboveIndex,
                    expandedMap,
                    options.headerToggles || [],
                    options.expandedFn
                )
            }

            if (isHeader(above)) {
                if (expanded(expandedMap, above)) {
                    newDepth += 1
                    headerState = 2
                } else {
                    headerState = 1
                }
            }
        }
    }

    item.depth = newDepth
    return { newDepth, headerState }
}

function insertAfter(flat, item, target) {
    if (!target || item === target) return
    const itemIndex = flat.indexOf(item)
    if (itemIndex < 0) return
    flat.splice(itemIndex, 1)
    const targetIndex = flat.indexOf(target)
    if (targetIndex < 0) {
        flat.unshift(item)
        return
    }
    flat.splice(targetIndex + 1, 0, item)
}

function sortOnEnd(
    flat,
    item,
    newIndex,
    oldDepth,
    newDepth,
    descendants,
    expandedMap
) {
    let downIndex = newIndex + 1
    let keepGoing = true
    let next
    let after
    const total = flat.length

    // Keep the legacy initial lookup and downIndex arithmetic, including
    // its treatment of the final row and zero-height rows.
    next = nthChild(flat, newIndex)
    if (isHeader(next) && !expanded(expandedMap, next)) downIndex += 1

    while (newIndex > 0 && keepGoing) {
        next = nthChild(flat, downIndex)
        if (next) {
            const nextIndex = flat.indexOf(next)
            if (downIndex >= total || rowHasHeight(flat, nextIndex, expandedMap)) {
                after = nthChild(
                    flat,
                    downIndex + (downIndex >= total ? 0 : -1)
                )
                keepGoing = false
            } else {
                downIndex += 1
            }
        } else {
            keepGoing = false
        }
    }

    if (after) insertAfter(flat, item, after)
    else {
        const itemIndex = flat.indexOf(item)
        if (itemIndex >= 0) flat.splice(itemIndex, 1)
        flat.unshift(item)
    }

    if (isHeader(item) && descendants.length > 0) {
        let previous = item
        descendants.forEach((descendant) => {
            descendant.depth += newDepth - oldDepth
            insertAfter(flat, descendant, previous)
            previous = descendant
        })
    }
}

function cloneExpandedMap(flat, expandedMap) {
    const cloned =
        expandedMap instanceof Map
            ? new Map(expandedMap)
            : { ...(expandedMap || {}) }
    if (expandedMap?.searchHidden instanceof Set)
        cloned.searchHidden = new Set(expandedMap.searchHidden)
    else if (Array.isArray(expandedMap?.searchHidden))
        cloned.searchHidden = expandedMap.searchHidden.slice()
    flat.forEach((row) => {
        const hasExpansion =
            cloned instanceof Map
                ? cloned.has(row.name)
                : Object.prototype.hasOwnProperty.call(cloned, row.name)
        if (isHeader(row) && !hasExpansion)
            setExpanded(cloned, row, true)
    })
    return cloned
}

function initializeRowState(flat, expandedMap) {
    flat.forEach((row) => {
        row.on = true
        row.height = 1
        if (isHeader(row)) row.childrenon = true
    })
    flat.forEach((row, index) => {
        if (
            isHeader(row) &&
            expandedMap instanceof Map &&
            expandedMap.get(row.name) === false
        ) {
            expandedMap.set(row.name, true)
            toggleHeader(flat, index, expandedMap, [])
        }
        else if (
            isHeader(row) &&
            !(expandedMap instanceof Map) &&
            expandedMap[row.name] === false
        ) {
            expandedMap[row.name] = true
            toggleHeader(flat, index, expandedMap, [])
        }
    })
    flat.forEach((row) => {
        if (searchHidden(expandedMap, row)) row.height = 0
    })
}

export function replay(flat, history, expandedFn) {
    const ordered = flat.map((row) => ({ ...row }))
    const expandedMap = new Map(
        ordered.filter(isHeader).map((row) => [row.name, true])
    )
    initializeRowState(ordered, expandedMap)
    const headerToggles = []

    ;(history || []).forEach((entry) => {
        const [oldIndex, newIndex, afterHeader] = entry
        const item = ordered[oldIndex]
        if (!item) return

        const oldDepth = item.depth
        const descendants = isHeader(item) ? descendantsOf(ordered, oldIndex) : []
        const upward = oldIndex > newIndex
        const eventIndex = newIndex + (upward ? 0 : 1)
        const { newDepth } = sortOnChange(
            ordered,
            item,
            eventIndex,
            expandedMap,
            {
                afterHeader,
                headerToggles,
                expandedFn,
            }
        )

        sortOnEnd(
            ordered,
            item,
            eventIndex,
            oldDepth,
            newDepth,
            descendants,
            expandedMap
        )
    })

    return { flat: ordered, headerToggles }
}

export function applyLiveMove(flat, oldIndex, newIndex, expandedMap = {}) {
    const moved = flat.map((row) => ({ ...row }))
    const item = moved[oldIndex]
    if (!item || oldIndex === newIndex || newIndex < 0 || newIndex >= moved.length)
        return { flat: moved, entry: [oldIndex, newIndex, 0] }

    const oldDepth = item.depth
    const descendants = isHeader(item) ? descendantsOf(moved, oldIndex) : []
    moved.splice(oldIndex, 1)
    moved.splice(newIndex, 0, item)

    const localExpanded = cloneExpandedMap(moved, expandedMap)
    initializeRowState(moved, localExpanded)
    const { newDepth, headerState } = sortOnChange(
        moved,
        item,
        newIndex,
        localExpanded,
        {}
    )

    sortOnEnd(
        moved,
        item,
        newIndex,
        oldDepth,
        newDepth,
        descendants,
        localExpanded
    )

    return {
        flat: moved,
        entry: [oldIndex, newIndex, headerState],
    }
}

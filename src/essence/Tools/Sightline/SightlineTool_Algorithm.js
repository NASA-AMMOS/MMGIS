let SightlineTool_Algorithm = {
    // Computes a cumulative visibility heatmap from multiple result grids
    // (e.g. from a time sweep). Returns a 2D array of fractions [0.0..1.0]
    // representing the fraction of timesteps where each cell was visible.
    cumulativeVisibility: function (resultGrids) {
        if (!resultGrids || resultGrids.length === 0) return []
        // Filter out null grids (failed timesteps)
        const validGrids = resultGrids.filter((g) => g != null)
        if (validGrids.length === 0) return []
        const rows = validGrids[0].length
        if (rows === 0) return []
        const cols = validGrids[0][0].length
        let heatmap = []

        for (let y = 0; y < rows; y++) {
            heatmap.push(new Array(cols).fill(0))
            for (let x = 0; x < cols; x++) {
                let visCount = 0
                let total = 0
                for (let g = 0; g < validGrids.length; g++) {
                    const v = validGrids[g][y][x]
                    if (v === 9) continue
                    total++
                    if (v === 1 || v === 2) visCount++
                }
                heatmap[y][x] = total > 0 ? visCount / total : -1
            }
        }
        return heatmap
    },
}

export default SightlineTool_Algorithm

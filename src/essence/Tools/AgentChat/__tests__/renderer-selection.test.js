import { RENDERERS } from '../../AgentChat/renderers'

describe('renderer selection shape', () => {
  test('has required renderer functions', () => {
    expect(typeof RENDERERS.render_layers_line).toBe('function')
    expect(typeof RENDERERS.render_links_summary).toBe('function')
    expect(typeof RENDERERS.zoom_view).toBe('function')
    expect(typeof RENDERERS.set_opacity).toBe('function')
    expect(typeof RENDERERS.toggle_visibility).toBe('function')
    expect(typeof RENDERERS.render_layer_information).toBe('function')
    expect(typeof RENDERERS.render_layer_mean).toBe('function')
    expect(typeof RENDERERS.render_contour_overlay).toBe('function')
    expect(typeof RENDERERS.render_layer_difference).toBe('function')
  })
})


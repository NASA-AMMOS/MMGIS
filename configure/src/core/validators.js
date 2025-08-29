// Validation functions that mirror backend validation rules

export const validateConfiguration = (configuration) => {
  const errors = [];
  
  if (!configuration) {
    errors.push({ field: null, message: "Configuration is missing" });
    return errors;
  }
  
  // Check top-level required fields
  if (!configuration.msv) {
    errors.push({ field: "msv", message: "Mission-Site-View (msv) is required" });
  } else {
    // Check msv.view array
    if (!configuration.msv.view || !Array.isArray(configuration.msv.view)) {
      errors.push({ field: "msv.view", message: "Initial view is required" });
    } else {
      if (configuration.msv.view[0] == null || configuration.msv.view[0] === "") {
        errors.push({ field: "msv.view.0", message: "Initial Latitude is required" });
      }
      if (configuration.msv.view[1] == null || configuration.msv.view[1] === "") {
        errors.push({ field: "msv.view.1", message: "Initial Longitude is required" });
      }
      if (configuration.msv.view[2] == null || configuration.msv.view[2] === "") {
        errors.push({ field: "msv.view.2", message: "Initial Zoom Level is required" });
      }
    }
  }
  
  if (!configuration.layers) {
    errors.push({ field: "layers", message: "Layers array is required" });
  }
  
  if (!configuration.tools) {
    errors.push({ field: "tools", message: "Tools object is required" });
  }
  
  return errors;
};

export const validateLayer = (layer) => {
  const errors = [];
  
  if (!layer) {
    errors.push({ field: null, message: "Layer is missing" });
    return errors;
  }
  
  // Check layer name
  if (layer.name == null || layer.name === "" || layer.name === "undefined") {
    errors.push({ field: "name", message: "Layer name is required" });
  }
  
  // Check by layer type
  switch (layer.type) {
    case "tile":
    case "image":
      if (!layer.url || layer.url === "" || layer.url === "undefined") {
        errors.push({ field: "url", message: "URL is required" });
      }
      if (layer.minZoom == null || isNaN(layer.minZoom)) {
        errors.push({ field: "minZoom", message: "Minimum Zoom is required" });
      } else if (layer.minZoom < 0) {
        errors.push({ field: "minZoom", message: "Minimum Zoom must be >= 0" });
      }
      if (layer.maxNativeZoom == null || isNaN(layer.maxNativeZoom)) {
        errors.push({ field: "maxNativeZoom", message: "Maximum Native Zoom is required" });
      }
      if (layer.maxZoom == null || isNaN(layer.maxZoom)) {
        errors.push({ field: "maxZoom", message: "Maximum Zoom is required" });
      }
      if (!isNaN(layer.minZoom) && !isNaN(layer.maxNativeZoom) && layer.minZoom > layer.maxNativeZoom) {
        errors.push({ field: "minZoom", message: "Minimum Zoom cannot be greater than Maximum Native Zoom" });
      }
      break;
      
    case "vectortile":
      if (!layer.url || layer.url === "" || layer.url === "undefined") {
        errors.push({ field: "url", message: "URL is required" });
      }
      if (layer.minZoom == null || isNaN(layer.minZoom)) {
        errors.push({ field: "minZoom", message: "Minimum Zoom is required" });
      }
      if (layer.maxNativeZoom == null || isNaN(layer.maxNativeZoom)) {
        errors.push({ field: "maxNativeZoom", message: "Maximum Native Zoom is required" });
      }
      if (layer.maxZoom == null || isNaN(layer.maxZoom)) {
        errors.push({ field: "maxZoom", message: "Maximum Zoom is required" });
      }
      break;
      
    case "data":
      if (!layer.demtileurl || layer.demtileurl === "" || layer.demtileurl === "undefined") {
        errors.push({ field: "demtileurl", message: "DEM Tile URL is required" });
      }
      if (layer.minZoom == null || isNaN(layer.minZoom)) {
        errors.push({ field: "minZoom", message: "Minimum Zoom is required" });
      }
      if (layer.maxNativeZoom == null || isNaN(layer.maxNativeZoom)) {
        errors.push({ field: "maxNativeZoom", message: "Maximum Native Zoom is required" });
      }
      if (layer.maxZoom == null || isNaN(layer.maxZoom)) {
        errors.push({ field: "maxZoom", message: "Maximum Zoom is required" });
      }
      break;
      
    case "query":
      if (!layer.query?.endpoint || layer.query.endpoint === "" || layer.query.endpoint === "undefined") {
        errors.push({ field: "query.endpoint", message: "Query Endpoint is required" });
      }
      break;
      
    case "vector":
    case "velocity":
      if (layer.controlled !== true) {
        if (!layer.url || layer.url === "" || layer.url === "undefined") {
          errors.push({ field: "url", message: "URL is required (unless layer is controlled)" });
        }
      }
      break;
      
    case "model":
      if (!layer.url || layer.url === "" || layer.url === "undefined") {
        errors.push({ field: "url", message: "URL is required" });
      }
      if (layer.position?.longitude == null || isNaN(layer.position?.longitude)) {
        errors.push({ field: "position.longitude", message: "Longitude is required" });
      }
      if (layer.position?.latitude == null || isNaN(layer.position?.latitude)) {
        errors.push({ field: "position.latitude", message: "Latitude is required" });
      }
      if (layer.position?.elevation == null || isNaN(layer.position?.elevation)) {
        errors.push({ field: "position.elevation", message: "Elevation is required" });
      }
      if (layer.rotation?.x == null || isNaN(layer.rotation?.x)) {
        errors.push({ field: "rotation.x", message: "Rotation X is required" });
      }
      if (layer.rotation?.y == null || isNaN(layer.rotation?.y)) {
        errors.push({ field: "rotation.y", message: "Rotation Y is required" });
      }
      if (layer.rotation?.z == null || isNaN(layer.rotation?.z)) {
        errors.push({ field: "rotation.z", message: "Rotation Z is required" });
      }
      if (layer.scale == null || isNaN(layer.scale)) {
        errors.push({ field: "scale", message: "Scale is required" });
      }
      break;
      
    case "header":
      // No additional required fields for header
      break;
      
    default:
      if (layer.type) {
        errors.push({ field: "type", message: `Unknown layer type: ${layer.type}` });
      }
  }
  
  return errors;
};

// Check if a field should be required based on conditional logic
export const isFieldRequired = (component, layer, configuration) => {
  if (!component.required) return false;
  
  // Check conditional requirements
  if (component.conditionalRequired) {
    const condition = component.conditionalRequired;
    const fieldValue = layer?.[condition.field];
    
    // If the condition field equals the condition value, field is NOT required
    if (fieldValue === condition.value) {
      return false;
    }
  }
  
  return true;
};

// Get all validation errors for current configuration
export const getAllValidationErrors = (configuration) => {
  const errors = [];
  
  // Validate top-level configuration
  const configErrors = validateConfiguration(configuration);
  errors.push(...configErrors);
  
  // Validate each layer
  if (configuration?.layers && Array.isArray(configuration.layers)) {
    const traverseLayers = (layers, path = []) => {
      layers.forEach((layer, index) => {
        const layerPath = [...path, index];
        const layerErrors = validateLayer(layer);
        
        // Add layer path to errors
        layerErrors.forEach(error => {
          errors.push({
            ...error,
            layerPath,
            layerName: layer.name || `Layer ${layerPath.join('.')}`
          });
        });
        
        // Traverse sublayers
        if (layer.sublayers && Array.isArray(layer.sublayers)) {
          traverseLayers(layer.sublayers, layerPath);
        }
      });
    };
    
    traverseLayers(configuration.layers);
  }
  
  return errors;
};
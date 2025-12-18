# Administrative Tools Implementation Plan

## Overview

This document outlines the implementation plan that was followed to create the MMGIS Administrative Tools feature. This is a retrospective document describing the architecture, component structure, and development approach that was used to build the complete administrative interface.

**Note**: This feature has been fully implemented. This plan documents the approach that was taken.

## Project Structure

### Phase 1: Foundation and Architecture

**Objective**: Establish the base React application structure, routing, and state management.

#### 1.1 Project Setup

**Implementation**:
- Created `/configure` directory as a separate React application
- Initialized with Create React App (react-scripts)
- Configured package.json with required dependencies:
  - React 17.0.2
  - Redux Toolkit 2.0.1
  - Material-UI 5.15.1
  - React Router DOM 6.22.3

**Configuration Files Created**:
```
configure/
├── package.json          # Dependencies and build scripts
├── .gitignore           # Version control exclusions
└── public/
    └── index.html       # HTML template
```

**Build Integration**:
- Created `scripts/make-pug-index.js` to convert HTML to Pug
- Configured build command: `react-scripts build && node scripts/make-pug-index.js`
- Set homepage to `./configure/build` for proper asset paths

#### 1.2 Core Application Structure

**Files Created**:
```
src/
├── index.js                    # React entry point
├── core/
│   ├── Configure.js           # Root component
│   ├── ConfigureStore.js      # Redux store setup
│   ├── store.js               # Redux store configuration
│   ├── initialStore.js        # Initial state
│   └── routes/
│       └── routes.js          # Route configuration
```

**Configure.js Implementation**:
- Two-panel layout (left navigation, right content)
- WebSocket connection initialization
- Mission list loading on mount
- Global error handling setup

**Redux Store Structure**:
```javascript
{
  core: {
    missions: [],
    mission: null,
    configuration: {},
    toolConfiguration: {},
    datasets: [],
    userEntries: [],
    page: null,
    modal: {},
    snackbar: {},
    lockConfig: {}
  }
}
```

#### 1.3 API Client Layer

**File Created**: `src/core/calls.js`

**Implementation**:
- Wrapper around fetch API
- Automatic error handling
- Request/response interceptors
- Success and error callback pattern
- Global error snackbar integration

**Example API Method Structure**:
```javascript
calls.api(
  endpoint,
  payload,
  successCallback,
  errorCallback
);
```

**API Endpoints Implemented**:
- missions: List all missions
- get: Get mission configuration
- update: Save mission configuration
- create: Create new mission
- delete: Delete mission
- versions: Get version history
- getToolConfig: Get tool templates
- account_entries: User management
- datasets_entries: Dataset management
- webhooks_entries: Webhook configuration
- get_generaloptions: System settings

### Phase 2: Navigation and Layout

#### 2.1 Left Panel Navigation

**File Created**: `src/components/Panel/Panel.js`

**Components Implemented**:
- MMGIS logo and version display
- Mission list with scroll
- Permission-based mission filtering
- New Mission button (SuperAdmin only)
- Bottom navigation for system pages

**Features**:
- Alphabetically sorted mission list
- Active mission highlighting
- Disabled state for unauthorized missions
- Version mismatch warning tooltip
- Sign-out button

**Styling Approach**:
- Material-UI makeStyles
- Dark theme with gradients
- Background image (contours.png)
- Responsive height with scrolling

#### 2.2 Main Content Area

**File Created**: `src/components/Main/Main.js`

**Layout Sections**:
1. **Top Bar**:
   - GitHub and documentation links
   - Tab navigation (when mission selected)
   - Username display
   - Sign-out button

2. **Content Area**:
   - Tab pages (for missions)
   - System pages (for global configuration)
   - Welcome screen (no selection)

**Tab Navigation**:
- Home (overview and general settings)
- Layers (layer hierarchy management)
- Tools (tool configuration)
- Coordinates (coordinate system settings)
- Time (temporal configuration)
- User Interface (theme and layout)

**Conditional Rendering**:
```javascript
// Show tabs when mission is selected
if (mission != null) {
  return <TabbedInterface />;
}

// Show system page when page is set
if (page != null) {
  return <SystemPage />;
}

// Show welcome screen
return <IntroScreen />;
```

### Phase 3: Dynamic Form Generation System

#### 3.1 Maker Component

**File Created**: `src/core/Maker.js`

**Purpose**: Generate forms dynamically from JSON metaconfigurations.

**Supported Form Components**:

1. **Text Input**:
```json
{
  "field": "name",
  "type": "text",
  "name": "Name",
  "description": "Help text"
}
```

2. **Number Input**:
```json
{
  "field": "opacity",
  "type": "number",
  "min": 0,
  "max": 1,
  "step": 0.01
}
```

3. **Dropdown**:
```json
{
  "field": "type",
  "type": "dropdown",
  "options": ["option1", "option2"]
}
```

4. **Switch/Checkbox**:
```json
{
  "field": "enabled",
  "type": "switch",
  "defaultChecked": false
}
```

5. **Color Picker**:
```json
{
  "field": "color",
  "type": "colorpicker"
}
```

6. **Markdown Editor**:
```json
{
  "field": "description",
  "type": "markdown"
}
```

7. **JSON Editor**:
```json
{
  "field": "config",
  "type": "json",
  "height": "200px"
}
```

8. **Text Array**:
```json
{
  "field": "tags",
  "type": "textarray"
}
```

9. **Object Array**:
```json
{
  "field": "items",
  "type": "objectarray",
  "object": [
    { "field": "name", "type": "text" },
    { "field": "value", "type": "number" }
  ]
}
```

10. **Slider**:
```json
{
  "field": "opacity",
  "type": "slider",
  "min": 0,
  "max": 1,
  "step": 0.01
}
```

11. **Map Preview**:
```json
{
  "type": "map",
  "width": 12,
  "height": "400px"
}
```

**Layout System**:
- 12-column grid layout
- Width property controls column span
- Automatic row wrapping
- Responsive grid spacing

**State Management**:
- Uses Redux for value storage
- Dot notation for nested paths
- Immediate updates on change
- Validation on blur/change

#### 3.2 MetaConfig Schema System

**Directory Created**: `src/metaconfigs/`

**MetaConfig Structure**:
```json
{
  "rows": [
    {
      "name": "Section Name",
      "description": "Section description",
      "subname": "Optional subtitle",
      "components": [
        {
          "field": "path.to.field",
          "name": "Field Label",
          "description": "Help text",
          "type": "component_type",
          "width": 12,
          "...": "type-specific properties"
        }
      ]
    }
  ]
}
```

**MetaConfigs Created**:
- tab-home-config.json
- tab-coordinates-config.json
- tab-time-config.json
- tab-userinterface-config.json
- layer-{type}-config.json (for each layer type)

**Tool Configs**:
- Located in `/src/essence/Tools/{TOOL}/config.json`
- Same structure as metaconfigs
- Includes defaultIcon and descriptions

#### 3.3 Validation System

**File Created**: `src/core/validators.js`

**Validation Rules**:
- Required fields
- Type checking (string, number, boolean)
- Range validation (min/max)
- Format validation (email, URL, JSON)
- Custom validation functions
- Conditional validation (depends on other fields)

**Validation Timing**:
- On change (immediate feedback)
- On blur (field exit)
- On save (final validation)

### Phase 4: Mission Management

#### 4.1 Mission Selection and Loading

**Implementation in Panel.js**:

```javascript
const handleMissionSelect = (mission) => {
  if (canEditMission(mission)) {
    dispatch(setMission(mission));
    // Configuration loads automatically via useEffect in Main.js
  } else {
    showPermissionError(mission);
  }
};
```

**Permission Checking**:
```javascript
const canEditMission = (mission) => {
  if (userPermissions.permission === "111") return true; // SuperAdmin
  if (userPermissions.permission !== "110") return false; // Not admin
  return userPermissions.missions_managing.includes(mission);
};
```

#### 4.2 Home Tab

**File Created**: `src/components/Tabs/Home/Home.js`

**Features Implemented**:
1. **Mission Title Display**: Large, styled mission name
2. **Action Buttons**:
   - Export Configuration (downloads JSON)
   - Upload Configuration (replaces current)
   - Clone Mission (duplicates to new name)
   - Delete Mission (with confirmation)

3. **Version History Component**:
   - Chronological list of saved versions
   - Restore to previous version
   - View version metadata

4. **General Configuration Form**:
   - Uses Maker component with tab-home-config.json
   - Projection settings
   - Map bounds
   - Description and metadata

**Modals Created**:
- UploadConfigModal.js
- CloneConfigModal.js
- DeleteConfigModal.js

**Version History Implementation** (`Versions.js`):
```javascript
const Versions = ({ queryVersions }) => {
  useEffect(() => {
    queryVersions();
  }, []);

  return (
    <VersionTimeline>
      {versions.map(version => (
        <VersionCard
          key={version.id}
          version={version}
          onRestore={handleRestore}
        />
      ))}
    </VersionTimeline>
  );
};
```

#### 4.3 New Mission Modal

**File Created**: `src/components/Panel/Modals/NewMissionModal/NewMissionModal.js`

**Form Fields**:
- Mission Name (required, validated for uniqueness)
- Description (optional)
- Template Selection (dropdown of existing missions or "blank")

**Workflow**:
1. User clicks "New Mission" button
2. Modal opens with form
3. User fills in details
4. On submit:
   - Validate mission name
   - Call create API
   - Add to mission list
   - Select new mission
   - Close modal

### Phase 5: Layer Management System

#### 5.1 Layer List Component

**File Created**: `src/components/Tabs/Layers/Layers.js`

**Key Features**:

1. **Hierarchical Display**:
   - Flattens layer tree for rendering
   - Visual indentation (40px per level)
   - Vertical guide lines showing hierarchy
   - Up to 12 levels deep

2. **Drag-and-Drop Reordering**:
   - react-beautiful-dnd integration
   - Visual drag feedback
   - Automatic hierarchy adjustment
   - Maintains parent-child relationships

3. **Layer Type Icons**:
   - Material Design Icons for each type
   - Color-coded backgrounds
   - Visual indicators for visibility and time-enabled

4. **Inline Actions**:
   - Indent left/right buttons
   - Drag handle
   - Add layer at position button

**Layer Flattening Algorithm**:
```javascript
const flattenLayers = (layers) => {
  const flat = [];
  const traverse = (nodes, depth) => {
    nodes.forEach(node => {
      flat.push({ layer: node, depth });
      if (node.sublayers) {
        traverse(node.sublayers, depth + 1);
      }
    });
  };
  traverse(layers, 0);
  return flat;
};
```

**Layer Reconstruction Algorithm**:
```javascript
const reconstructHierarchy = (flatLayers) => {
  const root = [];
  const stack = [{ sublayers: root, depth: -1 }];

  flatLayers.forEach(({ layer, depth }) => {
    while (stack[stack.length - 1].depth >= depth) {
      stack.pop();
    }
    const parent = stack[stack.length - 1];
    parent.sublayers.push(layer);
    if (layer.type === 'header') {
      layer.sublayers = [];
      stack.push({ ...layer, depth });
    }
  });

  return root;
};
```

#### 5.2 Layer Modal

**File Created**: `src/components/Tabs/Layers/Modals/LayerModal/LayerModal.js`

**Modal Structure**:
- Full-screen dialog
- Tabbed interface for complex layers
- Dynamic form based on layer type
- Save/Cancel actions

**Tab Organization**:
- General: Basic properties (name, type, visibility)
- Data: Data source configuration
- Style: Visual styling options
- Time: Temporal settings
- Variables: Custom variables and queries
- Legend: Legend configuration

**Layer Type Detection**:
```javascript
const LayerModal = ({ layerUUID }) => {
  const layer = findLayerByUUID(configuration.layers, layerUUID);
  const metaconfigPath = `layer-${layer.type}-config.json`;
  const metaconfig = require(`./metaconfigs/${metaconfigPath}`);

  return (
    <Dialog open={true} fullScreen>
      <Maker config={metaconfig} />
    </Dialog>
  );
};
```

**Save Logic**:
```javascript
const handleSave = () => {
  const updatedConfig = JSON.parse(JSON.stringify(configuration));
  updateLayerByUUID(updatedConfig.layers, layerUUID, modifiedLayer);
  dispatch(setConfiguration(updatedConfig));
  closeModal();
};
```

#### 5.3 Layer Types Implementation

**Layer Type Configurations Created**:

1. **Header Layer** (`layer-header-config.json`):
   - Name and description
   - Sublayer container properties
   - No data source required

2. **Vector Layer** (`layer-vector-config.json`):
   - GeoJSON URL or inline data
   - Style configuration (colors, widths, fills)
   - Popup templates
   - Dataset linkage
   - Feature filtering

3. **Tile Layer** (`layer-tile-config.json`):
   - Tile URL template
   - Attribution
   - Min/max zoom
   - Tile size
   - Bounds

4. **Model Layer** (`layer-model-config.json`):
   - 3D model URL (glTF, COLLADA)
   - Position and orientation
   - Scale and rotation
   - Shader properties

5. **Data Layer** (`layer-data-config.json`):
   - Database query configuration
   - Real-time update settings
   - Point rendering options

6. **Other Layer Types**:
   - Query, VectorTile, Velocity, Image, Video

**Common Properties**:
All layers share:
- UUID (unique identifier)
- Name (display name)
- Type (layer type)
- Visibility (show/hide)
- Time configuration (optional)
- Opacity (0-1)
- Sublayers (for headers)

### Phase 6: Tool Configuration System

#### 6.1 Tool Grid Display

**File Created**: `src/components/Tabs/Tools/Tools.js`

**Implementation**:

1. **Tool Card Grid**:
   - Responsive grid layout (Material-UI Grid)
   - Cards show: icon, name, description, on/off indicator
   - Hover effects
   - Click to configure

2. **Tool Configuration Loading**:
```javascript
useEffect(() => {
  calls.api('getToolConfig', null, (res) => {
    dispatch(setToolConfiguration(res));
  });
}, []);
```

3. **Tool Card Generation**:
```javascript
const getToolCards = () => {
  return Object.keys(toolConfiguration)
    .sort()
    .map(toolName => {
      const toolConfig = toolConfiguration[toolName];
      const missionTool = configuration.tools.find(t => t.name === toolName);
      const isActive = missionTool?.on !== false;

      return (
        <Grid item xs={12} sm={6} md={4} lg={3}>
          <ToolCard
            name={toolName}
            icon={toolConfig.defaultIcon}
            description={toolConfig.description}
            active={isActive}
            onClick={() => openToolModal(toolName, toolConfig)}
          />
        </Grid>
      );
    });
};
```

4. **Plugin Tools Card**:
   - Static card explaining plugin system
   - Instructions for adding custom tools
   - Naming conventions and directory structure

#### 6.2 Tool Modal

**File Created**: `src/components/Tabs/Tools/Modals/ToolModal/ToolModal.js`

**Modal Features**:
- Full-screen dialog for complex tools
- Tabbed interface when needed
- On/Off toggle at top
- Icon selector
- Dynamic form from tool's config.json

**Tool Configuration Structure**:
```javascript
// Example tool config structure
{
  name: "DrawTool",
  defaultIcon: "mdi-pencil",
  description: "Draw shapes on the map",
  descriptionFull: {
    title: "Drawing Tool",
    body: "Detailed description..."
  },
  config: {
    rows: [
      // Metaconfigs components
    ]
  }
}
```

**Save Tool Configuration**:
```javascript
const handleSaveToolConfig = (toolName, toolSettings) => {
  const updatedConfig = JSON.parse(JSON.stringify(configuration));

  // Find existing tool or create new entry
  let tool = updatedConfig.tools.find(t => t.name === toolName);
  if (!tool) {
    tool = { name: toolName };
    updatedConfig.tools.push(tool);
  }

  // Update tool properties
  Object.assign(tool, toolSettings);

  dispatch(setConfiguration(updatedConfig));
};
```

### Phase 7: User Management

#### 7.1 Users Page

**File Created**: `src/pages/Users/Users.js`

**Table Implementation**:

1. **Material-UI Table**:
   - Sortable columns
   - Pagination (25, 50, 100 rows per page)
   - Sticky header
   - Responsive design

2. **Table Columns**:
   - ID
   - Username
   - Email
   - Role (SuperAdmin/Admin/User badge)
   - Assigned Missions
   - Joined Date
   - Last Login/Update
   - Actions (Update, Reset Password, Delete)

3. **Role Display**:
```javascript
const getRoleBadge = (permission) => {
  if (permission === "111") {
    return <Badge color="pink">SuperAdmin</Badge>;
  } else if (permission === "110") {
    return <Badge color="blue">Admin</Badge>;
  } else {
    return <Badge color="gray">User</Badge>;
  }
};
```

4. **Auth Mode Indicator**:
   - Banner showing current AUTH setting
   - Description of what each mode means
   - Color-coded based on security level

**User Actions**:
- Update User: Opens modal to edit role and missions
- Reset Password: Opens modal to set new password
- Delete User: Confirmation dialog then delete

#### 7.2 User Modals

**Files Created**:
- `NewUserModal.js`: Create new user account
- `UpdateUserModal.js`: Modify user permissions
- `ResetPasswordModal.js`: Change user password
- `DeleteUserModal.js`: Confirm and delete user

**NewUserModal Implementation**:
```javascript
const NewUserModal = ({ queryUsers }) => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    permission: '100',
    missions_managing: []
  });

  const handleSubmit = () => {
    calls.api('account_create', formData, (res) => {
      if (res.status === 'success') {
        showSuccess('User created successfully');
        queryUsers(); // Refresh user list
        closeModal();
      }
    });
  };

  return (
    <Dialog open={true}>
      <TextField label="Username" value={formData.username} />
      <TextField label="Email" type="email" value={formData.email} />
      <TextField label="Password" type="password" value={formData.password} />
      <Select label="Role" value={formData.permission}>
        <MenuItem value="111">SuperAdmin</MenuItem>
        <MenuItem value="110">Admin</MenuItem>
        <MenuItem value="100">User</MenuItem>
      </Select>
      {formData.permission === '110' && (
        <MultiSelect
          label="Assigned Missions"
          options={missions}
          value={formData.missions_managing}
        />
      )}
    </Dialog>
  );
};
```

**Permission Logic**:
```javascript
// Only SuperAdmins can create SuperAdmins
const canCreateSuperAdmin = currentUser.permission === "111";

// Admins can only create Users, not other Admins
const availableRoles = currentUser.permission === "111"
  ? ["111", "110", "100"]
  : ["100"];
```

### Phase 8: Dataset Management

#### 8.1 Datasets Page

**File Created**: `src/pages/Datasets/Datasets.js`

**Features**:

1. **Dataset Table**:
   - Name, Last Updated, Actions
   - Sortable and paginated
   - Usage badge (how many layers use it)

2. **Dataset Actions**:
   - View Usage: Shows which missions/layers use the dataset
   - Download: Export dataset as JSON
   - Update: Replace or append data
   - Delete: Remove dataset (with usage warning)

3. **New Dataset Button**:
   - Opens upload modal
   - Supports CSV, JSON, GeoJSON
   - Configurable parsing options

#### 8.2 Dataset Modals

**Files Created**:
- `NewDatasetModal.js`: Upload new dataset
- `UpdateDatasetModal.js`: Update existing dataset
- `DeleteDatasetModal.js`: Delete with confirmation
- `LayersUsedByModal.js`: Show dataset usage

**NewDatasetModal Implementation**:

```javascript
const NewDatasetModal = ({ queryDatasets }) => {
  const [file, setFile] = useState(null);
  const [name, setName] = useState('');
  const [parseOptions, setParseOptions] = useState({
    delimiter: ',',
    header: true,
    skipEmptyLines: true
  });

  const handleUpload = () => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('name', name);
    formData.append('options', JSON.stringify(parseOptions));

    calls.api('datasets_create', formData, (res) => {
      if (res.status === 'success') {
        showSuccess('Dataset created successfully');
        queryDatasets();
        closeModal();
      }
    });
  };

  return (
    <Dialog open={true}>
      <TextField label="Dataset Name" value={name} />
      <Dropzone onDrop={setFile}>
        Drop CSV or JSON file here
      </Dropzone>
      <TextField label="Delimiter" value={parseOptions.delimiter} />
      <Switch label="First row is header" checked={parseOptions.header} />
    </Dialog>
  );
};
```

**LayersUsedByModal**:
- Lists all missions and layers referencing the dataset
- Prevents deletion if in use
- Links to edit those layers

### Phase 9: System Configuration Pages

#### 9.1 General Options

**File Created**: `src/pages/GeneralOptions/GeneralOptions.js`

**Configuration Sections**:

1. **STAC/TiTiler Settings**:
   - Item Limit (default: 100)
   - Scan Limit (default: 10000)
   - Time Limit (default: 5 seconds)

2. **Form Implementation**:
```javascript
const config = {
  rows: [
    {
      name: "STAC/TiTiler",
      subname: "COG Mosaicking",
      components: [
        {
          field: "temp.generalOptions.stac.mosaicItemLimit",
          name: "Item Limit",
          type: "number",
          min: 0,
          step: 1,
          default: 100,
          width: 3
        }
        // ... more fields
      ]
    }
  ]
};
```

3. **Save Logic**:
```javascript
const saveGeneralOptions = () => {
  const options = getIn(configuration, 'temp.generalOptions', null);
  calls.api('update_generaloptions', { options }, (res) => {
    showSuccess('General Options saved');
  });
};
```

#### 9.2 Webhooks

**File Created**: `src/pages/WebHooks/WebHooks.js`

**Features**:

1. **Webhook Configuration Array**:
   - Action trigger dropdown
   - HTTP method selection
   - URL with variable injection
   - Custom headers (JSON editor)
   - Request body (JSON editor)

2. **Variable Substitution System**:
```javascript
// Available variables
const webhookVariables = [
  'created_on', 'efolders', 'file_description', 'file_id',
  'file_name', 'file_owner', 'file_owner_group', 'folders',
  'geojson', 'hidden', 'intent', 'is_master', 'public',
  'public_editors', 'publicity_type', 'raw_file_description',
  'tags', 'template', 'updated_on'
];

// Example webhook config
{
  action: "DrawFileAdd",
  type: "POST",
  url: "https://api.example.com/webhook?file={file_name}",
  header: {
    "Content-Type": "application/json",
    "Authorization": "Bearer xxx"
  },
  body: {
    "event": "file_added",
    "file_id": "{file_id}",
    "geojson": "{geojson}"
  }
}
```

3. **Testing Capability**:
<!-- HUMAN REVIEW NEEDED: Was a webhook testing feature implemented? -->

#### 9.3 API Tokens

**File Created**: `src/pages/APITokens/APITokens.js`

**Features**:

1. **Token Table**:
   - Token name
   - Creation date
   - Expiration date
   - Permissions
   - Actions (Copy, Revoke)

2. **Token Generation**:
```javascript
const generateToken = (name, permissions, expiresIn) => {
  calls.api('generate_token', {
    name,
    permissions,
    expiresIn  // Days until expiration
  }, (res) => {
    setGeneratedToken(res.token);
    showTokenModal(); // Shows token once, not retrievable later
  });
};
```

3. **Permission Configuration**:
   - Read missions
   - Write missions
   - Read datasets
   - Write datasets
   - Admin operations

#### 9.4 GeoDatasets, STAC, APIs

**Files Created**:
- `src/pages/GeoDatasets/GeoDatasets.js`
- `src/pages/STAC/STAC.js`
- `src/pages/APIs/APIs.js`

**Implementation Similar to Datasets**:
- Table-based interface
- Upload/download capabilities
- Usage tracking
- CRUD operations

### Phase 10: Configuration Saving and Locking

#### 10.1 SaveBar Component

**File Created**: `src/components/SaveBar/SaveBar.js`

**Features**:

1. **Unsaved Changes Detection**:
```javascript
const hasUnsavedChanges = () => {
  const currentHash = hash(configuration);
  const savedHash = hash(savedConfiguration);
  return currentHash !== savedHash;
};
```

2. **Action Buttons**:
   - Save: Commit changes to database
   - Revert: Discard unsaved changes
   - Preview: Open mission in iframe

3. **Save Process**:
```javascript
const handleSave = () => {
  setLoading(true);

  calls.api('update', {
    mission: mission,
    config: configuration
  }, (res) => {
    setLoading(false);
    if (res.status === 'success') {
      showSuccess('Configuration saved successfully');
      updateSavedConfig(configuration);
      releaseLock();
    }
  });
};
```

4. **Revert Process**:
```javascript
const handleRevert = () => {
  if (confirm('Discard all unsaved changes?')) {
    dispatch(setConfiguration(savedConfiguration));
  }
};
```

5. **Preview Feature**:
```javascript
const handlePreview = () => {
  // Save current config to temp location
  const tempConfig = configuration;

  // Open iframe with temp config
  setPreviewModal({
    open: true,
    url: `/configure/preview?mission=${mission}&temp=true`
  });
};
```

#### 10.2 Configuration Locking

**WebSocket Integration** (`src/core/Websocket.js`):

```javascript
const Websocket = () => {
  useEffect(() => {
    const ws = new WebSocket(websocketURL);

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);

      switch (message.type) {
        case 'config_locked':
          dispatch(setLockConfig({
            locked: true,
            user: message.user,
            mission: message.mission
          }));
          break;

        case 'config_unlocked':
          dispatch(clearLockConfig());
          break;

        case 'config_updated':
          if (message.mission === currentMission) {
            showNotification('Configuration updated by another user');
            // Optionally reload configuration
          }
          break;
      }
    };

    return () => ws.close();
  }, []);

  return null;
};
```

**Lock Acquisition**:
```javascript
// When user selects a mission
const handleMissionSelect = (mission) => {
  calls.api('acquire_lock', { mission }, (res) => {
    if (res.locked) {
      showError(`Mission is being edited by ${res.user}`);
    } else {
      dispatch(setMission(mission));
    }
  });
};
```

**Lock Release**:
```javascript
// On save, revert, or mission deselect
const releaseLock = () => {
  calls.api('release_lock', { mission }, () => {
    console.log('Lock released');
  });
};

// Cleanup on unmount or browser close
useEffect(() => {
  return () => {
    if (mission) {
      releaseLock();
    }
  };
}, [mission]);
```

### Phase 11: UI Components and Utilities

#### 11.1 Reusable Components

**ColorButton Component** (`src/components/ColorButton/ColorButton.js`):
- Color picker with presets
- Hex, RGB, HSL input support
- Outside click detection to close
- Integration with react-color

**SnackBar Component** (`src/components/SnackBar/SnackBar.js`):
- Global notification system
- Success, error, warning, info variants
- Auto-dismiss after 6 seconds
- Dismiss button
- Queue for multiple messages

**Map Component** (`src/components/Map/Map.js`):
- Leaflet integration
- Shows layer preview
- Displays current bounds
- Click to set coordinates

**VideoPreview Component** (`src/components/VideoPreview/VideoPreview.js`):
- Preview video layers
- Playback controls
- Seek to timestamp

#### 11.2 Utility Functions

**File Created**: `src/core/utils.js`

**Key Utilities**:

1. **Deep Get/Set**:
```javascript
// Get value from nested object using dot notation
const getIn = (obj, path, defaultValue) => {
  const keys = path.split('.');
  let value = obj;
  for (const key of keys) {
    if (value == null) return defaultValue;
    value = value[key];
  }
  return value !== undefined ? value : defaultValue;
};

// Set value in nested object using dot notation
const setIn = (obj, path, value) => {
  const keys = path.split('.');
  const last = keys.pop();
  let target = obj;
  for (const key of keys) {
    if (!target[key]) target[key] = {};
    target = target[key];
  }
  target[last] = value;
  return obj;
};
```

2. **Array Manipulation**:
```javascript
// Reorder array items (for drag-and-drop)
const reorderArray = (array, startIndex, endIndex) => {
  const result = Array.from(array);
  const [removed] = result.splice(startIndex, 1);
  result.splice(endIndex, 0, removed);
  return result;
};

// Insert item after UUID
const insertLayerAfterUUID = (layers, newLayer, afterUUID) => {
  // Recursively find and insert
  for (let i = 0; i < layers.length; i++) {
    if (layers[i].uuid === afterUUID) {
      layers.splice(i + 1, 0, newLayer);
      return true;
    }
    if (layers[i].sublayers) {
      if (insertLayerAfterUUID(layers[i].sublayers, newLayer, afterUUID)) {
        return true;
      }
    }
  }
  return false;
};
```

3. **Download Utilities**:
```javascript
// Download object as JSON file
const downloadObject = (obj, filename, extension = '.json') => {
  const json = JSON.stringify(obj, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename + extension;
  link.click();
  URL.revokeObjectURL(url);
};
```

4. **UUID Generation**:
```javascript
// Generate unique layer IDs
window.newUUIDCount = Date.now();

const generateUUID = () => {
  window.newUUIDCount++;
  return window.newUUIDCount;
};
```

#### 11.3 Validators

**File Created**: `src/core/validators.js`

**Validation Functions**:

```javascript
// Required field
const required = (value) => {
  return value != null && value !== '' ? null : 'This field is required';
};

// Valid number
const isNumber = (value) => {
  return !isNaN(value) ? null : 'Must be a valid number';
};

// Valid JSON
const isJSON = (value) => {
  try {
    JSON.parse(value);
    return null;
  } catch (e) {
    return 'Must be valid JSON';
  }
};

// URL validation
const isURL = (value) => {
  try {
    new URL(value);
    return null;
  } catch (e) {
    return 'Must be a valid URL';
  }
};

// Range validation
const inRange = (min, max) => (value) => {
  const num = Number(value);
  if (num < min) return `Must be at least ${min}`;
  if (num > max) return `Must be at most ${max}`;
  return null;
};
```

### Phase 12: Styling and Theming

#### 12.1 Material-UI Theme

**Theme Configuration**:

```javascript
const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#2196f3'
    },
    secondary: {
      main: '#424242'
    },
    accent: {
      main: '#ffd740'
    },
    swatches: {
      grey: {
        0: '#ffffff',
        100: '#f5f5f5',
        200: '#eeeeee',
        300: '#e0e0e0',
        // ... through 1000
        1000: '#1a1a1a'
      },
      p: {
        0: '#2196f3',
        // ... color palette
        13: '#ff9800'
      },
      red: {
        500: '#f44336'
      }
    }
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif'
  }
});
```

#### 12.2 Component Styling Approach

**makeStyles Pattern**:

```javascript
const useStyles = makeStyles((theme) => ({
  componentName: {
    width: '100%',
    height: '100%',
    background: theme.palette.swatches.grey[1000],
    color: theme.palette.swatches.grey[200]
  },
  subElement: {
    padding: theme.spacing(2),
    '&:hover': {
      background: theme.palette.swatches.grey[900]
    }
  }
}));

const Component = () => {
  const c = useStyles();
  return <div className={c.componentName}>...</div>;
};
```

#### 12.3 Responsive Design

**Breakpoint Usage**:

```javascript
const useStyles = makeStyles((theme) => ({
  container: {
    [theme.breakpoints.down('sm')]: {
      padding: '8px'
    },
    [theme.breakpoints.up('md')]: {
      padding: '16px'
    },
    [theme.breakpoints.up('lg')]: {
      padding: '32px'
    }
  }
}));
```

**Grid System**:

```javascript
<Grid container spacing={2}>
  <Grid item xs={12} sm={6} md={4} lg={3}>
    {/* Responsive card */}
  </Grid>
</Grid>
```

### Phase 13: Testing and Quality Assurance

#### 13.1 Testing Setup

**File Created**: `src/core/Configure.test.js`

<!-- HUMAN REVIEW NEEDED: What tests were implemented? What testing strategy was used? -->

**Testing Libraries**:
- @testing-library/react
- @testing-library/jest-dom
- @testing-library/user-event

#### 13.2 Development Tools

**Developer Experience Enhancements**:

1. **Console Logging**:
   - Structured logging for debugging
   - Warning messages for misuse
   - Error tracking

2. **Redux DevTools Integration**:
   - Time-travel debugging
   - State inspection
   - Action history

3. **React DevTools Support**:
   - Component tree inspection
   - Props and state viewing
   - Performance profiling

### Phase 14: Build and Deployment

#### 14.1 Build Configuration

**package.json Scripts**:
```json
{
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build && node scripts/make-pug-index.js",
    "test": "react-scripts test",
    "eject": "react-scripts eject"
  }
}
```

**make-pug-index.js Script**:
```javascript
// Converts build/index.html to build/index.pug for Node.js templating
const fs = require('fs');
const html2pug = require('html2pug');

const html = fs.readFileSync('./build/index.html', 'utf8');
const pug = html2pug(html, { tabs: true });
fs.writeFileSync('./build/index.pug', pug);
console.log('Created build/index.pug');
```

#### 14.2 Production Optimization

**Optimizations Applied**:

1. **Code Splitting**:
   - Route-based splitting
   - Lazy loading of modals
   - Dynamic imports for heavy components

2. **Asset Optimization**:
   - Image compression
   - CSS minification
   - JS minification and uglification

3. **Bundle Analysis**:
   - Identifying large dependencies
   - Removing unused code
   - Optimizing imports

4. **Caching Strategy**:
   - Static assets with cache headers
   - Service worker (optional)
   - Version-based cache busting

#### 14.3 Integration with MMGIS Backend

**Backend Route Configuration**:

```javascript
// In main MMGIS server.js
app.use('/configure', express.static('configure/build'));
app.get('/configure/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'configure/build/index.html'));
});
```

**API Route Protection**:

```javascript
// Middleware to check admin permissions
const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.permission < 110) {
    return res.status(403).json({
      status: 'error',
      message: 'Admin access required'
    });
  }
  next();
};

// Apply to configure API routes
app.use('/api/configure', requireAdmin);
```

### Phase 15: Documentation and Training

#### 15.1 Internal Documentation

**README.md Created**: `/configure/README.md`

**Contents**:
- Development setup instructions
- Build process explanation
- MetaConfig documentation
- Common troubleshooting

#### 15.2 Code Comments

**Documentation Standards**:
- Component purpose and usage
- Complex algorithm explanations
- API endpoint documentation
- Configuration schema descriptions

## Technical Decisions and Rationale

### Architecture Decisions

1. **Separate React App**:
   - **Decision**: Create standalone React app in /configure
   - **Rationale**: Isolation from main MMGIS client code, independent build process, easier maintenance
   - **Tradeoff**: Separate build step, duplicate dependencies

2. **Redux for State Management**:
   - **Decision**: Use Redux Toolkit for global state
   - **Rationale**: Complex nested data, undo/redo support, time-travel debugging
   - **Alternative Considered**: React Context API (insufficient for deep trees)

3. **Material-UI Component Library**:
   - **Decision**: Use MUI for all UI components
   - **Rationale**: Consistent design, accessibility built-in, extensive component library
   - **Alternative Considered**: Custom components (too time-consuming)

4. **MetaConfig System**:
   - **Decision**: JSON-driven dynamic form generation
   - **Rationale**: Consistency, maintainability, extensibility without UI changes
   - **Alternative Considered**: Hard-coded forms (unmaintainable at scale)

5. **Dot Notation for Nested Fields**:
   - **Decision**: Use string paths like "projection.epsg"
   - **Rationale**: Simple API, works with deeply nested objects, no complex references
   - **Alternative Considered**: JSONPath (overly complex)

### UI/UX Decisions

1. **Two-Panel Layout**:
   - **Decision**: Fixed left nav, scrollable right content
   - **Rationale**: Always-visible mission list, familiar pattern
   - **Alternative Considered**: Single panel with drawer (less efficient)

2. **Drag-and-Drop Layers**:
   - **Decision**: Visual drag-and-drop with react-beautiful-dnd
   - **Rationale**: Intuitive layer organization, visual feedback
   - **Alternative Considered**: Up/down buttons (less intuitive)

3. **Full-Screen Modals**:
   - **Decision**: Use full-screen dialogs for complex forms
   - **Rationale**: More space for nested tabs and complex configurations
   - **Alternative Considered**: Side drawers (insufficient space)

4. **Inline Help Text**:
   - **Decision**: Description text under each form field
   - **Rationale**: Contextual help, no need to search documentation
   - **Alternative Considered**: Separate help panel (context switching)

### Data Management Decisions

1. **Configuration as JSON Blob**:
   - **Decision**: Store full configuration as JSON in database
   - **Rationale**: Flexibility, easy export/import, version control friendly
   - **Alternative Considered**: Normalized tables (inflexible schema)

2. **Client-Side Validation**:
   - **Decision**: Validate in browser before sending to server
   - **Rationale**: Immediate feedback, reduced server load
   - **Note**: Server still validates for security

3. **Optimistic Updates**:
   - **Decision**: Update UI immediately, then save to server
   - **Rationale**: Responsive feel, can revert on failure
   - **Alternative Considered**: Wait for server (feels slow)

4. **WebSocket for Locking**:
   - **Decision**: Real-time lock status via WebSocket
   - **Rationale**: Prevents concurrent edit conflicts, immediate feedback
   - **Alternative Considered**: Polling (inefficient, delayed)

## Success Metrics

<!-- HUMAN REVIEW NEEDED: What metrics were used to measure success? -->
<!-- HUMAN REVIEW NEEDED: Were there performance benchmarks? -->
<!-- HUMAN REVIEW NEEDED: What was the user adoption rate? -->

## Lessons Learned

<!-- HUMAN REVIEW NEEDED: What went well? What would you do differently? -->

## Conclusion

This implementation plan documents the comprehensive approach taken to build the MMGIS Administrative Tools feature. The modular architecture, metaconfiguration system, and thoughtful component design resulted in a maintainable, extensible administrative interface that successfully supports the complex requirements of multi-mission MMGIS deployments.

The feature was implemented incrementally across 15 phases, from foundation through deployment, with each phase building on the previous. The use of modern React patterns, Material-UI components, and a dynamic form generation system created a consistent, professional interface that administrators can learn quickly and use effectively.

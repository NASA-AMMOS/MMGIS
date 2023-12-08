import { createTheme } from "@mui/material/styles";

export const palette = {
  type: "light",
  primary: {
    main: "#FFFFFF",
  },
  secondary: {
    main: "#1a1a1a",
  },
  accent: {
    main: "#08aeea",
    secondary: "ffdd5c",
    tertiary: "#d26100",
  },
  text: {
    primary: "#000000",
    secondary: "#f4f5f5",
  },
  active: {},
  swatches: {
    grey: {
      0: "#000000",
      50: "#0f1010",
      100: "#1d1f20",
      150: "#1a1a1a",
      200: "#2c2f30",
      300: "#3a3e40",
      400: "#575d60",
      500: "#747c81",
      600: "#949a9e",
      700: "#b4b8bb",
      800: "#d4d6d8",
      900: "#f4f5f5",
      1000: "#FFFFFF",
    },
    blue: {},
    lightblue: {},
    green: {},
    yellow: {},
    orange: {},
    red: {},
  },
  layers: {
    vector: "#0792c5",
    tile: "#75351e",
    vectortile: "#78b1c2",
    query: "#87b051",
    data: "#c43541",
    model: "##dbb658",
  },
};

export const theme = {
  palette,
  spacing: 4,
  headHeights: [56, 40, 40, 32, 24],
  breakpoints: {
    values: {
      xs: 0,
      sm: 600,
      md: 960,
      lg: 1280,
      xl: 1920,
    },
  },
  overrides: {
    MuiIconButton: {
      root: {
        borderRadius: "0px",
      },
    },
    MuiButton: {
      contained: {
        fontSize: "13px",
        padding: "3px 10px",
        backgroundColor: palette.primary.light,
        borderRadius: "2px",
        color: palette.text.secondary,
        "&:hover": {
          backgroundColor: palette.accent.tertiary,
        },
      },
      startIcon: {
        marginRight: "4px",
      },
    },
    MuiInput: {
      underline: {
        "&:after": {
          borderBottom: `2px solid ${palette.accent.main}`,
        },
      },
    },
    MuiListSubheader: {
      root: {
        color: palette.text.main,
        fontWeight: 700,
        background: `${palette.swatches.grey.grey100} !important`,
      },
    },
    MuiTooltip: {
      tooltip: {
        fontSize: "1em",
        color: palette.text.secondary,
        backgroundColor: palette.swatches.grey.grey800,
        maxWidth: "1400px",
      },
      arrow: {
        color: palette.secondary.main,
      },
    },
    MuiBadge: {
      colorPrimary: {
        backgroundColor: palette.accent.secondary,
      },
    },
    MuiTabs: {
      root: {
        minHeight: "40px",
      },
    },
    MuiTab: {
      root: {
        minHeight: "40px",
      },
    },
    MuiCheckbox: {
      root: {
        color: palette.swatches.grey.grey300,
        "&$checked": {
          color: palette.active.main,
        },
        padding: "3.25px",
      },
    },
    MuiPagination: {
      root: {},
      ul: {},
    },
    MuiPaginationItem: {
      root: {
        height: "24px",
        minWidth: "24px",
      },
    },
    MuiCircularProgress: {
      colorPrimary: {
        color: palette.accent.main,
      },
    },
    MuiSwitch: {
      root: {
        "& > span": {
          color: palette.primary.light,
          "&$checked": {
            color: palette.accent.main,
          },
          "&$checked + $track": {
            backgroundColor: palette.accent.main,
          },
        },
      },
    },
    MuiDialogActions: {
      root: {
        backgroundColor: palette.swatches.grey.grey150,
        padding: "4px",
        justifyContent: "space-between",
      },
    },
    MuiSlider: {
      root: {
        color: palette.accent.main,
      },
      rail: {
        color: palette.swatches.grey.grey500,
      },
      valueLabel: {
        "& > span > span": {
          color: "black",
          fontWeight: "bold",
        },
      },
    },
    MuiTypography: {
      root: {
        fontFamily: '"Inter", "Helvetica", "Arial", sans-serif',
      },
      h2: {
        fontFamily: '"Inter", "Helvetica", "Arial", sans-serif',
      },
    },
    MuiSnackbar: {
      anchorOriginTopCenter: {
        top: "16px !important",
      },
    },
    MuiInputLabel: {
      outlined: {
        color: palette.text.primary,
      },
    },
    MuiSelect: {
      outlined: {
        padding: "8px 32px 8px 14px",
      },
    },
  },
};

const light = createTheme(theme);

export default light;

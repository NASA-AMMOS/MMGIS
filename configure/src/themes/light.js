import { createTheme } from "@mui/material/styles";

export const palette = {
  type: "light",
  primary: {
    main: "#000000",
  },
  secondary: {
    main: "#1a1a1a",
  },
  accent: {
    main: "#08aeea",
    secondary: "#ffdd5c",
    tertiary: "#d26100",
  },
  text: {
    primary: "#000000",
    secondary: "#000000",
    tertiary: "#04f5f5",
  },
  active: {
    main: "#0792c5",
  },
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
      850: "#efefef",
      900: "#f4f5f5",
      950: "#fafafa",
      1000: "#FFFFFF",
    },
    blue: {},
    lightblue: {},
    green: {},
    yellow: {},
    orange: {},
    red: {
      500: "#8e1515",
    },
    p: {
      0: "#dbb658",
      1: "#c0822f",
      2: "#ffeaaf",
      3: "#87b051",
      4: "#c43541",
      5: "#edd49e",
      6: "#e7bdcb",
      7: "#72d1cb",
      8: "#11495c",
      9: "#75351e",
      10: "#78b1c2",
      11: "#24806d",
      12: "#a8572e",
      13: "#246480",
    },
    r: {
      1: "#b30000",
      2: "#7c1158",
      3: "#4421af",
      4: "#1a53ff",
      5: "#00b7c7",
      6: "#8be04e",
      7: "#ebdc78",
    },
  },
  layers: {
    vector: "#245980",
    tile: "#67401d",
    vectortile: "#0792c5",
    query: "#4c8b2d",
    data: "#c43541",
    model: "#a98732",
    velocity: "#24807c",
    image: "#b0518f",
  },
};

export const theme = {
  palette,
  spacing: 4,
  headHeights: [56, 46, 46, 32, 24],
  breakpoints: {
    values: {
      xs: 0,
      sm: 600,
      md: 960,
      lg: 1280,
      xl: 1920,
    },
  },
  components: {
    MuiIconButton: {
      root: {
        borderRadius: "0px",
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          fontSize: "13px",
          padding: "3px 10px",
          borderRadius: "0px",
          color: palette.text.primary,
        },
        contained: {
          fontSize: "13px",
          padding: "3px 10px",
          background: palette.swatches.p[0],
          borderRadius: "0px",
          color: palette.text.primary,
          "&:hover": {
            background: palette.swatches.p[2],
          },
        },
      },
      startIcon: {
        marginRight: "4px",
      },
    },
    MuiInput: {
      underline: {
        "&:before": {
          borderBottom: `1px solid ${palette.swatches.grey[700]}`,
        },
        "&:after": {
          borderBottom: `1px solid ${palette.accent.main}`,
        },
      },
    },
    MuiFilledInput: {
      styleOverrides: {
        root: {
          backgroundColor: "#f0f0f0",
          "&::before, &::after": {
            borderBottom: `1px solid ${palette.swatches.grey[700]}`,
          },
          "&:hover:not(.Mui-disabled, .Mui-error):before": {
            borderBottom: `1px solid ${palette.accent.main}`,
          },
          "&.Mui-focused:after": {
            borderBottom: `1px solid ${palette.accent.main}`,
          },
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
      styleOverrides: {
        root: {
          "&.Mui-checked": {
            color: palette.active.main,
          },
        },
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
    MuiSelect: {
      outlined: {
        padding: "8px 32px 8px 14px",
      },
    },
  },
};

const light = createTheme(theme);

export default light;

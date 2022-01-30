import { createTheme } from "@mui/material/styles";

export default createTheme({
  palette: {
    mode: "dark",
    background: {
      default: "#3e4451",
    },
  },
  breakpoints: {
    values: {
      xs: 0,
      sm: 576,
      md: 768,
      lg: 1024,
      xl: 1200,
    },
  },
});

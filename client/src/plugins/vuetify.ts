import "@mdi/font/css/materialdesignicons.css";
import "@fontsource-variable/fredoka";
import "@fontsource-variable/outfit";
import "vuetify/styles";
import { createVuetify } from "vuetify";

export default createVuetify({
  defaults: {
    VBtn: { rounded: "pill", size: "large", variant: "flat" },
    VTextField: { variant: "solo-filled", flat: true, hideDetails: "auto" },
  },
  theme: {
    defaultTheme: "flashback",
    themes: {
      flashback: {
        dark: true,
        colors: {
          background: "#0b0720",
          surface: "#1a1340",
          primary: "#ff3d9a",
          secondary: "#7c5cff",
          success: "#2ee59d",
          error: "#ff5c70",
          warning: "#ffc94d",
          info: "#27d9ff",
        },
      },
    },
  },
});

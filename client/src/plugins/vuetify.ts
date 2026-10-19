import "@mdi/font/css/materialdesignicons.css";
import "vuetify/styles";
import { createVuetify } from "vuetify";

export default createVuetify({
  theme: {
    defaultTheme: "flashback",
    themes: {
      flashback: {
        dark: true,
        colors: {
          background: "#0f0b1e",
          surface: "#1a1433",
          primary: "#ff5ca8",
          secondary: "#6c5ce7",
          success: "#2ecc71",
          error: "#ff5252",
          warning: "#ffb84d",
        },
      },
    },
  },
});

import logoDorado from '../imagenes/logoDorado.png';

/**
 * brandConfig.js
 * Configuración global del sistema BrandHub POS / Multimarca:
 * - Nombre de la aplicación y empresa
 * - Logos (URL, favicon, icono)
 * - Tipografía y fuentes
 * - Paleta de colores centralizada
 * - Helpers utilitarios para aplicar estilos dinámicamente
 */

export const brandConfig = {
  // 1. Identidad de la Marca / Empresa
  name: "Room Concept Store",
  tagline: "Find Your Style",
  companyName: "Room Concept Store",
  branchName: "Managua",

  // 2. Logos e Iconografía
  logo: {
    // Logo principal del sidebar y header
    main: logoDorado,

  },

  // 3. Tipografía
  typography: {
    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    headings: '"Inter", sans-serif',
    code: '"JetBrains Mono", monospace',
  },

  // 4. Paleta de Colores
  colors: {
    // Colores Principales (Brand)
    primary: {
      DEFAULT: "#C9A46D",
      container: "#C9A46D",
      fixed: "#F7D1D6",
      fixedDim: "#E9B7C3",
      onPrimary: "#ffffff",
      onPrimaryContainer: "#FFFFFF",
    },

    // Colores Secundarios (Éxito / Operaciones)
    secondary: {
      DEFAULT: "#8A775C",
      container: "#F3E2D9",
      fixed: "#F3E2D9",
      fixedDim: "#E9B7C3",
      onSecondary: "#ffffff",
      onSecondaryContainer: "#574734",
    },

    // Colores Terciarios (Avisos / Acentos)
    tertiary: {
      DEFAULT: "#9B7646",
      container: "#C9A46D",
      fixed: "#F3E2D9",
      fixedDim: "#E9B7C3",
      onTertiary: "#ffffff",
      onTertiaryContainer: "#382E29",
    },

    // Colores de Alerta / Error
    error: {
      DEFAULT: "#ba1a1a",
      container: "#ffdad6",
      onError: "#ffffff",
      onErrorContainer: "#93000a",
    },

    // Superficies y Fondos
    surface: {
      background: "#F3E2D9",
      bright: "#FFFFFF",
      dim: "#E9B7C3",
      lowest: "#ffffff", // Tarjetas y tablas
      low: "#F3E2D9",    // Filas alternadas y barras
      container: "#F7D1D6", // Hover y badges
      high: "#E9B7C3",
      highest: "#F3E2D9",
    },

    // Textos y Bordes
    text: {
      primary: "#382E29",      // on-surface
      secondary: "#76655C",    // on-surface-variant
      muted: "#937F73",        // outline
      disabled: "#D8C5BC",     // outline-variant
    },
  },

  // 5. Ajustes de Impresión Térmica de Etiquetas
  thermalPrinter: {
    defaultFormat: "50x30mm",
    supportedFormats: ["50x30mm", "60x40mm", "40x25mm"],
    defaultColumns: 2,
    showBrandOnLabel: true,
  },
};

export default brandConfig;

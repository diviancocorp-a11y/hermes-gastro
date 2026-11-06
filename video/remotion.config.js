import { Config } from '@remotion/cli/config';

// Usa el public/ del repo: logo y fuentes de marca salen de la misma fuente
// que la landing, sin copiar binarios.
Config.setPublicDir('../public');
Config.setVideoImageFormat('jpeg');

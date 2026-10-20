// src/components/landing/clientes.js
// Los clientes que muestran la landing y /diagnostico, con las fotos de sus
// productos (public/brand/landing). Solo negocios que corren sobre Dico: cada
// foto lleva el nombre del negocio y nunca se presenta como un ejemplo de Dico.

// Solo tenants reales del edificio (verificado en la base el 19/oct/2026).
export const CLIENTES = [
  ['La Nona Pato', 'Panadería', 'Empanadas, alfajores de maicena, bruschettas, picadas y tortilla'],
  ['Crazy Miga', 'Cookies con delivery en Zona Norte', 'Órbita Blanca, Choco Eclipse y Dulce Nebulosa'],
];

export const FOTOS = [
  { src: '/brand/landing/lnp-empanadas.webp', ancho: 789, alto: 374, alt: 'Fuente blanca con empanadas horneadas sobre una tabla de madera', pie: 'Empanadas', de: 'La Nona Pato' },
  { src: '/brand/landing/crazy-orbita-blanca.webp', ancho: 900, alto: 900, alt: 'Cookie con chips de chocolate blanco sobre una piedra oscura', pie: 'Órbita Blanca', de: 'Crazy Miga' },
  { src: '/brand/landing/lnp-alfajores.webp', ancho: 789, alto: 374, alt: 'Alfajores de maicena con dulce de leche y coco rallado', pie: 'Alfajores de maicena', de: 'La Nona Pato' },
  { src: '/brand/landing/crazy-choco-eclipse.webp', ancho: 900, alto: 900, alt: 'Cookie con chips de chocolate negro sobre una piedra oscura', pie: 'Choco Eclipse', de: 'Crazy Miga' },
  { src: '/brand/landing/lnp-bruschettas.webp', ancho: 789, alto: 374, alt: 'Bruschettas con jamón crudo, morrones asados y cebolla caramelizada', pie: 'Bruschettas', de: 'La Nona Pato' },
  { src: '/brand/landing/lnp-picada.webp', ancho: 789, alto: 374, alt: 'Tabla de picada con fiambres, quesos, aceitunas y palta', pie: 'Picada', de: 'La Nona Pato' },
];

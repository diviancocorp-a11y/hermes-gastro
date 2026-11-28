// src/catalog-pro/plantillas/cochi/pantallas.js
// Estetica de las pantallas del pedido de Cochi (ver LEEME.md, seccion "Otras
// pantallas"). Es un chunk aparte: solo lo baja Cochi.
import "./pantallas.css";

// Capas decorativas por pantalla. Clave = lugar; valor = tu componente, que
// recibe `{ datos }` (solo valores para mostrar, congelados). Ejemplo:
//   import CochiPedidoRecibido from "./CochiPedidoRecibido";
//   export const DECORACIONES = { "pedido-recibido": CochiPedidoRecibido };
// Lugares y datos:
//   ficha            { nombre, categoria }
//   carrito          { cantidad }
//   checkout         { paso: "datos" | "entrega" | "pago" }
//   confirmando      {}
//   pedido-recibido  { codigo, entrega: "retiro" | "envio", nombreLocal }
//   seguimiento      { estado, entrega }
// Constante de modulo: no la muevas adentro de una funcion.
export const DECORACIONES = {};

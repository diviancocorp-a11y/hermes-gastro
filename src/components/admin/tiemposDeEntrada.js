/**
 * Cuanto dura la entrada del login, y por que dura eso.
 *
 * La entrada no dura "lo que quede bien": dura lo que tarda en verse el gesto
 * completo. Primero el logo DICO se asienta, y recien DESPUES el aro Volt de
 * la O late dos veces enteras. Con los 1,4s de la primera version el logo
 * todavia estaba llegando cuando la pantalla ya se iba, y el latido no se
 * alcanzaba a ver ni una vez.
 *
 * Los numeros estan atados entre si a proposito —`intro` se calcula, no se
 * escribe— para que tocar el latido sin tocar el total no vuelva a cortar el
 * gesto por la mitad.
 *
 * Vive en su propio archivo y no dentro de `LoginScreen` porque un modulo que
 * exporta un componente Y constantes rompe el fast refresh de Vite.
 */
const ENTRADA_MS = 900;   // lo que tarda `hg-splash-in` en asentar el logo
const LATIDO_MS = 1200;   // un latido del aro
const LATIDOS = 2;        // cuantos se ven antes de abrir la puerta

export const TIEMPOS = {
  entrada: ENTRADA_MS,
  latido: LATIDO_MS,
  latidos: LATIDOS,
  intro: ENTRADA_MS + LATIDO_MS * LATIDOS,
};

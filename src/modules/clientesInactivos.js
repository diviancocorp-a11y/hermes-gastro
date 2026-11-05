/**
 * Clientes que dejaron de comprar: el dato real que ve un negocio sin CRM.
 *
 * Usa el mismo corte que CRM.jsx: un cliente "no compra hace 3 meses" si su
 * ultimo pedido tiene MAS de 90 dias (`days_since_last_order > 90`, el borde
 * de "Últimos 3 meses"). Aca se cuentan juntos los dos grupos que el CRM
 * separa ("Más de 3 meses" e "Inactivos +6 meses"): para el aviso son todos
 * clientes que dejaron de venir.
 *
 * `clientes` es la salida de agregarClientes (services/platformCrm.js), que
 * trae `days_since_last_order` ya calculado sobre TODA la historia del
 * negocio. No se calcula sobre los pedidos que carga el panel: son los
 * ultimos 100, y justo los clientes que no vuelven quedan afuera.
 */
export const DIAS_SIN_COMPRAR = 90;

export function contarClientesInactivos(clientes, dias = DIAS_SIN_COMPRAR) {
  return (clientes || []).filter(c =>
    c?.days_since_last_order !== null
    && c?.days_since_last_order !== undefined
    && c.days_since_last_order > dias).length;
}

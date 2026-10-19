// El aviso de un monto que parseMontoAR no entiende. Lo usan las tres
// pantallas que mueven efectivo (CajaPanel, MiMiniCaja, PantallaDeCobro):
// reemplaza a la ayuda del campo, porque con un numero que no se entiende el
// boton queda apagado, y sin decir por que parece roto.
export default function MontoInvalido({ id, style }) {
  return (
    <small id={id} aria-live="polite" style={{
      display: 'block', marginTop: 5, fontSize: 12.5, color: 'var(--ag-bad)',
      ...style,
    }}>
      No entiendo ese número. Los centavos van con coma: 1.500,50
    </small>
  );
}

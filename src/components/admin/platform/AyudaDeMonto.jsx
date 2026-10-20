// La ayuda de un campo de monto, y en el mismo lugar el aviso cuando
// parseMontoAR no entiende el numero. La usan las tres pantallas que mueven
// efectivo (CajaPanel, MiMiniCaja, PantallaDeCobro): con un numero que no se
// entiende el boton queda apagado, y sin decir por que parece roto.
//
// La region aria-live esta SIEMPRE montada y lo que cambia es su contenido.
// Un aria-live que entra al DOM con el texto ya adentro no se anuncia en
// muchos lectores de pantalla (WCAG 4.1.3, mensajes de estado). Por eso el
// campo apunta con aria-describedby siempre al mismo id, valido o no.
//
// El contenedor no lleva margen: vacio mide 0 y no empuja nada. El margen y
// el tamano van en el contenido (la ayuda que pasa cada pantalla, o el aviso),
// asi ayuda y aviso ocupan el mismo lugar sin salto de layout.
export default function AyudaDeMonto({
  id, invalido, as = 'span', style, avisoStyle, children,
}) {
  const Tag = as;
  return (
    <Tag id={id} aria-live="polite" style={{ display: 'block', ...style }}>
      {invalido ? (
        <span style={{
          display: 'block', marginTop: 5, fontSize: 12.5, color: 'var(--ag-bad)',
          ...avisoStyle,
        }}>
          No entiendo ese número. Los centavos van con coma: 1.500,50
        </span>
      ) : children}
    </Tag>
  );
}

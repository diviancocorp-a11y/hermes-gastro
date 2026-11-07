// src/catalog-pro/CatalogoArranque.jsx
// Lo que ve el cliente mientras la carta no llego (estado "cargando") o
// cuando no llego nunca (estado "sin-conexion").
//
// Antes, mientras get_catalog no contestaba, el Home decia "Catalogo · 0
// productos", "No encontramos productos con estos filtros" y "Cerrado ·
// todavia no toma pedidos": tres mentiras en el primer segundo. Y si el RPC
// fallaba, quedaba igual para siempre, sin manera de reintentar.
//
// La identidad (nombre, logo, eslogan) sale de cp_sett_cache solo si existe:
// sin cache no se muestra el nombre de respaldo del build ("Dico"), va un
// hueso en su lugar.
//
// Props:
//   estado: "cargando" | "sin-conexion" (navigator.onLine false) | "error" (el servidor)
//   identidad: { nombre, logoUrl, logoLetter, logoColor, slogan } | null
//   barras: cuantas barras de aviso tenia el negocio la ultima vez (null = no se sabe)
//   onRetry: () => void

import "./arranque.css";

function Logo({ identidad }) {
  if (identidad?.logoUrl) {
    return (
      <span className="cp-arr-logo">
        <img src={identidad.logoUrl} alt="" loading="eager" />
      </span>
    );
  }
  if (identidad?.nombre) {
    return <span className="cp-arr-logo" aria-hidden="true">{(identidad.logoLetter || identidad.nombre.charAt(0)).toUpperCase()}</span>;
  }
  return <span className="cp-arr-logo cp-arr-hueso" aria-hidden="true" />;
}

function Header({ identidad, cargando }) {
  return (
    <div className="cp-arr-header">
      <Logo identidad={identidad} />
      <div className="cp-arr-ident">
        {identidad?.nombre
          ? <div className="cp-arr-nombre">{identidad.nombre}</div>
          : <span className="cp-arr-hueso cp-arr-linea-nombre" aria-hidden="true" />}
        {cargando && <span className="cp-arr-hueso cp-arr-linea-estado" aria-hidden="true" />}
        {identidad?.slogan && <div className="cp-arr-slogan">{identidad.slogan}</div>}
      </div>
      <span className="cp-arr-hueso cp-arr-cuenta" aria-hidden="true" />
    </div>
  );
}

export default function CatalogoArranque({ estado = "cargando", identidad = null, barras = null, onRetry }) {
  const cargando = estado === "cargando";
  // Sin dato de la visita anterior se reserva una barra: es lo mas comun
  // (envio gratis) y si no viene, el hueco se va con el esqueleto entero.
  const cantidadBarras = Number.isFinite(barras) ? Math.max(0, Math.min(3, barras)) : 1;
  const nombre = identidad?.nombre;

  if (!cargando) {
    // El carrito guardado no se toca mientras no hay carta (Catalog.jsx no
    // lo restaura ni lo pisa hasta que get_catalog contesta).
    const sinRed = estado === "sin-conexion";
    return (
      <div className="cp-root cp-surface cp-arranque">
        <Header identidad={identidad} cargando={false} />
        <section className="cp-arr-error" role="alert" aria-labelledby="cp-arr-error-titulo">
          <h1 id="cp-arr-error-titulo" className="cp-arr-error-titulo">
            {sinRed ? "Estás sin conexión" : "No pudimos cargar la carta"}
          </h1>
          <p className="body-m">
            {sinRed
              ? "Revisá que tengas internet. Cuando vuelva la señal, la carta se carga sola."
              : "Probá de nuevo en un momento."}
            {" "}Si tenías algo en el carrito, sigue guardado.
          </p>
          <button type="button" className="btn btn-primary btn-lg" onClick={() => onRetry?.()}>
            Reintentar
          </button>
        </section>
      </div>
    );
  }

  // El aviso para lectores de pantalla va AFUERA de la region aria-busy: lo
  // que esta adentro de una region ocupada no se anuncia.
  return (
    <>
    <p className="sr-only" role="status">
      {nombre ? `Cargando la carta de ${nombre}…` : "Cargando la carta…"}
    </p>
    <div className="cp-root cp-surface cp-arranque" aria-busy="true">
      <div aria-hidden="true">
        {Array.from({ length: cantidadBarras }, (_, i) => <div key={i} className="cp-arr-barra" />)}
      </div>
      <Header identidad={identidad} cargando />
      <div className="cp-arr-carrusel" aria-hidden="true">
        {[0, 1, 2, 3].map(i => <span key={i} className="cp-arr-hueso cp-arr-historia" />)}
      </div>
      <div className="cp-arr-saludo">
        <h1 className="cp-arr-saludo-titulo">¿Qué te <em>tienta</em> hoy?</h1>
      </div>
      <span className="cp-arr-hueso cp-arr-buscador" aria-hidden="true" />
      <span className="cp-arr-hueso cp-arr-recos" aria-hidden="true" />
      <div className="cp-arr-carta" aria-hidden="true">
        {[0, 1, 2].map(i => (
          <div key={i} className="cp-arr-tarjeta">
            <span className="cp-arr-hueso cp-arr-foto" />
            <span className="cp-arr-hueso cp-arr-linea-producto" />
            <span className="cp-arr-hueso cp-arr-linea-precio" />
          </div>
        ))}
      </div>
    </div>
    </>
  );
}

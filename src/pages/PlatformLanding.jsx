// src/pages/PlatformLanding.jsx
// Puerta de entrada de la PLATAFORMA (divianco.app), no de un local.
//
// Se muestra cuando el hostname es la raiz: ahi no hay tenant que resolver,
// asi que el catalogo no aplica. Sin esta pantalla, fetchCatalog devuelve null
// y el catalogo lo interpreta como "Supabase caido" (setError('offline')) —
// un error de conexion que no existe.
//
// REGLA DE CONTENIDO: aca no se promete nada que el producto no haga hoy.
// Cada afirmacion se puede rastrear a una migracion o a una pantalla que
// existe; lo que hace cada rubro sale de src/modules/registry.js
// (`implementado`). Lo que falta se dice "en desarrollo" y se ofrece como
// "lo desarrollamos con vos" (decision de Ricky, 19/oct/2026). Verificado en
// el codigo el 19/oct: el resultado del mes es para todos; desde la 0103
// (publicada el 20/oct) hay resultado del dia por sucursal, con costo de lo
// vendido solo donde hay recetas (gastronomia). El costo laboral es POR DIA,
// el stock entra con compras y conteos y, desde la 0104, completar un pedido
// descuenta la receta (gastronomia) o el articulo sin receta (comercio, y los
// productos que vende un servicio); el minimo con aviso en el panel es solo
// de insumos; el salon es solo de gastronomia. El costeo de una receta es
// insumos x (1 + merma% + gastos%): no hay mano de obra.
//
// Anclas viejas de la landing de main (#pilares, #flujo, #modulos,
// #integraciones, #seguridad, #contacto): quedan como alias (.pl-ancla) en
// la seccion equivalente, para que los links de afuera no caigan arriba.
//
// V3 (20/oct/2026, rama landing/rediseno). La home ES el embudo: la frase de
// valor y un boton que abre el diagnostico en la misma pagina, en la misma
// columna (src/components/landing/Diagnostico.jsx). Lo que explica el sistema
// queda debajo, para quien quiere leer.
//
// Direccion de design-taste-frontend: `quiet-instrument` (seed 2118221348).
// Columna angosta, la frase como unica cosa grande, demostraciones chicas y
// exactas, mucho aire compuesto. Idea: lo que Dico lee de tu negocio se
// imprime en un instrumento al lado de la columna: el resultado en la portada
// (la noche en gastronomia, el mes en comercio y servicios), tus respuestas durante el diagnostico, la pieza que resuelve tu
// dolor al final. Paleta en src/styles/plataforma-claro.css (oro solo accion
// y valor, volt solo lo que lee Dico, oscuro solo en piezas de producto).
//
// Orden: portada (embudo) -> que hace Dico (tu dolor y la parte del panel que
// lo resuelve) -> que hace hoy cada rubro y que esta en desarrollo -> clientes
// -> planes -> preguntas -> una frase y el boton -> una linea de pie.
//
// PRUEBA SOCIAL: logos originales de La Nona Pato, Crazy Miga, Monare y
// MiaEstudio, con enlaces a sus Instagram configurados. Sin cifras ni
// testimonios inventados. Franja compacta entre hero y demostracion.


import { useEffect, useRef, useState } from 'react';
import { cargarAnalitica, marcarEvento } from '../lib/analiticaPlataforma';
import Diagnostico from '../components/landing/Diagnostico';
import EscenaHero from '../components/landing/EscenaHero';
import RubrosNegocio from '../components/landing/RubrosNegocio';
import NegociosDico from '../components/landing/NegociosDico';
import ComoEmpezar from '../components/landing/ComoEmpezar';
import PlanesNegocio from '../components/landing/PlanesNegocio';
import PreguntasNegocio from '../components/landing/PreguntasNegocio';
import CierreNegocio from '../components/landing/CierreNegocio';
import useEntradas from '../components/landing/useEntradas';
import '../styles/plataforma-claro.css';
import '../styles/platform-landing.css';
import '../styles/diagnostico.css';

const TITULO = 'Dico — Todo tu negocio, en un solo lugar';
// <= 160 caracteres, lo que muestran los buscadores. Igual en api/og.js.
const DESCRIPCION = 'Ventas, costos, sueldos, stock, caja, pedidos y el resultado de cada día '
  + 'de tu gastronomía, comercio o servicio. Empezá con un diagnóstico, sin email.';

/** Escribe el titulo y los meta de la raiz. El index.html del build lleva los
 *  del cliente que se horneo (clients/edificio), asi que sin esto la pestania de
 *  divianco.app dice el nombre de un restaurante. Los bots de vista previa no
 *  pasan por aca: a esos los atiende `api/og.js`. */
function useMetaDeLaPlataforma() {
  useEffect(() => {
    cargarAnalitica();
    document.title = TITULO;
    const set = (sel, attr, valor) => {
      const el = document.head.querySelector(sel);
      if (el) el.setAttribute(attr, valor);
    };
    set('meta[name="description"]', 'content', DESCRIPCION);
    set('meta[property="og:title"]', 'content', TITULO);
    set('meta[property="og:description"]', 'content', DESCRIPCION);

    // La landing es clara: color-scheme light para que la barra de scroll y
    // los controles nativos acompanien. Se devuelve el valor previo al salir.
    const raiz = document.documentElement;
    const esquemaPrevio = raiz.style.colorScheme;
    raiz.style.colorScheme = 'light';
    return () => { raiz.style.colorScheme = esquemaPrevio; };
  }, []);
}

export default function PlatformLanding() {
  useMetaDeLaPlataforma();
  const raizRef = useRef(null);
  const [diagnosticoAbierto, setDiagnosticoAbierto] = useState(false);
  const abrirRef = useRef(null);
  useEntradas(raizRef);

  // Los botones de mas abajo abren el mismo diagnostico, arriba.
  const abrirDiagnostico = (evento) => {
    marcarEvento('diagnostico-cta');
    abrirRef.current?.({ disparador: evento?.currentTarget });
  };

  return (
    <div className="pl-root" ref={raizRef}>
      {/* div y no main: App.jsx ya envuelve todas las rutas en
          <main id="main-content">, y un main adentro de otro rompe el landmark. */}
      <section className={`pl-hero pl-hero-tiempo${diagnosticoAbierto ? ' pl-hero-diagnostico' : ''}`} aria-label="Dico">
        <header className="pl-cabecera">
          <a className="pl-marca" href="/">
            <img src="/brand/dico/logo/dico-oscuro.png" alt="Dico" width="1368" height="452" />
          </a>
          <nav className="pl-cabecera-accesos" aria-label="Acceso a Dico">
            <a className="pl-enlace pl-cabecera-link" href="/entrar">Iniciá sesión</a>
            <a className="pl-enlace pl-cabecera-link pl-cabecera-registro" href="/registro">Registrá tu negocio</a>
          </nav>
        </header>
        <Diagnostico
          modo="home"
          nivel="h1"
          abrirRef={abrirRef}
          Portada={Portada}
          onAbiertoChange={setDiagnosticoAbierto}
          lado={<EscenaHero />}
        />
      </section>
      <NegociosDico />
      <span className="pl-ancla-rubros" id="que-hace" aria-hidden="true" />
      <span className="pl-ancla-rubros" id="pilares" aria-hidden="true" />
      <span className="pl-ancla-rubros" id="flujo" aria-hidden="true" />
      <RubrosNegocio onDiagnostico={abrirDiagnostico} />
      <ComoEmpezar onDiagnostico={abrirDiagnostico} />
      <PlanesNegocio onDiagnostico={abrirDiagnostico} />
      <PreguntasNegocio onDiagnostico={abrirDiagnostico} />
      <CierreNegocio onDiagnostico={abrirDiagnostico} />
    </div>
  );
}

/* ─────────────── La portada: la frase y el boton ─────────────── */

function Portada({ onAbrir }) {
  const alAbrir = (evento) => {
    marcarEvento('diagnostico-cta');
    onAbrir(evento);
  };
  return (
    <div className="pl-portada">
      <h1 className="pl-h1" data-tiempo-capa="0.33">
        <span>Tu tiempo vuelve</span>{' '}
        <span>a ser tuyo.</span>
      </h1>
      <div className="pl-tiempo-propuesta" data-tiempo-capa="0.33">
        <p className="pl-bajada">
          <strong>Toda la gestión de tu negocio, conectada.</strong>
          <span>Para gastronomía, comercios y servicios.</span>
        </p>
        <div className="pl-acciones">
          <button type="button" className="pl-boton pl-hero-origen" data-abrir onClick={alAbrir}>
            <span className="pl-hero-etiqueta">Empezar mi diagnóstico</span> <span className="pl-hero-burbuja" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="M5 12h14m-6-6 6 6-6 6" /></svg></span>
          </button>
          <a className="pl-enlace" href="#rubros">Ver cómo funciona</a>
        </div>
        <p className="pl-hero-ayuda">Diagnóstico breve, sin dejar tu email.</p>
      </div>
    </div>
  );
}

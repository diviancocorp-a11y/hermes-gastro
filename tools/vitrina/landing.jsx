/**
 * La landing de divianco.app, sola y a pantalla completa.
 *
 * Tiene su propio HTML y no una escena de la vitrina porque es una PAGINA:
 * el nav de la vitrina es sticky y compite con el sticky de la landing, y el
 * padding del contenedor le rompe el ancho completo de las secciones. Mirarla
 * ahi adentro dice cosas del contenedor, no de la pagina.
 *
 * Con `npm run vitrina` queda en http://localhost:5199/landing.html
 */
import { createRoot } from 'react-dom/client';
import 'app/styles/hermes-tokens.css';
import 'app/styles/dico-fonts.css';
import PlatformLanding from 'app/pages/PlatformLanding.jsx';

const nodo = document.getElementById('root');
nodo.__root = nodo.__root || createRoot(nodo);
nodo.__root.render(<PlatformLanding />);

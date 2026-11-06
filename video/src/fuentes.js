import { loadFont } from '@remotion/fonts';
import { staticFile } from 'remotion';

// Tipografia de docs/marca: Butler habla el alma (titulos), Overused Grotesk
// la maquina (todo lo demas). Salen de public/fonts, igual que la landing.
loadFont({ family: 'Butler', url: staticFile('fonts/dico/butler/Butler-Free-Rmn.woff2'), weight: '400' });
loadFont({ family: 'Overused Grotesk', url: staticFile('fonts/dico/overused-grotesk/OverusedGrotesk-VF.woff2'), weight: '300 900' });

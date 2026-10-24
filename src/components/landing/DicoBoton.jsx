import { useId } from 'react';

/** El PNG vigente, con un único ojo que se cierra sobre su propia textura. */
export default function DicoBoton() {
  const recorte = useId();
  const cara = '/brand/dico/dico-2d-neutral.png';
  return (
    <svg className="pl-hero-cara" viewBox="0 0 256 256" aria-hidden="true" focusable="false">
      <defs><clipPath id={recorte}><rect x="135" y="102" width="25" height="40" rx="6" /></clipPath></defs>
      <image href={cara} width="256" height="256" />
      <g className="pl-hero-guino" clipPath={`url(#${recorte})`}>
        <image href={cara} x="-24" width="256" height="256" />
        <path d="M 139 124 Q 147 116 155 124" fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round" />
      </g>
    </svg>
  );
}

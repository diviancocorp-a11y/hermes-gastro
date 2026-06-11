// src/lib/avatars.jsx
// Avatares doodle (estilo notion-faces b/n) para clientes: deterministicos
// por nombre — el cliente NO lo elige. Heuristica de genero por nombre en
// espanol (termina en 'a' = femenino; imperfecta pero estable) y variante
// por hash. Mismo nombre = mismo avatar SIEMPRE (catalogo y admin).
//
// Cuando Ricky pase los PNG definitivos: reemplazar los SVG de MALE/FEMALE
// por <img src> manteniendo avatarFor() y <Avatar /> igual.

const stroke = "#1a1a1a";
const sw = 5;

/* Caras doodle: circulo blanco + rasgos negros (viewBox 0 0 100 100) */
const FACE_BASE = (children) => (
  <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%", display: "block" }} aria-hidden>
    <circle cx="50" cy="50" r="48" fill="#fff" />
    {children}
    <circle cx="50" cy="50" r="48" fill="none" stroke={stroke} strokeWidth="3" />
  </svg>
);

const MALE = [
  // m1: pelo corto + anteojos
  FACE_BASE(<>
    <path d="M22 38 Q30 14 50 14 Q70 14 78 38 L74 40 Q66 24 50 24 Q34 24 26 40 Z" fill={stroke} />
    <circle cx="36" cy="48" r="9" fill="none" stroke={stroke} strokeWidth={sw} />
    <circle cx="64" cy="48" r="9" fill="none" stroke={stroke} strokeWidth={sw} />
    <line x1="45" y1="48" x2="55" y2="48" stroke={stroke} strokeWidth={sw} />
    <circle cx="36" cy="48" r="2.5" fill={stroke} />
    <circle cx="64" cy="48" r="2.5" fill={stroke} />
    <path d="M40 72 Q50 80 60 72" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
  </>),
  // m2: jopo al costado + sonrisa
  FACE_BASE(<>
    <path d="M20 42 Q22 16 52 14 Q76 14 80 36 Q66 26 48 30 Q30 34 24 46 Z" fill={stroke} />
    <circle cx="37" cy="50" r="3.5" fill={stroke} />
    <circle cx="63" cy="50" r="3.5" fill={stroke} />
    <path d="M38 70 Q50 79 62 70" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
  </>),
  // m3: lentes de sol + pelo batido
  FACE_BASE(<>
    <path d="M24 34 Q28 12 50 13 Q72 12 76 34 L70 32 Q64 20 50 21 Q36 20 30 32 Z" fill={stroke} />
    <rect x="26" y="42" width="20" height="12" rx="5" fill={stroke} />
    <rect x="54" y="42" width="20" height="12" rx="5" fill={stroke} />
    <line x1="46" y1="46" x2="54" y2="46" stroke={stroke} strokeWidth={sw} />
    <path d="M40 71 Q50 77 60 71" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
  </>),
  // m4: rapado + barba
  FACE_BASE(<>
    <path d="M28 30 Q36 18 50 18 Q64 18 72 30 L68 32 Q60 24 50 24 Q40 24 32 32 Z" fill={stroke} />
    <circle cx="37" cy="46" r="3.5" fill={stroke} />
    <circle cx="63" cy="46" r="3.5" fill={stroke} />
    <path d="M32 62 Q34 80 50 82 Q66 80 68 62 Q60 70 50 70 Q40 70 32 62 Z" fill={stroke} />
    <path d="M43 66 Q50 70 57 66" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" />
  </>),
];

const FEMALE = [
  // f1: carre / bob
  FACE_BASE(<>
    <path d="M18 64 Q14 18 50 14 Q86 18 82 64 L72 64 Q76 30 50 26 Q24 30 28 64 Z" fill={stroke} />
    <circle cx="38" cy="50" r="3.5" fill={stroke} />
    <circle cx="62" cy="50" r="3.5" fill={stroke} />
    <path d="M40 70 Q50 78 60 70" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
  </>),
  // f2: pelo largo lacio con raya al medio
  FACE_BASE(<>
    <path d="M16 86 Q12 22 50 13 Q88 22 84 86 L70 86 Q74 40 58 30 L50 26 L42 30 Q26 40 30 86 Z" fill={stroke} />
    <circle cx="39" cy="50" r="3.5" fill={stroke} />
    <circle cx="61" cy="50" r="3.5" fill={stroke} />
    <path d="M41 69 Q50 76 59 69" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
  </>),
  // f3: rodete + anteojos
  FACE_BASE(<>
    <circle cx="50" cy="12" r="10" fill={stroke} />
    <path d="M24 40 Q30 18 50 17 Q70 18 76 40 L70 40 Q64 26 50 26 Q36 26 30 40 Z" fill={stroke} />
    <circle cx="37" cy="49" r="8" fill="none" stroke={stroke} strokeWidth="4.5" />
    <circle cx="63" cy="49" r="8" fill="none" stroke={stroke} strokeWidth="4.5" />
    <line x1="45" y1="49" x2="55" y2="49" stroke={stroke} strokeWidth="4.5" />
    <circle cx="37" cy="49" r="2.5" fill={stroke} />
    <circle cx="63" cy="49" r="2.5" fill={stroke} />
    <path d="M42 70 Q50 76 58 70" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
  </>),
  // f4: flequillo + colitas
  FACE_BASE(<>
    <path d="M22 44 Q22 16 50 15 Q78 16 78 44 L72 42 Q72 34 64 36 Q52 38 40 36 Q30 34 28 42 Z" fill={stroke} />
    <circle cx="16" cy="52" r="8" fill={stroke} />
    <circle cx="84" cy="52" r="8" fill={stroke} />
    <circle cx="38" cy="51" r="3.5" fill={stroke} />
    <circle cx="62" cy="51" r="3.5" fill={stroke} />
    <path d="M39 70 Q50 79 61 70" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
  </>),
];

// Hash simple y estable (mismo nombre → mismo numero)
function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

// Heuristica es-AR: primer nombre terminado en 'a' → femenino.
// Excepciones masculinas comunes terminadas en 'a'.
const MALE_EXCEPTIONS = new Set(["joshua", "elia", "nicola", "luca", "matias", "tobias", "elias", "jeremias"]);
function isFemaleName(name) {
  const first = (name || "").trim().toLowerCase().split(/\s+/)[0].normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (!first) return false;
  if (MALE_EXCEPTIONS.has(first)) return false;
  return first.endsWith("a") || first.endsWith("ia");
}

export function avatarFor(name) {
  const key = (name || "Cliente").trim().toLowerCase();
  const set = isFemaleName(key) ? FEMALE : MALE;
  return set[hashStr(key) % set.length];
}

/** Burbuja de avatar: <Avatar name="Cami R." size={40} /> */
export function Avatar({ name, size = 40, style }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: 999, overflow: "hidden",
      flexShrink: 0, ...style,
    }}>
      {avatarFor(name)}
    </div>
  );
}

import { AbsoluteFill, Img, Sequence, Series, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { C, Escena, Local, Pulsar, Subtitulo, Telefono, clamp, entra, pesos } from './piezas.jsx';

// Guion aprobado por Ricky el 6/nov/2026. Estructura de referencia: el reel
// "dos restaurantes" de ImpulsePages; el conflicto es propio (los dos llenos,
// solo uno gana plata) y todo lo que muestra el producto existe en DICO hoy.

const DURACION = { hook: 120, otro: 80, marca: 60, pedidos: 180, stock: 180, cierre: 200, dico: 130, final: 130 };
export const DURACION_TOTAL = Object.values(DURACION).reduce((a, b) => a + b, 0);

const Vereda = () => <div style={{ position: 'absolute', left: 0, right: 0, top: 1490, height: 430, background: '#18181B' }} />;

const Hook = () => {
  const f = useCurrentFrame();
  return (
    <Escena dur={DURACION.hook}>
      <Vereda />
      <Local nombre="Resto A" left={70} top={970} escala={1.2} brillo={interpolate(f, [80, 100], [0, 1], clamp)} />
      <Local nombre="Resto B" left={610} top={970} escala={1.2} />
      <Sequence durationInFrames={38}><Subtitulo texto="Dos restaurantes." /></Sequence>
      <Sequence from={38} durationInFrames={38}><Subtitulo texto="Los dos llenos." resaltar={['llenos']} /></Sequence>
      <Sequence from={76}><Subtitulo texto="Solo uno gana plata." resaltar={['plata']} /></Sequence>
    </Escena>
  );
};

const Cuaderno = () => {
  const f = useCurrentFrame();
  const renglones = [['Ventas', '¿?'], ['Proveedor', '$ ???'], ['Sueldos', '$ ...'], ['¿Cuánto quedó?', '']];
  return (
    <div style={{
      position: 'absolute', left: 470, top: 760, width: 520, padding: '44px 48px', borderRadius: 18,
      background: C.papel2, transform: `rotate(-5deg) translateY(${interpolate(f, [6, 22], [80, 0], clamp)}px)`,
      opacity: interpolate(f, [6, 18], [0, 1], clamp), boxShadow: '0 30px 80px rgba(0,0,0,.6)',
      fontFamily: 'Overused Grotesk', color: C.tinta,
    }}>
      {renglones.map(([a, b], i) => (
        <div key={a} style={{ ...entra(f, 16 + i * 8, 8, 10), display: 'flex', justifyContent: 'space-between', fontSize: 40, padding: '14px 0', borderBottom: `2px solid ${C.papel}` }}>
          <span style={{ fontWeight: i === 3 ? 700 : 400 }}>{a}</span>
          <span style={{ color: C.error, textDecoration: i === 1 ? 'line-through' : 'none' }}>{b}</span>
        </div>
      ))}
    </div>
  );
};

const ElOtro = () => (
  <Escena dur={DURACION.otro}>
    <Vereda />
    <Local nombre="Resto B" left={40} top={990} escala={1.15} apagado={0.4} />
    <Cuaderno />
    <Subtitulo texto="¿El otro? Trabaja el doble y no sabe cuánto le queda." resaltar={['sabe']} cada={3} />
  </Escena>
);

const Marca = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <Escena dur={DURACION.marca}>
      <Subtitulo texto="El primero tiene" top={640} />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', paddingTop: 260 }}>
        <Img src={staticFile('brand/dico/logo/dico-oscuro.png')} style={{ width: 760, transform: `scale(${spring({ frame: f - 10, fps, config: { damping: 12 } })})` }} />
      </AbsoluteFill>
    </Escena>
  );
};

const PRODUCTOS = [['Milanesa napolitana', 8900], ['Ñoquis con tuco', 7400], ['Flan casero', 3200]];

const Catalogo = () => {
  const f = useCurrentFrame();
  const carrito = interpolate(f, [62, 74], [0, 1], clamp);
  const aviso = interpolate(f, [112, 124], [0, 1], clamp);
  return (
    <>
      <div style={{ margin: '0 28px', padding: '12px 20px', borderRadius: 14, background: C.papel2, fontSize: 24, color: C.tinta2, textAlign: 'center' }}>resto-a.divianco.app</div>
      <div style={{ margin: 28, padding: '40px 32px', borderRadius: 24, background: C.fondo2, color: C.papel }}>
        <div style={{ fontFamily: 'Butler', fontSize: 58 }}>Resto A</div>
        <div style={{ fontSize: 26, color: C.oroClaro, marginTop: 6 }}>Cocina de barrio · Delivery y retiro</div>
      </div>
      {PRODUCTOS.map(([nombre, precio], i) => (
        <div key={nombre} style={{ ...entra(f, 14 + i * 6, 10, 20), display: 'flex', alignItems: 'center', gap: 22, margin: '0 28px 18px', padding: 22, borderRadius: 20, background: '#fff', border: `2px solid ${C.papel2}` }}>
          <div style={{ width: 92, height: 92, borderRadius: 18, background: [C.oroClaro, '#e8dfd0', C.oro][i] }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 30, fontWeight: 600 }}>{nombre}</div>
            <div style={{ fontSize: 28, color: C.tinta2, marginTop: 4 }}>{pesos(precio)}</div>
          </div>
          <Pulsar en={i === 0 ? 56 : 999}>
            <div style={{ width: 64, height: 64, borderRadius: 32, background: C.oro, color: C.tinta, fontSize: 44, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</div>
          </Pulsar>
        </div>
      ))}
      <div style={{ position: 'absolute', left: 28, right: 28, bottom: 40, transform: `translateY(${(1 - carrito) * 200}px)` }}>
        <Pulsar en={92}>
          <div style={{ padding: '30px 34px', borderRadius: 24, background: C.tinta, color: C.papel, display: 'flex', justifyContent: 'space-between', fontSize: 32, fontWeight: 600 }}>
            <span>1 producto · {pesos(8900)}</span><span style={{ color: C.oroClaro }}>Pedir</span>
          </div>
        </Pulsar>
      </div>
      <div style={{
        position: 'absolute', left: 24, right: 24, top: 90, padding: '26px 28px', borderRadius: 26,
        background: '#fff', boxShadow: '0 20px 60px rgba(0,0,0,.25)', opacity: aviso,
        transform: `translateY(${(1 - aviso) * -60}px)`, display: 'flex', gap: 20, alignItems: 'center',
      }}>
        <div style={{ width: 64, height: 64, borderRadius: 16, background: C.oro, fontWeight: 800, fontSize: 30, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>D</div>
        <div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>Pedido nuevo #128</div>
          <div style={{ fontSize: 24, color: C.tinta2 }}>Milanesa napolitana · Delivery · ya entró a cocina</div>
        </div>
      </div>
    </>
  );
};

const Pedidos = () => (
  <Escena dur={DURACION.pedidos}>
    <Telefono><Catalogo /></Telefono>
    <Subtitulo texto="Los pedidos entran solos, desde su propia página." resaltar={['solos']} cada={3} />
  </Escena>
);

const INSUMOS = [['Harina 0000', 0.8, 0.8, '18 kg'], ['Queso cremoso', 0.6, 0.1, '2 kg'], ['Tomate perita', 0.55, 0.55, '9 kg'], ['Pan rallado', 0.7, 0.7, '12 kg']];

const Stock = () => {
  const f = useCurrentFrame();
  const baja = interpolate(f, [40, 90], [0, 1], clamp);
  const alerta = interpolate(f, [96, 108], [0, 1], clamp);
  return (
    <Escena dur={DURACION.stock}>
      <Telefono>
        <div style={{ padding: '10px 36px' }}>
          <div style={{ fontFamily: 'Butler', fontSize: 60 }}>Stock</div>
          <div style={{ fontSize: 26, color: C.tinta2, marginBottom: 28 }}>Se descuenta solo con cada venta</div>
          {INSUMOS.map(([nombre, desde, hasta, queda], i) => {
            const nivel = interpolate(baja, [0, 1], [desde, hasta]);
            const bajo = nivel < 0.2;
            return (
              <div key={nombre} style={{ ...entra(f, 8 + i * 5, 10, 16), marginBottom: 34 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 30, fontWeight: 600 }}>
                  <span>{nombre}</span>
                  <span style={{ color: bajo ? C.error : C.tinta2 }}>{i === 1 ? `${Math.round(2 + (1 - baja) * 10)} kg` : queda}</span>
                </div>
                <div style={{ height: 16, borderRadius: 8, background: C.papel2, marginTop: 12 }}>
                  <div style={{ width: `${nivel * 100}%`, height: '100%', borderRadius: 8, background: bajo ? C.error : C.ok }} />
                </div>
              </div>
            );
          })}
          <div style={{ opacity: alerta, transform: `scale(${0.9 + alerta * 0.1})`, marginTop: 20, padding: 30, borderRadius: 24, background: C.tinta, color: C.papel }}>
            <div style={{ fontSize: 30, fontWeight: 700, color: C.oroClaro }}>Queso cremoso, bajo el mínimo</div>
            <div style={{ fontSize: 26, marginTop: 8, color: '#e8dfd0' }}>Quedan 2 kg. Avisale al proveedor hoy.</div>
          </div>
        </div>
      </Telefono>
      <Subtitulo texto="Sabe qué le falta antes de que se acabe." resaltar={['antes']} cada={3} />
    </Escena>
  );
};

const MEDIOS = [['Efectivo', 412300], ['Mercado Pago', 618900], ['Tarjeta', 253300]];
const HORAS = [0.2, 0.35, 0.3, 0.5, 0.85, 1, 0.7];

const Cierre = () => {
  const f = useCurrentFrame();
  const total = MEDIOS.reduce((a, [, v]) => a + v, 0);
  const cuenta = interpolate(f, [20, 90], [0, total], { ...clamp, easing: t => 1 - Math.pow(1 - t, 3) });
  return (
    <Escena dur={DURACION.cierre}>
      <Telefono>
        <div style={{ padding: '10px 36px' }}>
          <div style={{ fontFamily: 'Butler', fontSize: 60 }}>Cierre de caja</div>
          <div style={{ fontSize: 26, color: C.tinta2 }}>Hoy · 23:47</div>
          <div style={{ marginTop: 40, fontSize: 28, color: C.tinta2 }}>Vendido hoy</div>
          <div style={{ fontSize: 96, fontWeight: 700, fontVariantNumeric: 'tabular-nums', letterSpacing: -2 }}>{pesos(cuenta)}</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, height: 200, margin: '30px 0 40px' }}>
            {HORAS.map((h, i) => (
              <div key={i} style={{ flex: 1, borderRadius: 10, background: i === 5 ? C.oro : C.papel2, height: `${interpolate(f, [30 + i * 6, 60 + i * 6], [0, h], clamp) * 100}%` }} />
            ))}
          </div>
          {MEDIOS.map(([medio, valor], i) => (
            <div key={medio} style={{ ...entra(f, 96 + i * 10, 10, 14), display: 'flex', justifyContent: 'space-between', fontSize: 32, padding: '20px 0', borderBottom: `2px solid ${C.papel2}` }}>
              <span>{medio}</span><span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{pesos(valor)}</span>
            </div>
          ))}
        </div>
      </Telefono>
      <Subtitulo texto="Y cada noche, al cerrar, sabe cuánto vendió." resaltar={['vendió']} cada={3} />
    </Escena>
  );
};

const Burbuja = ({ desde, de, children }) => {
  const f = useCurrentFrame();
  const esDico = de === 'dico';
  return (
    <div style={{ ...entra(f, desde, 10, 20), alignSelf: esDico ? 'flex-start' : 'flex-end', maxWidth: '82%', padding: '24px 28px', borderRadius: 28, fontSize: 30, lineHeight: 1.3, background: esDico ? '#fff' : C.tinta, color: esDico ? C.tinta : C.papel, border: esDico ? `2px solid ${C.oro}` : 'none' }}>
      {children}
    </div>
  );
};

const PreguntaDico = () => {
  const f = useCurrentFrame();
  const escribiendo = f > 34 && f < 62;
  return (
    <Escena dur={DURACION.dico}>
      <Telefono>
        <div style={{ padding: '10px 36px 36px', display: 'flex', flexDirection: 'column', gap: 24, height: 'calc(100% - 84px)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, paddingBottom: 20, borderBottom: `2px solid ${C.papel2}`, marginBottom: 'auto' }}>
            <div style={{ width: 70, height: 70, borderRadius: 35, background: C.fondo2, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              <Img src={staticFile('brand/dico/logo/dico-oscuro.png')} style={{ height: 56, objectFit: 'cover', objectPosition: 'right', width: 56 }} />
            </div>
            <div style={{ fontSize: 34, fontWeight: 700 }}>Dico</div>
          </div>
          <Burbuja desde={14} de="vos">¿Qué fue lo que más se vendió esta semana?</Burbuja>
          {escribiendo && <div style={{ fontSize: 40, color: C.oro, letterSpacing: 6 }}>{'•••'.slice(0, 1 + (Math.floor(f / 6) % 3))}</div>}
          <Burbuja desde={62} de="dico">La milanesa napolitana: 64 platos. Le siguen los ñoquis, con 41.</Burbuja>
          <div style={{ marginTop: 12, padding: '24px 28px', borderRadius: 40, background: C.papel2, fontSize: 28, color: C.tinta2 }}>Escribí tu pregunta…</div>
        </div>
      </Telefono>
      <Subtitulo texto="Y si tiene una duda, le pregunta a Dico." resaltar={['dico']} cada={3} />
    </Escena>
  );
};

const Final = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <Escena dur={DURACION.final}>
      <Vereda />
      <Local nombre="Resto A" left={70} top={970} escala={1.2} brillo={1} />
      <Local nombre="Resto B" left={610} top={970} escala={1.2} apagado={interpolate(f, [10, 30], [0, 1], clamp)} fila={3} />
      <div style={{ position: 'absolute', top: 210, left: 80, right: 80, textAlign: 'center', fontFamily: 'Butler', fontSize: 110, lineHeight: 1.08, color: C.texto, ...entra(f, 4, 16) }}>
        ¿Cuál de los dos querés ser?
      </div>
      <div style={{ position: 'absolute', top: 640, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
        <div style={{
          transform: `scale(${spring({ frame: f - 40, fps, config: { damping: 12 } })})`,
          padding: '26px 56px', borderRadius: 60, background: C.oro, color: C.fondo,
          fontFamily: 'Overused Grotesk', fontWeight: 700, fontSize: 56,
        }}>divianco.app</div>
      </div>
    </Escena>
  );
};

export const DosRestaurantes = () => (
  <AbsoluteFill style={{ background: C.fondo }}>
    <Series>
      <Series.Sequence durationInFrames={DURACION.hook}><Hook /></Series.Sequence>
      <Series.Sequence durationInFrames={DURACION.otro}><ElOtro /></Series.Sequence>
      <Series.Sequence durationInFrames={DURACION.marca}><Marca /></Series.Sequence>
      <Series.Sequence durationInFrames={DURACION.pedidos}><Pedidos /></Series.Sequence>
      <Series.Sequence durationInFrames={DURACION.stock}><Stock /></Series.Sequence>
      <Series.Sequence durationInFrames={DURACION.cierre}><Cierre /></Series.Sequence>
      <Series.Sequence durationInFrames={DURACION.dico}><PreguntaDico /></Series.Sequence>
      <Series.Sequence durationInFrames={DURACION.final}><Final /></Series.Sequence>
    </Series>
  </AbsoluteFill>
);

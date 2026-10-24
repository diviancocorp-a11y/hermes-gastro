# Hero del tiempo — referencia y recursos

23/oct/2026. Reemplaza el hero de concreto y dispositivos rechazado por Ricky.

## Fuente

- Referencia elegida por Ricky: [Parallax Scrolling en 21st](https://21st.dev/@osmosupply/components/parallax-scrolling).
- Recurso original del autor: [Parallax Image Layers, Osmo](https://webflow.com/made-in-webflow/website/osmo-parallax-image-layers).
- [Demo original](https://osmo-parallax-image-layers.webflow.io/).

El aviso **Copyright info** de la ficha de Webflow declara el proyecto bajo
[Creative Commons CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/),
con permiso de copiar, editar y usar en proyectos personales o comerciales.
Comprobado en navegador el 23/oct/2026; no se abrio una cuenta ni se aceptaron
terminos. El aviso tambien recuerda que marcas u otros derechos de terceros
no quedan cubiertos por esa dedicacion. Se usan paisaje y persona de espaldas;
no se incorporan el logo de Osmo, marcas, afirmaciones de aval ni clientes.

No se extrajo el componente gated de 21st ni se instalaron GSAP/Lenis. La
composicion se adapta en React/CSS y Web Animations con scroll nativo. El
credito del paisaje se muestra en la pagina, sin convertirlo en prueba social.

## Capas originales, sin modificar

Las tres imagenes son WebP de 2000x1906, con el mismo encuadre. Las capas
intermedias/delanteras conservan transparencia. Se sirven localmente desde
`public/brand/landing/parallax/`, total 192.604 bytes.

| Archivo | Bytes | Fuente |
|---|---:|---|
| `cielo.webp` | 83.770 | [original capa 3](https://cdn.prod.website-files.com/671752cd4027f01b1b8f1c7f/6717795be09b462b2e8ebf71_osmo-parallax-layer-3.webp) |
| `montana.webp` | 72.608 | [original capa 2](https://cdn.prod.website-files.com/671752cd4027f01b1b8f1c7f/6717795b4d5ac529e7d3a562_osmo-parallax-layer-2.webp) |
| `primer-plano.webp` | 36.226 | [original capa 1](https://cdn.prod.website-files.com/671752cd4027f01b1b8f1c7f/6717795bb5aceca85011ad83_osmo-parallax-layer-1.webp) |

SHA-256 de los archivos recibidos:

```text
cielo.webp         A43F4EAE3459C461345EE676F12D6E1DDCA65E8A5279A5AF00D475B17FF83AEA
montana.webp       50CA6A0D36D2780BFCB469D6DB7EAEC0BE7E0D2961BA69A63D2A1473B040338D
primer-plano.webp  E1C8137B5F971C3B3EC1A0F9E79B9C17018767005F844A10082B890472AFECFB
```

## Decisiones transferidas de la referencia

1. Fotografia a pantalla completa; los planos comparten escala y encuadre.
2. Orden: cielo, montana, titulo, persona/suelo. El texto entre planos aporta
   profundidad, pero la persona no debe impedir leer el mensaje de Dico.
3. Recorrido por scroll nativo con velocidades distintas. En el original,
   a scroll 288 px se midieron translates de 236,88 / 186,12 / 96 / 33,84 px.
   La diferencia entre planos es de cientos de pixeles, no un leve balanceo.
4. La altura y el encuadre se adaptan al celular conservando el efecto y un
   CTA visible al entrar. Sin una pantalla negra vacia para demostrar scroll.
5. Movimiento reducido deja la escena quieta y conserva el mismo diagnostico.

## Mensaje

- Titulo: **Mas tiempo para vivir.**, con tildes en la UI.
- Bajada: Dico reune pedidos, stock, caja y resultados para que tengas mas
  tiempo para vos y los tuyos.
- Accion: **Quiero Dico**. Aclaracion: Empezamos con un diagnostico breve,
  sin email.

Es una promesa de valor cualitativa: no se inventan horas ahorradas,
automatizacion de decisiones ni garantias de reduccion de estres. El detalle
de capacidades y pendientes por rubro sigue en el cuerpo y el diagnostico.

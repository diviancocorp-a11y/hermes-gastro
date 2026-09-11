# Documentacion de Dico

**Esta es la carpeta madre.** Todo documento de proyecto vive aca. En la raiz
del repo solo quedan tres, y estan ahi porque las herramientas los leen desde
ahi: `CLAUDE.md`, `AGENTS.md` y `README.md`.

## La regla

> **La unica verdad de hoy es el edificio**: un proyecto Supabase
> (`wwwzdgprsooyjgkuyoav`), un proyecto Vercel (`hermes-platform`, nombre
> viejo que no se renombra), un dominio (`divianco.app`) y la rama `main`.
> Todo lo que hable de tres proyectos separados, de un tenant por proyecto o
> de deploys por cliente esta en `historico/` y **no describe el presente**.

Si un documento y el codigo se contradicen, gana el codigo. Si dos documentos
se contradicen, gana el que esta fuera de `historico/`.

## Donde esta cada cosa

| Carpeta | Que hay | Cuando leerlo |
|---|---|---|
| `HANDOFF.md` | El estado entre sesiones, de mas nuevo a mas viejo | **Primero, siempre** |
| `docs/TAREAS-MANUALES.md` | Lo que solo puede hacer Ricky a mano | Antes de reportar algo como roto |
| `plataforma/` | Como esta construido el edificio | Al tocar arquitectura, schema o alta de clientes |
| `marca/` | Dico como identidad: design system, tipografia, el personaje | Al tocar cualquier cosa visual |
| `operacion/` | Runbooks, seguridad, cobros, performance | Cuando algo falla en produccion |
| `historico/` | Cerrado. Se conserva para entender el porque, no el que | Solo para arqueologia |

## Que NO esta aca

Los `README.md` que documentan una carpeta de codigo se quedan al lado del
codigo: `platform/README.md`, `platform/qa-lite/`, `platform/scripts/`,
`tools/dico-3d/`, `public/brand/`. Si documenta como usar una carpeta, vive en
esa carpeta. Si es un plan, una fase, un informe o un brief, vive aca.

## Como no volver a dispersarse

1. Documento nuevo: va en una de las cuatro subcarpetas de arriba. Nunca en la
   raiz del repo ni suelto en `platform/`.
2. Documento que se cierra: se mueve a `historico/` **en el mismo commit** que
   lo cierra. No se borra, para que quede el porque.
3. Al cerrar sesion con `/cerrardico`, se actualiza `HANDOFF.md` y nada mas.
   El HANDOFF es el unico documento que crece por arriba.

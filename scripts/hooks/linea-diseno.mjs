#!/usr/bin/env node
// scripts/hooks/linea-diseno.mjs
//
// Hook UserPromptSubmit de Claude Code (registrado en .claude/settings.json).
// Le recuerda a cada turno la regla de Ricky del 15/oct/2026: toda mejora que
// toque UI pasa por la skill /diseno, que maneja la linea de skills (impeccable
// o taste-skill, constructor, auditor, medicion).
//
// POR QUE UN HOOK Y NO SOLO CLAUDE.md: la regla en CLAUDE.md se puede perder en
// una sesion larga; el hook la vuelve a poner al lado de cada pedido. Es una
// linea, no bloquea nada y no lee el prompt.
//
// Nunca puede romper un turno: cualquier error termina en salida vacia y exit 0.

const TEXTO = 'Regla de Ricky (DICO): toda mejora que toque UI (pantallas, '
  + 'componentes .jsx, CSS, index.html, landing) se hace con la skill /diseno '
  + 'ANTES de editar: linea base, una sola skill estetica (impeccable para pulir, '
  + 'design-taste-frontend para pantallas nuevas), subagente disenador para '
  + 'construir, auditor-diseno para auditar y medicion antes/despues. '
  + 'Si la tarea no toca UI, ignorar este aviso.';

try {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext: TEXTO,
    },
  }));
} catch {
  // Un aviso de mas no vale un turno roto.
}
process.exit(0);

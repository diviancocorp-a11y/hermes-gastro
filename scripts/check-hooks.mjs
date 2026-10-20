// Verifica referencias a scripts locales sin ejecutar comandos de hooks.
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

export function erroresHooks(root) {
  const config = JSON.parse(readFileSync(join(root, '.claude/settings.json'), 'utf8'));
  const errores = [];
  for (const [evento, grupos] of Object.entries(config.hooks || {})) {
    for (const grupo of grupos) {
      for (const hook of grupo.hooks || []) {
        if (hook.type !== 'command') continue;
        // scripts/ es el directorio versionado de comandos del proyecto.
        const referencias = hook.command.matchAll(/(?:\$\{CLAUDE_PROJECT_DIR\}[/\\]|\.\/)?(scripts[/\\][^\s"';&|<>]+)/g);
        for (const [, referencia] of referencias) {
          const archivo = referencia.replaceAll('\\', '/');
          try {
            if (!statSync(join(root, archivo)).isFile()) throw new Error('No es archivo');
          } catch {
            errores.push(`${evento}: script de hook inexistente o ilegible: ${archivo}`);
          }
        }
      }
    }
  }
  return errores;
}

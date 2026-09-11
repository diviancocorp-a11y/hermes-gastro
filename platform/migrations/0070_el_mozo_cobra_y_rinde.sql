-- 0070 - El que cobra es el mozo.
--
-- EL MODELO QUE FALTABA DECIR
-- Hasta aca la caja asumia a alguien fijo en ella: `cash_sessions` solo la
-- leian owner, manager, cashier y accountant. El negocio funciona al reves.
-- Cada mozo cobra las mesas que atiende, junta su efectivo y al terminar
-- presenta su pre-cierre. El encargado certifica uno por uno y recien despues
-- cierra el turno. El rol `cashier` sigue existiendo para el local que tenga a
-- alguien en la caja, pero deja de ser el unico camino.
--
-- LO QUE ESTA MIGRACION CAMBIA ES UNA LECTURA, NO UN PERMISO DE PLATA
-- El mozo necesita SABER que hay un turno abierto: su mini caja cuelga de el y
-- sus cobros llevan `cash_session_id`. Abrirlo, cerrarlo y modificarlo siguen
-- siendo del encargado; esta migracion no toca esas policies.
--
-- Medido el 10/9/2026 en QA Lite: con la policy anterior, un mozo con turno
-- abierto leia `select count(*) from cash_sessions` = 0 y la pantalla le decia
-- "el local todavia no abrio el turno" mientras el local estaba operando.

drop policy if exists cash_sessions_select on public.cash_sessions;

create policy cash_sessions_select on public.cash_sessions
  for select using (
    tenant_id in (select private.current_user_tenants())
    and private.alcanza_branch(tenant_id, branch_id)
    and (
      -- Quien supervisa ve la historia completa del turno: es lo que arquea.
      private.tiene_rol(tenant_id, array['owner','manager','cashier','accountant'])
      -- El resto del equipo ve UNICAMENTE el turno abierto de su sucursal.
      -- No la historia: cuanto se cerro ayer no es asunto de quien atiende
      -- mesas, y el arqueo de un turno cerrado es informacion del negocio.
      or (
        status = 'open'
        and exists (
          select 1 from public.staff s
           where s.tenant_id = cash_sessions.tenant_id
             and s.user_id = auth.uid()
             and s.active
        )
      )
    )
  );

comment on policy cash_sessions_select on public.cash_sessions is
  'Supervision ve todos los turnos; el resto del equipo, solo el abierto de su sucursal, porque su mini caja cuelga de el.';

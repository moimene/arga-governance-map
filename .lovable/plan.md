
El usuario quiere conectar el proyecto a su propio proyecto Supabase externo (`https://hzqwefkwsxopwrmtksbg.supabase.co`) en lugar de usar Lovable Cloud.

## Plan

### 1. Activar la integración nativa Supabase
Lovable tiene una integración oficial para conectar proyectos Supabase externos. No se hace por código — se activa desde el botón verde **Supabase** en la esquina superior derecha del editor Lovable.

**Pasos que debes hacer tú (usuario):**
1. Click en el botón **Supabase** (arriba a la derecha en Lovable).
2. Autoriza Lovable en tu cuenta Supabase.
3. Selecciona el proyecto `hzqwefkwsxopwrmtksbg`.
4. Confirma la conexión.

Esto inyecta automáticamente `SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` como secretos del proyecto y habilita las herramientas de migraciones, edge functions y gestión de auth contra **tu** Supabase.

### 2. Una vez conectado, yo haré
- Crear el cliente Supabase en `src/integrations/supabase/client.ts` apuntando a tu proyecto.
- Sustituir el `AuthContext` actual (basado en `sessionStorage`) por autenticación real Supabase con `onAuthStateChange` + `getSession`.
- Conectar `Login.tsx` a `signInWithPassword` y añadir `signUp` si lo necesitas.
- Añadir `RequireAuth` real que verifique sesión Supabase.

### 3. Decisiones que necesito de ti antes de codificar
Te haré 1–2 preguntas críticas (perfiles de usuario, métodos de login) en cuanto confirmes la conexión.

---

**Acción ahora:** pulsa el botón **Supabase** verde arriba a la derecha y conecta el proyecto `hzqwefkwsxopwrmtksbg`. Avísame cuando esté hecho y continúo con el código.

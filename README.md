# Planifica Maestro — Arquitectura y Planificación Técnica

Asistente Inteligente de Planificación Pedagógica adaptado al Currículo Oficial de la República Dominicana (MINERD).

---

## 🏛️ FASE 12: Arquitectura de Datos para Modo Multiusuario Institucional

Este documento define la base técnica y el modelo de datos preparado para soportar múltiples usuarios dentro de un mismo centro educativo o distrito escolar, permitiendo a los **Coordinadores Pedagógicos y de Área** supervisar, acompañar y retroalimentar las planificaciones elaboradas por los docentes bajo su cargo.

---

### 1. Modelo Entidad-Relación (Colecciones / Tablas)

```
┌─────────────────┐       1:N       ┌─────────────────────┐
│    escuelas     │────────────────>│      usuarios       │
└─────────────────┘                 └─────────────────────┘
         │                                     │
         │ 1:N                                 │ 1:N
         │                                     v
         │                          ┌─────────────────────┐
         │                          │   planificaciones   │
         │                          └─────────────────────┘
         │                                     │
         v                                     │ 1:N
┌─────────────────────────┐                    v
│ supervisiones_area_minerd│          ┌─────────────────────┐
└─────────────────────────┘          │revisiones_coordinador│
                                     └─────────────────────┘
```

---

### 2. Especificación de Tablas / Colecciones

#### A. Tabla `escuelas` (Centros Educativos)
Representa la institución educativa formal registrada en el MINERD.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | `VARCHAR(36)` / `UUID` | Llave primaria única del centro escolar |
| `codigo_minerd` | `VARCHAR(20)` | Código oficial del centro (RNC o código SIGERD) |
| `nombre` | `VARCHAR(150)` | Nombre oficial (Ej: *Escuela Básica Juan Pablo Duarte*) |
| `regional_educativa` | `VARCHAR(10)` | Regional del MINERD (Ej: *Regional 10 - Santo Domingo*) |
| `distrito_educativo` | `VARCHAR(10)` | Distrito educativo (Ej: *Distrito 01*) |
| `tanda` | `ENUM` | `matutina`, `vespertina`, `jornada_extendida` |
| `telefono` | `VARCHAR(20)` | Teléfono de contacto institucional |
| `activo` | `BOOLEAN` | Estado de la suscripción institucional |
| `creado_en` | `TIMESTAMP` | Fecha de alta institucional |

---

#### B. Tabla `usuarios` (Docentes, Coordinadores, Directores)
Entidad de autenticación y asignación de funciones pedagógicas.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | `VARCHAR(36)` / `UUID` | Identificador único del usuario |
| `escuela_id` | `UUID (FK -> escuelas.id)` | Escuela a la que pertenece |
| `nombre_completo` | `VARCHAR(120)` | Nombre y apellidos del docente |
| `email` | `VARCHAR(100)` | Correo electrónico (único) |
| `password_hash` | `VARCHAR(255)` | Clave encriptada (bcrypt / argon2) |
| `rol` | `ENUM` | `'docente'`, `'coordinador_area'`, `'director'`, `'admin'` |
| `nivel_educativo` | `ENUM` | `'inicial'`, `'primario'`, `'secundario'`, `'todos'` |
| `areas_especialidad` | `JSON` | Array de áreas curriculares (Ej: `["Matemática", "Física"]`) |
| `grados_asignados` | `JSON` | Grados donde imparte docencia (Ej: `["3ro Primaria", "4to Primaria"]`) |
| `creado_en` | `TIMESTAMP` | Fecha de registro |

---

#### C. Tabla `supervisiones_area_minerd` (Vínculo Coordinador - Docente)
Define qué docentes o áreas específicas supervisa cada coordinador dentro de la escuela.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | `UUID` | Llave primaria |
| `escuela_id` | `UUID (FK -> escuelas.id)` | Escuela donde opera la coordinación |
| `coordinador_id` | `UUID (FK -> usuarios.id)` | Usuario con rol `'coordinador_area'` |
| `docente_id` | `UUID (FK -> usuarios.id)` | Docente supervisado (o `NULL` si supervisa toda el área) |
| `area_curricular` | `VARCHAR(80)` | Área asignada (Ej: *Ciencias de la Naturaleza*) |
| `nivel` | `VARCHAR(40)` | Nivel supervisado (Ej: *Secundaria*) |
| `activo` | `BOOLEAN` | Vigencia de la asignación |

---

#### D. Tabla `planificaciones` (Núcleo Curricular)
Almacena las planificaciones generadas por el motor de IA y editadas por el docente.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | `VARCHAR(36)` / `UUID` | Identificador único de la planificación |
| `escuela_id` | `UUID (FK -> escuelas.id)` | Escuela propietaria del documento |
| `docente_id` | `UUID (FK -> usuarios.id)` | Docente autor de la planificación |
| `titulo` | `VARCHAR(200)` | Tema o título (Ej: *"Secuencia Didáctica: Fracciones Propias"*) |
| `nivel` | `VARCHAR(40)` | *inicial*, *primario*, *secundario*, etc. |
| `grado` | `VARCHAR(60)` | Grado escolar exacto del MINERD |
| `area` | `VARCHAR(80)` | Asignatura curricular |
| `periodo` | `VARCHAR(40)` | *diaria*, *semanal*, *unidad*, *proyecto*, etc. |
| `esquema_id` | `VARCHAR(50)` | Identificador del esquema (Ej: *conbase*, *abp*, *secuencia_didactica*) |
| `datos_planificacion` | `JSON` | Diccionario estructurado con los bloques oficiales |
| `ajustes_manuales` | `JSON` | Modificaciones posteriores hechas por el docente |
| `estado` | `ENUM` | `'borrador'`, `'enviada_revision'`, `'aprobada'`, `'observada'` |
| `creado_en` | `TIMESTAMP` | Fecha original de generación |
| `actualizado_en` | `TIMESTAMP` | Última edición guardada |

---

#### E. Tabla `revisiones_coordinador` (Acompañamiento Pedagógico)
Registra las revisiones, notas de acompañamiento y sugerencias de mejora del coordinador.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | `UUID` | Llave primaria de la revisión |
| `planificacion_id` | `UUID (FK -> planificaciones.id)` | Planificación evaluada |
| `coordinador_id` | `UUID (FK -> usuarios.id)` | Coordinador que realizó la revisión |
| `estado_revision` | `ENUM` | `'aprobada'`, `'requiere_ajustes'`, `'sugerencias'` |
| `comentarios_generales`| `TEXT` | Observaciones pedagógicas de fondo |
| `bloques_observados` | `JSON` | Observaciones puntuales campo por campo (ej. *"Ajustar indicador 2"*) |
| `fecha_revision` | `TIMESTAMP` | Momento de la revisión |

---

### 3. Matriz de Control de Acceso Basado en Roles (RBAC)

| Capacidad / Acción | Docente | Coordinador de Área | Director del Centro |
|---|:---:|:---:|:---:|
| Crear y editar planificaciones propias | ✅ | ✅ (si imparte aula) | ❌ |
| Guardar en biblioteca personal | ✅ | ✅ | ❌ |
| Enviar planificación a supervisión | ✅ | ❌ | ❌ |
| Ver planificaciones de su área en la escuela | ❌ | ✅ | ✅ |
| Emitir observaciones y feedback pedagógico | ❌ | ✅ | ✅ |
| Aprobar planificación oficial | ❌ | ✅ | ✅ |
| Ver panel analítico de cobertura curricular | ❌ | ✅ (su área) | ✅ (toda la escuela) |
| Exportar a Word / Imprimir / Compartir | ✅ | ✅ | ✅ |

---

### 4. Consultas Clave para el Backend de Supervisión (Ejemplos SQL)

#### Consulta del Coordinador para ver planificaciones de su área:
```sql
SELECT 
    p.id,
    p.titulo,
    p.grado,
    p.area,
    p.periodo,
    p.estado,
    p.creado_en,
    u.nombre_completo AS docente_nombre
FROM planificaciones p
INNER JOIN usuarios u ON p.docente_id = u.id
INNER JOIN supervisiones_area_minerd s 
    ON s.coordinador_id = :coordinador_id 
   AND s.area_curricular = p.area
   AND s.escuela_id = p.escuela_id
WHERE p.escuela_id = :escuela_id
  AND p.estado IN ('enviada_revision', 'aprobada', 'observada')
ORDER BY p.creado_en DESC;
```

---

### 5. Plan de Migración desde el Modo Monousuario Actual

1. **Compatibilidad hacia atrás garantizada:**
   El código actual utiliza `localStorage` y `teacherHistory.js` sin autenticación forzada. Cuando se active la Fase 12:
   - Se creará una función `sincronizarPlanificacionesLocales(usuarioId, escuelaId)` que migrará los registros locales a la base de datos central.
2. **Privacidad y Aislamiento:**
   Cada petición al backend validará que el `docente_id` pertenezca a la misma `escuela_id` antes de permitir lectura o edición.

---

## 🔐 Control de Acceso Institucional y Modo de Uso Personal

La aplicación cuenta con dos modalidades de acceso configurables:

### A. Modo de Uso Personal (Activo por Defecto)
Permite ingresar a la aplicación directamente sin pantalla de bloqueo ni contraseñas.
- **Frontend (`client/src/App.jsx`):**
  ```javascript
  const MODO_USO_PERSONAL = true;
  ```
- **Backend (`server/.env`):**
  ```env
  REQUIRE_ACCESS_KEY=false
  ```

### B. Cómo Reactivar la Contraseña Institucional para Compartir con Otros Maestros
Cuando decidas abrir el enlace de Cloudflare a otros docentes o autoridades escolares y quieras exigir clave de acceso:

1. **En `server/.env`:**
   Cambia la bandera a `true` y verifica la contraseña deseada:
   ```env
   REQUIRE_ACCESS_KEY=true
   APP_ACCESS_KEY=RD-Maestro-8492
   ```
2. **En `client/src/App.jsx`:**
   Cambia la constante a `false`:
   ```javascript
   const MODO_USO_PERSONAL = false;
   ```
3. **Reinicia el backend (`node index.js`)**:
   El componente `AccessGate.jsx` se presentará automáticamente al abrir la app, y el backend rechazará con HTTP 401 cualquier petición externa que no incluya el token válido.

---

## 🌐 Configuración de Acceso Público (Cloudflare Tunnel)

Para exponer la aplicación en internet sin exponer puertos de tu router:
- Ejecutar: `cloudflared tunnel --protocol http2 --url http://localhost:5173`
- La URL asignada por Cloudflare se almacena en la variable de entorno `PUBLIC_URL` en `server/.env`.
- El frontend utiliza rutas relativas (`/api/...`), por lo que la aplicación funciona automáticamente bajo cualquier dominio o túnel sin necesidad de cambiar código.


# Psiké — Guía de despliegue

Simulador de entrevistas clínicas para formación en psicología. Los estudiantes practican entrevistas con pacientes simulados por IA y reciben una evaluación automática; los profesores hacen seguimiento desde un panel docente.

**Stack:** Express + SQLite + TypeScript (backend) · React + Vite + Tailwind (frontend) · Docker Compose · API de Anthropic.

---

## Si vas a desplegar con Claude

Pásale este repositorio a Claude Code y dile:

> Lee el README.md y despliega el proyecto. Mi API key de Anthropic es `sk-ant-...`

Claude tiene aquí todo lo que necesita. Los pasos manuales están abajo por si prefieres hacerlo tú.

---

## Requisitos

- **Docker** y **Docker Compose** ([instalar](https://docs.docker.com/get-docker/)). Verifica con `docker --version`.
- **Una API key de Anthropic**, desde [console.anthropic.com](https://console.anthropic.com/settings/keys). Empieza por `sk-ant-`. Sin ella el chat con pacientes no funciona.
- Puertos **5000** y **9006** libres.

No necesitas instalar Node ni SQLite: corren dentro de los contenedores.

---

## Despliegue en 3 pasos

### 1. Clonar y crear el `.env`

```bash
git clone https://github.com/cgiohidalgos/alejo-psico.git
cd alejo-psico
cp backend/.env.example backend/.env
```

### 2. Configurar las dos variables obligatorias

Edita `backend/.env`:

```bash
ANTHROPIC_API_KEY="sk-ant-..."          # tu key real
JWT_SECRET="..."                         # genérala: openssl rand -hex 32
```

Deja `PORT=5000` como está: debe coincidir con el puerto que mapea `docker-compose.yml`.

> `backend/.env` está en `.gitignore` y nunca debe subirse al repositorio.

### 3. Levantar

```bash
docker compose up -d --build
```

La primera vez tarda unos minutos compilando. Al terminar:

| Servicio | URL | Puerto |
|---|---|---|
| Frontend | http://localhost:9006 | 9006 |
| Backend (API) | http://localhost:5000 | 5000 |

La base de datos SQLite se crea sola en `backend/db/clinical.sqlite`, ya sembrada con el usuario admin, 10 categorías y 7 casos clínicos de ejemplo.

---

## Entrar por primera vez

Abre http://localhost:9006 e inicia sesión:

```
Usuario:    admin@admin.com
Contraseña: admin123
```

Estas credenciales se siembran automáticamente al arrancar (ver `seedAdmin()` en `backend/src/db.ts`). Solo se crean si el usuario no existe todavía.

> **Cámbialas antes de exponer la aplicación a internet.** Son públicas: están en el código fuente de este repositorio. Cualquiera que conozca el proyecto puede probarlas. Hazlo desde el panel de administración, una vez dentro.

Desde el panel de admin puedes crear profesores y estudiantes. Los roles son `admin`, `teacher` y `student`; cada estudiante se asocia a un profesor mediante `teacher_id`.

---

## Verificar que quedó bien

```bash
docker compose ps                 # ambos servicios en estado "Up"
docker compose logs backend       # debe decir: Backend corriendo en http://localhost:5000
```

Prueba real de extremo a extremo: entra a http://localhost:9006, inicia sesión como admin, abre un caso clínico y escribe un mensaje al paciente. Si responde, la API key funciona.

---

## Comandos útiles

```bash
docker compose logs -f            # ver logs en vivo
docker compose restart backend    # reiniciar tras cambiar el .env
docker compose down               # detener
docker compose up -d --build      # reconstruir tras cambiar código
```

---

## Problemas comunes

**El chat no responde o los logs dicen "ANTHROPIC_API_KEY no está configurada".**
Falta la key o el `.env` no se cargó. Revisa `backend/.env` y reinicia: `docker compose restart backend`.

**El frontend carga pero toda petición a la API falla.**
Casi siempre es el puerto: si cambiaste `PORT` en `backend/.env`, debe coincidir con el mapeo de `docker-compose.yml` y con `BACKEND_URL`. Lo más simple es dejar 5000 en los tres sitios.

**"port is already allocated" al levantar.**
Otro proceso ocupa el 5000 o el 9006. Libéralo o cambia el mapeo en `docker-compose.yml`.

**Cambié código y no se refleja.**
`docker compose up -d --build`.

**Quiero empezar de cero con la base de datos.**
Borra `backend/db/clinical.sqlite` y reinicia; se vuelve a sembrar. Esto elimina todos los usuarios y sesiones guardadas.

---

## Antes de exponerlo a internet

Esta configuración está pensada para desarrollo y demos. Para producción, como mínimo:

1. **Cambia la contraseña de `admin@admin.com`.** Está publicada en este repositorio.
2. **Define un `JWT_SECRET` real.** Si falta, el backend usa un valor por defecto conocido (`CAMBIO_SECRETO_123`) y cualquiera puede falsificar tokens de sesión.
3. **Pon HTTPS delante**, con un reverse proxy como nginx o Caddy.
4. **No expongas el puerto 5000** públicamente; que el frontend sea la única entrada.
5. **Respalda `backend/db/clinical.sqlite`**, que es toda la persistencia de la aplicación.
6. Los Dockerfiles corren `npm run dev` (nodemon y el dev server de Vite). Para producción conviene compilar: `npm run build` y servir estáticos.

---

## Estructura

```
backend/          API Express + SQLite
  src/server.ts   endpoints y llamadas a la API de Anthropic
  src/db.ts       esquema, migraciones y datos semilla
  db/             base SQLite (se crea sola)
frontend/         SPA en React + Vite
  src/pages/      Auth, Index, AdminPanel, TeacherPanel, GuestDemo
articulo/         manuscrito y scripts de análisis (no afecta el despliegue)
```

Documentación de los endpoints de la API: [backend/README.md](backend/README.md).

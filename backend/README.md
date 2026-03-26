# Backend Clinical (Express + SQLite + Anthropic)

## Descripción
API backend para app clinical con:

- endpoint `/api/chat` (interview/evaluation)
- endpoint `/api/sessions` (grabado en SQLite)
- almacenamiento local SQLite (`db/clinical.sqlite`)

## Configuración

1. Copia `.env.example` a `.env`.
2. Define tu `ANTHROPIC_API_KEY`.
3. Opcional: ajusta `PORT` y `SQLITE_DB_PATH`.

## Scripts

- `npm run dev` - desarrollo con nodemon/tsx.
- `npm run build` - compila TypeScript.
- `npm run start` - ejecuta `dist/server.js`.

## API

POST /api/chat
- body: `{ type: 'interview'|'evaluation', messages, caso, orientacion, historia? }`
- respuesta `interview`: `{ response: string }`
- respuesta `evaluation`: `{ evaluation, sessionId }`

POST /api/sessions
- body: `{ estudiante_nombre, orientacion, caso, mensajes, historia, evaluacion }`

GET /api/sessions
GET /api/sessions/:id

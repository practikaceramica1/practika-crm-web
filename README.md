# Practika CRM v3

Nuevo proyecto con mismo stack (Next + TypeScript + Tailwind + Supabase), estructura modular estilo plataforma.

## Setup

1. `npm install`
2. `cp .env.example .env.local`
3. Usa el mismo proyecto Supabase que `practika-crm-v2` (con sus migraciones ya ejecutadas).
   - Si es un Supabase nuevo, ejecuta primero las migraciones de `practika-crm-v2`.
4. `npm run dev`

## Principios de UI v3

- Vistas separadas dentro de serie (`documents`, `formats`, `colors`, `filters`)
- Menos dropdowns bloqueantes y más edición contextual
- Upload directo de ficheros desde CRM (R2 / Cloudinary)

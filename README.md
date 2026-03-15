# Humana Caregivers Website

A wellness-focused web experience for caregivers of older adults.  
This project includes:

- A **Flask app** (`app.py`) serving the main pages and a simple AI chat endpoint (`/ask`)
- A lightweight **Express/TypeScript server** (`server.ts`) for static/EJS hosting in the Node toolchain

## Features

- Landing page for intergenerational wellness (`/`)
- Activities page with interactive activity finder and quiz (`/activities`)
- Physical health caregiver guide page (`/physical-health`)
- Mental health caregiver guide page (`/mental-health`)
- Social connection caregiver guide page (`/social-connection`)
- Floating AI chat widget on the homepage (calls Flask `POST /ask`)
- Rule-based assistant responses via `ai_agent.py` keyword matching

## Tech Stack

- Python 3 + Flask
- HTML (Jinja templates in `templates/`)
- JavaScript + Bootstrap + Lucide icons
- Node.js + TypeScript + Express (secondary server path)

## Project Structure

```text
Humana_CareGivers_Website/
|-- app.py                  # Flask app (primary)
|-- ai_agent.py             # Simple keyword-based assistant
|-- templates/
|   |-- index.html
|   |-- activities.html
|   |-- physical_health.html
|   |-- mental_health.html
|   `-- social_connection.html
|-- static/                 # Flask static assets (images)
|-- server.ts               # Express server (secondary)
|-- views/index.ejs         # EJS view for Express path
|-- public/css/style.css    # CSS for Express path
|-- package.json
`-- .env.example
```

## Run Locally (Flask - Primary)

1. Create and activate a Python virtual environment.
2. Install Flask.
3. Start the app.

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install flask
python app.py
```

App runs on `http://localhost:3000`.

### Flask Routes

- `GET /` → homepage (`templates/index.html`)
- `GET /activities` → activities page (`templates/activities.html`)
- `GET /physical-health` → physical wellness guide (`templates/physical_health.html`)
- `GET /mental-health` → mental wellness guide (`templates/mental_health.html`)
- `GET /social-connection` → social wellness guide (`templates/social_connection.html`)
- `POST /ask` → chat response endpoint (JSON in/out)

Sample request to `/ask`:

```json
{ "message": "Any activity ideas?" }
```

## Run Locally (Node/Express - Optional)

If you want to run the TypeScript server path:

```powershell
npm install
npm run dev
```

This starts `server.ts` on port `3000` with:

- `GET /api/health` health endpoint
- A root route (`GET /`) that currently points to `index.html` in the project root (no root `index.html` is present in this repo)

## Environment Variables

The repo includes `.env.example` with:

- `GEMINI_API_KEY`
- `APP_URL`

These are currently not required for the default Flask keyword-based assistant in `ai_agent.py`, but are included for future AI-hosting integrations.

## Notes

- The homepage chat widget depends on Flask `POST /ask`; use the Flask path for the full experience.
- The repository contains both Python and Node artifacts; this README documents both so contributors can choose the intended runtime.

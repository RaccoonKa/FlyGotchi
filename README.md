# FlyGotchi

Кроссплатформенный цифровой питомец (тамагочи) на базе симуляции коннектома плодовой мушки (*Drosophila melanogaster*).

## Структура проекта

```text
FlyGotchi/
├── .gitattributes          # Принудительные LF-переносы строк для Linux и Windows
├── .gitignore              # Исключения для Python, Node.js, Docker, IDE и data/
├── docker-compose.yml      # Оркестрация backend + frontend с hot-reload
├── data/
│   └── .gitkeep            # Каталог для весов коннектома (игнорируется Git)
├── backend/                # FastAPI + WebSocket симулятор мозга (Python 3.12+)
│   ├── Dockerfile
│   ├── pyproject.toml
│   └── src/
│       ├── __init__.py
│       └── main.py
└── frontend/               # React + TypeScript + Vite + Tailwind + PixiJS v8
    ├── Dockerfile
    ├── package.json
    ├── vite.config.ts
    ├── tsconfig.json
    └── src/
        ├── App.tsx
        ├── main.tsx
        ├── index.css
        ├── types/brain.ts
        ├── hooks/useBrainSocket.ts
        └── components/
            ├── FlyArena.tsx
            └── TelemetryPanel.tsx
```

---

## Быстрый старт (Linux и Windows)

Проект полностью контейнеризован и запускается одной командой:

```bash
docker compose up --build
```

После запуска откройте в браузере:
- **Веб-интерфейс (Frontend):** http://localhost:5173
- **Healthcheck API (Backend):** http://localhost:8000/health
- **WebSocket поток мозга:** `ws://localhost:8000/ws/brain`

Для остановки нажмите `Ctrl+C` или выполните:

```bash
docker compose down
```

---

## Инструкция для Linux

1. Установите **Docker Engine** и **Docker Compose v2** (`docker compose version`).
2. Клонируйте репозиторий и перейдите в директорию проекта:
   ```bash
   git clone <URL_РЕПОЗИТОРИЯ> FlyGotchi
   cd FlyGotchi
   ```
3. Запустите проект:
   ```bash
   docker compose up --build
   ```
4. Редактируйте файлы в `backend/src/` или `frontend/src/` — изменения применяются автоматически (Uvicorn `--reload` и Vite HMR).

---

## Инструкция для Windows (Docker Desktop + WSL2)

1. Установите **WSL2** (например, Ubuntu) и **Docker Desktop for Windows** с включённым бэкендом **WSL 2 based engine** (*Settings → General → Use the WSL 2 based engine*).
2. В настройках Docker Desktop включите интеграцию с вашим дистрибутивом WSL (*Settings → Resources → WSL Integration*).
3. **Рекомендуется:** клонируйте проект внутрь файловой системы WSL2 (например, `~/projects/FlyGotchi`), а не в `/mnt/c/...` — это в разы ускоряет сборку и работу file watchers.
4. Перед клонированием убедитесь, что Git не подменяет переносы строк на CRLF:
   ```bash
   git config --global core.autocrlf input
   ```
   > В репозитории также настроен `.gitattributes` с правилом `* text=auto eol=lf`, поэтому переносы строк останутся совместимыми.
5. В терминале WSL2 выполните:
   ```bash
   git clone <URL_РЕПОЗИТОРИЯ> ~/projects/FlyGotchi
   cd ~/projects/FlyGotchi
   docker compose up --build
   ```
6. Откройте http://localhost:5173 в браузере Windows.
7. **Hot-reload в WSL2:** в `docker-compose.yml` и `frontend/vite.config.ts` уже включён режим polling (`CHOKIDAR_USEPOLLING=true`, `WATCHPACK_POLLING=true`, `WATCHFILES_FORCE_POLLING=true`), поэтому автообновление работает стабильно на обоих ОС.

---

## Протокол WebSocket (`/ws/brain`)

Сервер рассылает состояние симуляции **20 раз в секунду (20 Hz)**:

```json
{
  "tick": 120,
  "x": 412.5,
  "y": 298.1,
  "angle": 1.42,
  "hunger": 0.31,
  "state": "foraging",
  "clusters": {
    "vision": 0.18,
    "motor": 0.42,
    "hunger": 0.33
  },
  "arena": {
    "width": 800.0,
    "height": 600.0
  }
}
```

Клиент может отправлять команды управления:
- `{"action": "feed"}` — покормить мушку (снижает голод).
- `{"action": "poke", "x": 100, "y": 200}` — тактильный/зрительный стимул в точке `(x, y)` (клик по арене).
- `{"action": "stimulate_vision"}` — прямая стимуляция зрительного нерва.

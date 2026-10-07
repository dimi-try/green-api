# green-api

Базовый интерфейс мессенджера (по типу Telegram) на React. Бекенда нет — тестовые данные берутся из статического файла `public/data.json`.

## Стек

- React 18 + Vite
- Node.js (только для сборки/dev-сервера)
- Docker + docker-compose (сборка → nginx)
- Green API (авторизация через `getStateInstance`)

## Вход в систему

При первом запуске показывается страница входа: нужно указать **ID Instance** и **API Token** из личного кабинета Green API.

При нажатии «Подключиться» приложение вызывает:

```
GET https://api.green-api.com/waInstance{idInstance}/getStateInstance/{apiTokenInstance}
```

Если ответ содержит `"stateInstance": "authorized"` — открывается чат. Учётные данные сохраняются в `localStorage`, поэтому при перезагрузке страницы вход не требуется заново. Кнопка «Выйти» в сайдбаре сбрасывает сохранённые данные и возвращает на страницу входа.

```
React
  │
  │ GET getStateInstance
  ▼
GREEN-API
  │
  ▼
{ "stateInstance": "authorized" }
  │
  ▼
Чат
```

## Локальный запуск

```bash
npm install
npm run dev        # http://localhost:5173
```

Сборка для продакшена:

```bash
npm run build
npm run preview
```

## Запуск в Docker

```bash
docker compose up --build   # http://localhost:3000
```

## Структура

```
├── public/data.json     # тестовые данные: чаты + сообщения
├── src/
│   ├── App.jsx          # состояние: авторизация (Green API), выбранный чат, отправка
│   ├── App.css          # стили (dark-тема в стиле Telegram + страница входа)
│   └── components/
│       ├── Avatar.jsx   # аватар с инициалами (цвет от имени)
│       ├── ChatList.jsx # левая панель: список чатов с последними сообщениями
│       ├── ChatView.jsx # правая панель: переписка + поле ввода
│       └── Login.jsx    # страница входа (ID Instance + API Token, getStateInstance)
└── Dockerfile           # multi-stage: node (build) → nginx (serve)
```

## Правка тестовых данных

Открой `public/data.json`. Формат:

```json
{
  "chats": [
    {
      "id": "c1",
      "name": "Имя чата",
      "isGroup": false,
      "online": true,
      "unread": 2,
      "messages": [
        { "id": "m1", "author": "them", "text": "Входящее сообщение", "time": "09:12" },
        { "id": "m2", "author": "me", "text": "Исходящее сообщение", "time": "09:15" }
      ]
    }
  ]
}
```

- `author`: `"me"` — исходящее, `"them"` — входящее
- для групповых чатов (`isGroup: true`) у входящих можно указать `authorName`
- `unread` — счётчик непрочитанных (сбрасывается при открытии чата)

Отправка сообщений работает только в рамках текущей сессии (в state), обновления `data.json` при отправке не происходит.
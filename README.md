# green-api

Базовый интерфейс мессенджера (по типу Telegram) на React. Бекенда нет — тестовые данные берутся из статического файла `public/data.json`.

## Стек

- React 18 + Vite
- Node.js (только для сборки/dev-сервера)
- Docker + docker-compose (сборка → nginx)

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
│   ├── App.jsx          # загрузка данных, состояние (выбранный чат, отправка)
│   ├── App.css          # стили (dark-тема в стиле Telegram)
│   └── components/
│       ├── Avatar.jsx   # аватар с инициалами (цвет от имени)
│       ├── ChatList.jsx # левая панель: список чатов с последними сообщениями
│       └── ChatView.jsx # правая панель: переписка + поле ввода
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
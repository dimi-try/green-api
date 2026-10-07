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

## Отправка сообщений (Green API)

Чаты, созданные через «Новый чат», привязаны к реальному Telegram через Green API. Отправка:

```
POST /waInstance{idInstance}/sendMessage/{apiTokenInstance}
body: { "chatId": "1234567890", "message": "Привет!" }
→ { "idMessage": "1763115112345" }
```

Схема:

```
React
  │  POST sendMessage { chatId, message }
  ▼
GREEN-API → { idMessage }
  │
  ▼
Сообщение в чате (id = idMessage)
```

Сообщение добавляется в интерфейс оптимистично; при ошибке оно откатывается и показывается баннер с ошибкой. История созданных чатов (вместе с `chatId` и отправленными сообщениями) сохраняется в `localStorage` (`greenApiChats:{idInstance}`).

## Новый чат (CheckAccount)

Кнопка «Новый чат» в сайдбаре открывает диалог: можно указать Telegram **username** (`@vasya`) либо **номер телефона**.

```
React
  │  POST checkAccount { username } | { phoneNumber }
  ▼
GREEN-API
  │
  ▼
данные аккаунта → chatId
  │
  ▼
chatId сохраняется, чат добавляется в список
```

Дальше в этом чате работает `sendMessage(chatId, text)`. Telegram chat ID в Green API — числовой (для групп может быть отрицательным), без WhatsApp-префиксов `@c.us` / `@g.us`.

Примечание: точный адрес метода `checkAccount` и поле с `chatId` в его ответе могут отличаться — при необходимости подправьте `src/api/greenApi.js` и `extractChatId()` в `src/App.jsx`.

## Структура

```
├── public/data.json     # тестовые данные: чаты + сообщения
├── src/
│   ├── App.jsx          # состояние: авторизация, чаты, отправка, новый чат
│   ├── App.css          # стили (dark-тема, страница входа, диалоги)
│   ├── api/
│   │   └── greenApi.js  # клиент Green API (getStateInstance, checkAccount, sendMessage)
│   └── components/
│       ├── Avatar.jsx      # аватар с инициалами (цвет от имени)
│       ├── ChatList.jsx    # левая панель: список чатов + «Новый чат»/«Выйти»
│       ├── ChatView.jsx    # правая панель: переписка + поле ввода
│       ├── Login.jsx       # страница входа (getStateInstance)
│       └── NewChatDialog.jsx # диалог создания чата (checkAccount → chatId)
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

Отправка сообщений в тестовых чатах из `data.json` работает только в рамках текущей сессии (в state), обновления `data.json` при отправке не происходит.
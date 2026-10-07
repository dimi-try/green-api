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

## Получение сообщений (long polling)

Входящие сообщения приходят через два последовательных метода: `ReceiveNotification` → `DeleteNotification`.

```
React
  │  GET receiveNotification?receiveTimeout=25   (long polling: ждём до 25 с)
  ▼
GREEN-API
  │
  ▼
{
  "receiptId": 1234567,
  "body": {
    "typeWebhook": "incomingMessageReceived",
    "instanceData": { "idInstance": 4100000000, "typeInstance": "telegram" },
    "timestamp": 1763115112,
    "idMessage": "1763115112345",
    "senderData": {
      "chatId": "10000000",
      "chatType": "user",
      "sender": "10000000",
      "chatName": "Василиса",
      "senderName": "Василиса"
    },
    "messageData": {
      "typeMessage": "textMessage",
      "textMessageData": { "textMessage": "Привет, как дела?" }
    }
  }
}
  │
  ▼
DELETE deleteNotification/{receiptId}   ← обязательно, иначе событие вернётся снова
```

Ответ — это фактическая структура события GREEN-API. Приложение проверяет:

```js
if (
  notification.body.typeWebhook === "incomingMessageReceived" &&
  notification.body.messageData.typeMessage === "textMessage"
) {
  const text = notification.body.messageData.textMessageData.textMessage;
}
```

Далее:

- сообщение добавляется в чат по `senderData.chatId` (сообщение получает `id = body.idMessage`, время — из `timestamp`);
- если чата ещё нет — он создаётся автоматически (`senderData.chatName` / `senderName`);
- если чат не открыт — растёт счётчик непрочитанных (бейдж в списке);
- после обработки обязательно вызывается `DELETE /waInstance{idInstance}/deleteNotification/{apiTokenInstance}/{receiptId}`;
- при ошибке сети polling повторяется через 2 секунды; при повторном получении того же события дедупликация по `idMessage` отбросит дубль.

Примечание про 408/504: при пустой очереди long polling может завершаться статусами `408` (ожидание истекло) или `504` (таймаут шлюза). Оба трактуются как «событий нет» (см. `RECEIVE_TIMEOUT` в `src/api/greenApi.js`), polling продолжается без пауз.

Важно: в личном кабинете у инстанса должен быть очищен URL webhook'а, иначе `ReceiveNotification` вернёт `400` «Message cannot be received because custom webhook url is set...». Такая ошибка показывается красным баннером над списком чатов. Для отладки в консоли браузера пишется сырой статус и тело каждого ответа (`[green-api] receiveNotification ...`).

`null` от `receiveNotification` — это нормально: очередь уведомлений пуста, никто не писал инстансу.

Long polling запускается сразу после авторизации и останавливается при выходе («Выйти»).

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
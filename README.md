# green-api

Интерфейс мессенджера (по типу Telegram) на React + Green API. Бекенда нет: чаты, история и учётные данные хранятся в `localStorage` браузера.
<img width="1064" height="860" alt="image" src="https://github.com/user-attachments/assets/7c3b133b-65e6-4972-9ac2-55cd7d81ddcd" />

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

Кнопка «Новый чат» в сайдбаре открывает диалог: указываете Telegram **username** (`@vasya`). Имя без `@` не отправляется — выводится ошибка «Имя пользователя должно начинаться с @».

```
React
  │  POST checkAccount { username: "@vasya" }
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
  │  GET receiveNotification?receiveTimeout=5   (long polling: ждём до 5 с)
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
├── src/
│   ├── App.jsx          # состояние: авторизация, чаты, отправка, новый чат, long polling
│   ├── App.css          # стили (dark-тема, страница входа, диалоги)
│   ├── api/
│   │   └── greenApi.js  # клиент Green API (getStateInstance, checkAccount, sendMessage, receiveNotification, deleteNotification)
│   └── components/
│       ├── Avatar.jsx      # аватар с инициалами (цвет от имени)
│       ├── ChatList.jsx    # левая панель: список чатов + «Новый чат»/«Выйти»
│       ├── ChatView.jsx    # правая панель: переписка + поле ввода
│       ├── Login.jsx       # страница входа (getStateInstance)
│       └── NewChatDialog.jsx # диалог создания чата (checkAccount → chatId)
└── Dockerfile           # multi-stage: node (build) → nginx (serve)
```

## Формат чата в localStorage

Ключ `greenApiChats:{idInstance}`:

```json
[
  {
    "id": "tg-10000000",
    "name": "Василиса",
    "chatId": "10000000",
    "isGroup": false,
    "online": false,
    "unread": 0,
    "messages": [
      { "id": "126543123451133331119", "author": "them", "text": "Привет!", "time": "09:12" }
    ]
  }
]
```

- `chatId` — числовой Telegram chat ID из Green API (для групп может быть отрицательным)
- `author`: `"me"` — исходящее, `"them"` — входящее
- `unread` — счётчик непрочитанных (сбрасывается при открытии чата)
- учётные данные (ID Instance + API Token) — ключ `greenApiCredentials`

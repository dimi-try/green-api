const GREEN_API_BASE = "https://api.green-api.com";

// Минимальный long polling из документации (5–60 с).
// Короткий таймаут гарантированно меньше таймаута
// шлюза (proxy/CDN), иначе GET обрывается 504/408.
const RECEIVE_TIMEOUT = 5;

async function request(credentials, method, options = {}) {
  const res = await fetch(
    `${GREEN_API_BASE}/waInstance${credentials.idInstance}/${method}/${credentials.apiToken}`,
    options
  );
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message = data?.errorMessage ?? data?.message;
    throw new Error(message ? String(message) : `HTTP ${res.status}`);
  }
  return data;
}

// GET /waInstance{idInstance}/getStateInstance/{apiTokenInstance}
// → { stateInstance: "authorized" }
export function getStateInstance(credentials) {
  return request(credentials, "getStateInstance");
}

// POST /waInstance{idInstance}/checkAccount/{apiTokenInstance}
// Проверяет Telegram-аккаунт по username или phoneNumber,
// возвращает данные аккаунта (содержат chatId)
export function checkAccount(credentials, { username, phoneNumber }) {
  const body = username ? { username } : { phoneNumber };
  return request(credentials, "checkAccount", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

// POST /waInstance{idInstance}/sendMessage/{apiTokenInstance}
// body: { chatId, message } → { idMessage }
export function sendMessage(credentials, chatId, text) {
  return request(credentials, "sendMessage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chatId, message: text })
  });
}

// GET /waInstance{idInstance}/receiveNotification/{apiTokenInstance}?receiveTimeout={seconds}
// Long polling: ждёт событие до receiveTimeout секунд (5–60).
// Возвращает null, если за это время событий не было (пустой ответ).
// 504 (шлюз) и 408 (ожидание истекло) трактуем
// как «событий нет», а не как ошибку.
export async function receiveNotification(
  credentials,
  receiveTimeout = RECEIVE_TIMEOUT,
  signal
) {
  const res = await fetch(
    `${GREEN_API_BASE}/waInstance${credentials.idInstance}/receiveNotification/${credentials.apiToken}?receiveTimeout=${receiveTimeout}`,
    { signal }
  );
  if (res.status === 504 || res.status === 408) return null;
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    const message = data?.errorMessage ?? data?.message;
    throw new Error(message ? String(message) : `HTTP ${res.status}`);
  }
  const text = await res.text();
  if (process.env.NODE_ENV !== "production") {
    console.debug(
      "[green-api] receiveNotification",
      res.status,
      text || "(пустой ответ)"
    );
  }
  if (!text) return null;
  try {
    const data = JSON.parse(text);
    return data && (data.receiptId !== undefined || data.body)
      ? data
      : null;
  } catch {
    return null;
  }
}

// DELETE /waInstance{idInstance}/deleteNotification/{apiTokenInstance}/{receiptId}
// Удаляет событие из очереди после обработки
export async function deleteNotification(credentials, receiptId, signal) {
  const res = await fetch(
    `${GREEN_API_BASE}/waInstance${credentials.idInstance}/deleteNotification/${credentials.apiToken}/${receiptId}`,
    { method: "DELETE", signal }
  );
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return res.json().catch(() => null);
}

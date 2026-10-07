const GREEN_API_BASE = "https://api.green-api.com";

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

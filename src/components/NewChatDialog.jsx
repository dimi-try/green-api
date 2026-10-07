import { useState } from "react";

export default function NewChatDialog({ pending, error, onClose, onCreate }) {
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");

  const canSubmit = Boolean(username.trim() || phone.trim());

  const submit = (e) => {
    e.preventDefault();
    const name = username.trim();
    const number = phone.trim();
    if (!name && !number) return;
    onCreate({
      username: name || null,
      phoneNumber: number || null
    });
  };

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <form
        className="dialog-card"
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="dialog-title">Новый чат</h2>

        <label className="login-label">
          Telegram username
          <input
            className="login-input"
            type="text"
            placeholder="@vasya"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="off"
            disabled={pending}
          />
        </label>

        <label className="login-label">
          или номер телефона
          <input
            className="login-input"
            type="tel"
            placeholder="79001234567"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoComplete="off"
            disabled={pending}
          />
        </label>

        {error && <div className="login-error">{error}</div>}

        <div className="dialog-actions">
          <button
            type="button"
            className="dialog-cancel"
            onClick={onClose}
            disabled={pending}
          >
            Отмена
          </button>
          <button
            type="submit"
            className="login-submit"
            disabled={pending || !canSubmit}
          >
            {pending ? "Проверка..." : "Создать чат"}
          </button>
        </div>
      </form>
    </div>
  );
}

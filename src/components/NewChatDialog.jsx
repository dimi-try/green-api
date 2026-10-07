import { useState } from "react";

export default function NewChatDialog({ pending, error, onClose, onCreate }) {
  const [username, setUsername] = useState("");
  const [formError, setFormError] = useState(null);

  const name = username.trim();
  const canSubmit = name.length > 0;

  const submit = (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    if (!name.startsWith("@")) {
      setFormError('Имя пользователя должно начинаться с "@"');
      return;
    }
    onCreate({ username: name });
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
            onChange={(e) => {
              setUsername(e.target.value);
              setFormError(null);
            }}
            autoComplete="off"
            disabled={pending}
          />
        </label>

        {(error || formError) && (
          <div className="login-error">{error ?? formError}</div>
        )}

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

import { useState } from "react";
import { getStateInstance } from "../api/greenApi";

export default function Login({ onSuccess }) {
  const [idInstance, setIdInstance] = useState("");
  const [apiToken, setApiToken] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);

  const connect = async (e) => {
    e.preventDefault();
    const id = idInstance.trim();
    const token = apiToken.trim();

    if (!id || !token) {
      setError("Заполните ID Instance и API Token");
      return;
    }

    setPending(true);
    setError(null);

    try {
      const data = await getStateInstance({
        idInstance: id,
        apiToken: token
      });

      if (data?.stateInstance === "authorized") {
        onSuccess({ idInstance: id, apiToken: token });
      } else if (data?.stateInstance) {
        setError(
          `Инстанс не авторизован (stateInstance: ${data.stateInstance})`
        );
      } else {
        setError("Не удалось подключиться к Green API");
      }
    } catch (err) {
      setError(
        err.message === "HTTP 401"
          ? "Неверный ID Instance или API Token"
          : err instanceof TypeError
            ? "Сеть недоступна или API не отвечает"
            : err.message || "Не удалось подключиться к Green API"
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={connect}>
        <h1 className="login-title">GREEN TELEGRAM CHAT</h1>

        <label className="login-label">
          ID Instance
          <input
            className="login-input"
            type="text"
            placeholder="4100123456"
            value={idInstance}
            onChange={(e) => setIdInstance(e.target.value)}
            autoComplete="off"
            disabled={pending}
          />
        </label>

        <label className="login-label">
          API Token
          <input
            className="login-input"
            type="password"
            placeholder="abcdef123456..."
            value={apiToken}
            onChange={(e) => setApiToken(e.target.value)}
            autoComplete="off"
            disabled={pending}
          />
        </label>

        {error && <div className="login-error">{error}</div>}

        <button className="login-submit" type="submit" disabled={pending}>
          {pending ? "Подключение..." : "Подключиться"}
        </button>
      </form>
    </div>
  );
}

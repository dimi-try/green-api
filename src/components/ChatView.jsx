import { useEffect, useRef, useState } from "react";
import Avatar from "./Avatar";

export default function ChatView({
  chat,
  onSend,
  onBack,
  sending,
  sendError,
  onDismissSendError
}) {
  const [text, setText] = useState("");
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat?.id, chat?.messages.length]);

  const submit = (e) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText("");
  };

  return (
    <section className="main">
      <header className="chat-header">
        <button className="back-btn" onClick={onBack} aria-label="Назад">
          ←
        </button>
        <Avatar name={chat.name} />
        <div className="chat-header-info">
          <div className="chat-header-name">{chat.name}</div>
          <div className="chat-header-status">
            {chat.online ? "в сети" : chat.isGroup ? `${chat.members ?? ""} участников`.trim() : "был(а) недавно"}
          </div>
        </div>
      </header>

      {sendError && (
        <div className="send-error-banner">
          <span>{sendError}</span>
          <button
            type="button"
            onClick={onDismissSendError}
            aria-label="Скрыть"
          >
            ×
          </button>
        </div>
      )}

      <div className="messages">
        {chat.messages.map((msg) => (
          <div key={msg.id} className={`message ${msg.author === "me" ? "out" : "in"}`}>
            {chat.isGroup && msg.author === "them" && msg.authorName && (
              <div className="message-author">{msg.authorName}</div>
            )}
            <div className="message-text">{msg.text}</div>
            <span className="message-time">
              {msg.author === "me" && <span className="ticks">✓✓</span>} {msg.time}
            </span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form className="composer" onSubmit={submit}>
        <input
          className="composer-input"
          type="text"
          placeholder="Написать сообщение..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoFocus
          disabled={sending}
        />
        <button
          className="send-btn"
          type="submit"
          disabled={!text.trim() || sending}
        >
          {sending ? "Отправка..." : "Отправить"}
        </button>
      </form>
    </section>
  );
}

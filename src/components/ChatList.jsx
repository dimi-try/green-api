import Avatar from "./Avatar";

export default function ChatList({
  chats,
  activeId,
  query,
  onQueryChange,
  onSelect,
  onNewChat,
  onLogout,
  pollError
}) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-title-row">
          <h1 className="sidebar-title">Чаты</h1>
          <div className="sidebar-actions">
            {onNewChat && (
              <button className="new-chat-btn" onClick={onNewChat}>
                Новый чат
              </button>
            )}
            {onLogout && (
              <button
                className="logout-btn"
                onClick={onLogout}
                title="Отключиться от Green API"
              >
                Выйти
              </button>
            )}
          </div>
        </div>
        <input
          className="search-box"
          type="text"
          placeholder="Поиск"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
        />
      </div>

      {pollError && <div className="poll-error">{pollError}</div>}

      <div className="chat-list">
        {chats.length === 0 && <div className="chat-list-empty">Ничего не найдено</div>}

        {chats.map((chat) => {
          const last = chat.messages[chat.messages.length - 1];
          return (
            <div
              key={chat.id}
              className={`chat-item${chat.id === activeId ? " active" : ""}`}
              onClick={() => onSelect(chat.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && onSelect(chat.id)}
            >
              <Avatar name={chat.name} />
              <div className="chat-meta">
                <div className="chat-top">
                  <span className="chat-name">{chat.name}</span>
                  <span className="chat-time">{last?.time ?? ""}</span>
                </div>
                <div className="chat-bottom">
                  <span className={`last-message${last?.author === "me" ? " has-outgoing" : ""}`}>
                    {last?.author === "me" ? "Вы: " : ""}
                    {last?.text ?? ""}
                  </span>
                  {chat.unread > 0 && <span className="unread-badge">{chat.unread}</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

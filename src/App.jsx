import { useEffect, useMemo, useState } from "react";
import ChatList from "./components/ChatList";
import ChatView from "./components/ChatView";
import Login from "./components/Login";
import "./App.css";

const STORAGE_KEY = "greenApiCredentials";

function loadCredentials() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const creds = JSON.parse(raw);
    if (creds && creds.idInstance && creds.apiToken) return creds;
    return null;
  } catch {
    return null;
  }
}

export default function App() {
  const [credentials, setCredentials] = useState(loadCredentials);
  const [chats, setChats] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("/data.json")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setChats(data.chats ?? []);
        setActiveId(data.chats?.[0]?.id ?? null);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const activeChat = useMemo(
    () => chats.find((c) => c.id === activeId) ?? null,
    [chats, activeId]
  );

  const filteredChats = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return chats;
    return chats.filter((chat) => {
      const last = chat.messages[chat.messages.length - 1];
      return (
        chat.name.toLowerCase().includes(q) ||
        (last?.text?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [chats, query]);

  const selectChat = (id) => {
    setActiveId(id);
    setChats((prev) =>
      prev.map((c) => (c.id === id ? { ...c, unread: 0 } : c))
    );
  };

  const sendMessage = (text) => {
    const time = new Date().toLocaleTimeString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit"
    });
    setChats((prev) =>
      prev.map((c) =>
        c.id === activeId
          ? {
              ...c,
              messages: [
                ...c.messages,
                { id: `local-${Date.now()}`, author: "me", text, time }
              ]
            }
          : c
      )
    );
  };

  const handleLogin = (creds) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(creds));
    setCredentials(creds);
  };

  const handleLogout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setCredentials(null);
  };

  if (!credentials) {
    return <Login onSuccess={handleLogin} />;
  }

  if (loading) {
    return <div className="boot">Загрузка чатов...</div>;
  }

  if (error) {
    return (
      <div className="boot">
        Не удалось загрузить /data.json: {error}
      </div>
    );
  }

  return (
    <div className={`app${activeChat ? " chat-open" : ""}`}>
      <ChatList
        chats={filteredChats}
        activeId={activeId}
        query={query}
        onQueryChange={setQuery}
        onSelect={selectChat}
        onLogout={handleLogout}
      />
      {activeChat ? (
        <ChatView
          chat={activeChat}
          onSend={sendMessage}
          onBack={() => setActiveId(null)}
        />
      ) : (
        <section className="main">
          <div className="empty-state">Выберите чат, чтобы начать переписку</div>
        </section>
      )}
    </div>
  );
}

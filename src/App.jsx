import { useEffect, useMemo, useState } from "react";
import ChatList from "./components/ChatList";
import ChatView from "./components/ChatView";
import Login from "./components/Login";
import NewChatDialog from "./components/NewChatDialog";
import { checkAccount, sendMessage } from "./api/greenApi";
import "./App.css";

const STORAGE_KEY = "greenApiCredentials";
const CHATS_KEY_PREFIX = "greenApiChats:";

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

function loadCustomChats(idInstance) {
  try {
    const raw = localStorage.getItem(`${CHATS_KEY_PREFIX}${idInstance}`);
    const chats = raw ? JSON.parse(raw) : [];
    return Array.isArray(chats) ? chats : [];
  } catch {
    return [];
  }
}

function appendToChat(chats, id, message) {
  return chats.map((c) =>
    c.id === id ? { ...c, messages: [...c.messages, message] } : c
  );
}

// CheckAccount возвращает данные аккаунта Telegram; chatId может прийти
// в разных полях
function extractChatId(data) {
  const raw = data?.chatId ?? data?.id ?? data?.userId ?? null;
  return raw === null || raw === undefined ? null : String(raw);
}

export default function App() {
  const [credentials, setCredentials] = useState(loadCredentials);
  const [dataChats, setDataChats] = useState([]);
  const [customChats, setCustomChats] = useState(() =>
    credentials ? loadCustomChats(credentials.idInstance) : []
  );
  const [activeId, setActiveId] = useState(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(null);
  const [showNewChat, setShowNewChat] = useState(false);
  const [dialogPending, setDialogPending] = useState(false);
  const [dialogError, setDialogError] = useState(null);

  useEffect(() => {
    fetch("/data.json")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setDataChats(data.chats ?? []);
        setActiveId(data.chats?.[0]?.id ?? null);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  // Сохраняем созданные чаты (chatId + локальная история) per instance
  useEffect(() => {
    if (!credentials) return;
    localStorage.setItem(
      `${CHATS_KEY_PREFIX}${credentials.idInstance}`,
      JSON.stringify(customChats)
    );
  }, [customChats, credentials]);

  const chats = useMemo(
    () => [...dataChats, ...customChats],
    [dataChats, customChats]
  );

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
    setDataChats((prev) =>
      prev.map((c) => (c.id === id ? { ...c, unread: 0 } : c))
    );
    setCustomChats((prev) =>
      prev.map((c) => (c.id === id ? { ...c, unread: 0 } : c))
    );
  };

  const sendMessageToChat = async (text) => {
    const chat = chats.find((c) => c.id === activeId);
    if (!chat) return;
    const time = new Date().toLocaleTimeString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit"
    });

    // Тестовые чаты из data.json не имеют chatId — сообщение живёт только в сессии
    if (!chat.chatId || !credentials) {
      setDataChats((prev) =>
        appendToChat(prev, chat.id, {
          id: `local-${Date.now()}`,
          author: "me",
          text,
          time
        })
      );
      return;
    }

    const tempId = `temp-${Date.now()}`;
    setCustomChats((prev) =>
      appendToChat(prev, chat.id, { id: tempId, author: "me", text, time })
    );
    setSending(true);
    try {
      const data = await sendMessage(credentials, chat.chatId, text);
      setCustomChats((prev) =>
        prev.map((c) =>
          c.id === chat.id
            ? {
                ...c,
                messages: c.messages.map((m) =>
                  m.id === tempId
                    ? { ...m, id: String(data?.idMessage ?? tempId) }
                    : m
                )
              }
            : c
        )
      );
    } catch (err) {
      // Откатываем optimistic-сообщение и показываем ошибку
      setCustomChats((prev) =>
        prev.map((c) =>
          c.id === chat.id
            ? { ...c, messages: c.messages.filter((m) => m.id !== tempId) }
            : c
        )
      );
      setSendError(err.message || "Не удалось отправить сообщение");
    } finally {
      setSending(false);
    }
  };

  const handleCreateChat = async ({ username, phoneNumber }) => {
    setDialogPending(true);
    setDialogError(null);
    try {
      const data = await checkAccount(credentials, { username, phoneNumber });
      const chatId = extractChatId(data);
      if (!chatId) {
        setDialogError("CheckAccount не вернул chatId");
        return;
      }

      const name = username ? username.replace(/^@+/, "") : phoneNumber;

      const existing = customChats.find((c) => c.chatId === chatId);
      if (existing) {
        setActiveId(existing.id);
      } else {
        const chat = {
          id: `tg-${chatId}`,
          name,
          chatId,
          isGroup: false,
          online: false,
          unread: 0,
          messages: []
        };
        setCustomChats((prev) => [...prev, chat]);
        setActiveId(chat.id);
      }
      setShowNewChat(false);
    } catch (err) {
      setDialogError(err.message || "Аккаунт не найден или API недоступно");
    } finally {
      setDialogPending(false);
    }
  };

  const handleLogin = (creds) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(creds));
    setCredentials(creds);
    setCustomChats(loadCustomChats(creds.idInstance));
  };

  const handleLogout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setCredentials(null);
    setCustomChats([]);
    setShowNewChat(false);
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
        onNewChat={() => {
          setShowNewChat(true);
          setDialogError(null);
        }}
        onLogout={handleLogout}
      />

      {showNewChat && (
        <NewChatDialog
          pending={dialogPending}
          error={dialogError}
          onClose={() => setShowNewChat(false)}
          onCreate={handleCreateChat}
        />
      )}

      {activeChat ? (
        <ChatView
          chat={activeChat}
          onSend={sendMessageToChat}
          onBack={() => setActiveId(null)}
          sending={sending}
          sendError={sendError}
          onDismissSendError={() => setSendError(null)}
        />
      ) : (
        <section className="main">
          <div className="empty-state">Выберите чат, чтобы начать переписку</div>
        </section>
      )}
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import ChatList from "./components/ChatList";
import ChatView from "./components/ChatView";
import Login from "./components/Login";
import NewChatDialog from "./components/NewChatDialog";
import {
  checkAccount,
  deleteNotification,
  receiveNotification,
  sendMessage
} from "./api/greenApi";
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

function formatTimestamp(ts) {
  const date = ts ? new Date(Number(ts) * 1000) : new Date();
  return date.toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit"
  });
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
  const [pollError, setPollError] = useState(null);

  // Актуальный выбранный чат для long polling (чтобы не сбрасывать
  // polling-петлю при смене активного чата)
  const activeIdRef = useRef(activeId);
  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

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

  // Приём входящих сообщений: long polling
  // ReceiveNotification → обработка → DeleteNotification
  useEffect(() => {
    if (!credentials) return;

    let active = true;
    const controller = new AbortController();

    const handleNotification = (notification) => {
      const body = notification?.body;
      const messageData = body?.messageData;
      if (
        body?.typeWebhook !== "incomingMessageReceived" ||
        messageData?.typeMessage !== "textMessage"
      ) {
        return;
      }
      const text = messageData?.textMessageData?.textMessage;
      const { chatId, chatType, chatName, senderName } =
        body?.senderData ?? {};
      if (!text || !chatId) return;

      const msg = {
        id: String(body.idMessage ?? `incoming-${Date.now()}`),
        author: "them",
        text,
        time: formatTimestamp(body?.timestamp),
        ...(senderName ? { authorName: senderName } : {})
      };

      setCustomChats((prev) => {
        const chat = prev.find((c) => c.chatId === String(chatId));
        if (!chat) {
          // Пишут нам впервые — создаём чат автоматически
          return [
            ...prev,
            {
              id: `tg-${chatId}`,
              name: chatName || senderName || String(chatId),
              chatId: String(chatId),
              isGroup: chatType === "group",
              online: false,
              unread: 1,
              messages: [msg]
            }
          ];
        }
        // Дедупликация: событие могло прийти повторно
        if (chat.messages.some((m) => m.id === msg.id)) return prev;
        return prev.map((c) =>
          c.id === chat.id
            ? {
                ...c,
                unread: c.id === activeIdRef.current ? 0 : c.unread + 1,
                messages: [...c.messages, msg]
              }
            : c
        );
      });
    };

    const poll = async () => {
      while (active) {
        try {
          const notification = await receiveNotification(
            credentials,
            undefined,
            controller.signal
          );
          if (!active) return;
          setPollError(null);
          if (!notification) continue;

          handleNotification(notification);

          // Обязательно удаляем событие из очереди,
          // иначе следующий опрос вернёт его снова
          try {
            await deleteNotification(
              credentials,
              notification.receiptId,
              controller.signal
            );
          } catch {
            // Не критично: дедупликация по idMessage защитит от дубля
          }
        } catch (err) {
          if (!active) return;
          // Например: задан webhook URL в кабинете —
          // ReceiveNotification вернёт 400, показываем причину
          setPollError(err.message || "Ошибка получения уведомлений");
          // Сеть/API недоступны — пауза и повтор
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }
    };

    poll();

    return () => {
      active = false;
      controller.abort();
    };
  }, [credentials]);

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
        pollError={pollError}
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

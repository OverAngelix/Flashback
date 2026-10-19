import { reactive } from "vue";
import type { ClientMessage, GameView, ServerMessage } from "@server/net/protocol";

export type Status = "idle" | "connecting" | "open" | "reconnecting";

/** Ce qu'il faut garder pour reprendre sa place après un rechargement ou une coupure. */
export interface StoredSession {
  role: "host" | "player";
  code: string;
  token: string;
}

export interface SocketLike {
  readyState: number;
  send(data: string): void;
  close(): void;
  onopen: (() => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onclose: (() => void) | null;
  onerror: (() => void) | null;
}

export interface ConnectionDeps {
  url: () => string;
  createSocket: (url: string) => SocketLike;
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null;
}

const OPEN = 1;
const STORAGE_KEY = "flashback.session";
const RETRY_MIN_MS = 1000;
const RETRY_MAX_MS = 8000;

/**
 * Connexion au serveur de jeu : file d'attente avant l'ouverture, reconnexion automatique avec le
 * jeton de session (un téléphone qui se met en veille revient dans la partie) et état réactif.
 */
export function createConnection(deps: ConnectionDeps) {
  const state = reactive({
    status: "idle" as Status,
    session: null as (StoredSession & { playerId?: string }) | null,
    view: null as GameView | null,
    /** Identifiant du joueur pour qui l'état a été envoyé ; null pour l'hôte. */
    you: null as string | null,
    error: null as { code: string; message: string } | null,
    /** La reprise a échoué (salle supprimée ou jeton refusé). */
    sessionLost: false,
    kicked: false,
  });

  let socket: SocketLike | null = null;
  let queue: ClientMessage[] = [];
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let retries = 0;
  let intentional = false;
  /** Vrai entre l'envoi d'une demande de reprise et la réponse du serveur. */
  let rejoining = false;
  const audioHandlers = new Set<(audioUrl: string) => void>();

  const store = (s: StoredSession | null) => {
    try {
      if (s) deps.storage?.setItem(STORAGE_KEY, JSON.stringify(s));
      else deps.storage?.removeItem(STORAGE_KEY);
    } catch {
      // Stockage indisponible (navigation privée) : la reprise après rechargement sera perdue.
    }
  };

  const readStored = (): StoredSession | null => {
    try {
      const raw = deps.storage?.getItem(STORAGE_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw) as Partial<StoredSession>;
      return (s.role === "host" || s.role === "player") && typeof s.code === "string" && typeof s.token === "string"
        ? { role: s.role, code: s.code, token: s.token }
        : null;
    } catch {
      return null;
    }
  };

  const rawSend = (message: ClientMessage) => socket?.send(JSON.stringify(message));

  function open() {
    if (socket && (socket.readyState === 0 || socket.readyState === OPEN)) return;
    clearTimeout(retryTimer);
    intentional = false;
    state.status = state.status === "reconnecting" ? "reconnecting" : "connecting";
    const s = deps.createSocket(deps.url());
    socket = s;

    s.onopen = () => {
      if (socket !== s) return;
      retries = 0;
      state.status = "open";
      if (state.session) {
        rejoining = true;
        const { role, code, token } = state.session;
        rawSend(role === "host" ? { type: "host:rejoin", code, token } : { type: "player:rejoin", code, token });
      }
      const pending = queue;
      queue = [];
      for (const m of pending) rawSend(m);
    };

    s.onmessage = (event) => {
      if (socket !== s || typeof event.data !== "string") return;
      let message: ServerMessage;
      try {
        message = JSON.parse(event.data) as ServerMessage;
      } catch {
        return;
      }
      handle(message);
    };

    s.onclose = () => {
      if (socket !== s) return;
      socket = null;
      if (intentional || !state.session) {
        state.status = "idle";
        return;
      }
      state.status = "reconnecting";
      const delay = Math.min(RETRY_MIN_MS * 2 ** retries, RETRY_MAX_MS);
      retries++;
      retryTimer = setTimeout(open, delay);
    };

    s.onerror = () => {
      // Toujours suivi d'un onclose : la reconnexion y est gérée.
    };
  }

  function handle(message: ServerMessage) {
    switch (message.type) {
      case "session": {
        rejoining = false;
        state.session = { role: message.role, code: message.code, token: message.token, playerId: message.playerId };
        state.sessionLost = false;
        store({ role: message.role, code: message.code, token: message.token });
        return;
      }
      case "state":
        state.view = message.view;
        state.you = message.you;
        state.error = null;
        return;
      case "audio:play":
        for (const h of audioHandlers) h(message.audioUrl);
        return;
      case "kicked":
        reset();
        state.kicked = true;
        return;
      case "error":
        if (rejoining && message.code === "room-not-found") {
          reset();
          state.sessionLost = true;
          return;
        }
        rejoining = false;
        state.error = { code: message.code, message: message.message };
        return;
    }
  }

  /** Oublie la session et ferme la connexion sans la rétablir. */
  function reset() {
    intentional = true;
    clearTimeout(retryTimer);
    queue = [];
    rejoining = false;
    store(null);
    state.session = null;
    state.view = null;
    state.you = null;
    state.error = null;
    const s = socket;
    socket = null;
    state.status = "idle";
    s?.close();
  }

  function send(message: ClientMessage) {
    if (socket?.readyState === OPEN) rawSend(message);
    else {
      queue.push(message);
      open();
    }
  }

  return {
    state,

    send,

    /** Crée une salle. L'ancienne session éventuelle est abandonnée. */
    createRoom() {
      reset();
      state.kicked = false;
      state.sessionLost = false;
      send({ type: "host:create" });
    },

    join(code: string, name: string, avatar: number) {
      reset();
      state.kicked = false;
      state.sessionLost = false;
      send({ type: "player:join", code, name, avatar });
    },

    /** Reprend la session mémorisée, s'il y en a une. Renvoie true si une reprise est lancée. */
    resume(): boolean {
      const stored = readStored();
      if (!stored) return false;
      state.session = stored;
      open();
      return true;
    },

    /** À appeler quand l'appareil se réveille : inutile d'attendre le prochain essai. */
    wake() {
      if (state.session && state.status !== "open") {
        retries = 0;
        open();
      }
    },

    /** Quitter la partie volontairement. */
    leave: reset,

    clearError() {
      state.error = null;
    },

    onAudioPlay(handler: (audioUrl: string) => void): () => void {
      audioHandlers.add(handler);
      return () => audioHandlers.delete(handler);
    },
  };
}

export type Connection = ReturnType<typeof createConnection>;

function browserDeps(): ConnectionDeps {
  return {
    url: () => `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`,
    createSocket: (url) => new WebSocket(url) as unknown as SocketLike,
    storage: (() => {
      try {
        return window.localStorage;
      } catch {
        return null;
      }
    })(),
  };
}

let instance: Connection | undefined;
/** Connexion unique de l'application, créée à la première utilisation. */
export const useConnection = (): Connection => (instance ??= createConnection(browserDeps()));

import {
  isUexChatUnread,
  loadUexChatReadState,
  markAllUexChatsRead,
  markUexChatRead,
} from './uexChatReadState';

function createStorage() {
  const values = new Map();
  return {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
    clear: () => values.clear(),
  };
}

beforeEach(() => {
  const storage = createStorage();
  Object.defineProperty(window, 'localStorage', { configurable: true, value: storage });
  window.dispatchEvent = window.dispatchEvent || (() => {});
});

test('marca todos os chats novos em uma única gravação persistida', () => {
  const negotiations = Array.from({ length: 186 }, (_, index) => ({
    hash: `chat-${index}`,
    date_modified: 1_700_000_000 + index,
  }));

  const state = markAllUexChatsRead(negotiations);

  expect(Object.keys(state)).toHaveLength(186);
  expect(loadUexChatReadState()).toEqual(state);
  expect(negotiations.every(negotiation => !isUexChatUnread(negotiation, state))).toBe(true);
});

test('preserva chats existentes e não grava novamente quando já estão vistos', () => {
  const first = { hash: 'chat-1', date_modified: 1_700_000_001 };
  const second = { hash: 'chat-2', date_modified: 1_700_000_002 };
  markUexChatRead(first);
  const before = loadUexChatReadState();

  const after = markAllUexChatsRead([first, second]);

  expect(after['chat-1']).toEqual(before['chat-1']);
  expect(after['chat-2'].readAt).toBe(1_700_000_002);
  expect(isUexChatUnread(second, after)).toBe(false);
});

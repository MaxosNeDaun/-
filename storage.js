import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'registrations.json');

const DEFAULT_DATA = {
  participants: [],
  messageId: null,
  channelId: null,
  title: 'Регистрация участников',
};

function ensureFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(DEFAULT_DATA, null, 2));
  }
}

export function loadData() {
  ensureFile();
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    const data = JSON.parse(raw);
    return { ...DEFAULT_DATA, ...data };
  } catch (err) {
    console.error('Ошибка чтения JSON файла storage:', err.message);
    return DEFAULT_DATA;
  }
}

export function saveData(data) {
  ensureFile();
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

export function addParticipant(userId) {
  const data = loadData();
  if (!data.participants.some(p => p.id === userId)) {
    data.participants.push({ id: userId });
    saveData(data);
    return true;
  }
  return false;
}

export function removeParticipant(userId) {
  const data = loadData();
  const before = data.participants.length;
  data.participants = data.participants.filter(p => p.id !== userId);
  saveData(data);
  return data.participants.length !== before;
}

export function resetParticipants() {
  const data = loadData();
  data.participants = [];
  saveData(data);
}

export function setMessageRef(messageId, channelId, title) {
  const data = loadData();
  data.messageId = messageId;
  data.channelId = channelId;
  if (title) data.title = title;
  saveData(data);
}

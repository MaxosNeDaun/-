import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, 'data', 'registrations.json');

function ensureFile() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ participants: [], messageId: null, channelId: null }, null, 2));
  }
}

export function loadData() {
  ensureFile();
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
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

export function setMessageRef(messageId, channelId) {
  const data = loadData();
  data.messageId = messageId;
  data.channelId = channelId;
  saveData(data);
}

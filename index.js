import baileys, {
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    DisconnectReason
} from '@whiskeysockets/baileys';
import Pino from 'pino';
import fs from 'fs';

const { makeWASocket } = baileys;

const logger = Pino({ level: 'error' });

const startSock = async () => {
    // ... dein Code bleibt gleich ...
};
    version,
    auth: state,
    logger,
    printQRInTerminal: true,
    syncFullHistory: false,
    downloadHistory: false,
    emitOwnEvents: false,
    generateHighQualityLinkPreview: false,
    getMessage: async () => ({
      conversation: 'No history'
    })
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect?.error instanceof Boom)
        ? lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut
        : true;
      console.log('❌ Verbindung getrennt:', lastDisconnect?.error?.output?.statusCode);
      if (shouldReconnect) startSock();
    } else if (connection === 'open') {
      console.log('✅ DoubleCheckerWA ist verbunden!');
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    const msg = messages[0];
    if (!msg.message || !msg.key.remoteJid) return;
    const from = msg.key.remoteJid;
    const isPrivate = from.endsWith('@s.whatsapp.net');

    if (isPrivate && msg.message?.conversation === '!check') {
      try {
        const allGroups = await sock.groupFetchAllParticipating();
        const relevantGroups = Object.values(allGroups).filter(g => g.subject.toLowerCase().includes('gefahren'));

        const userMap = new Map();
        for (const group of relevantGroups) {
          const metadata = await sock.groupMetadata(group.id);
          metadata.participants.forEach(p => {
            const id = p.id;
            userMap.set(id, (userMap.get(id) || 0) + 1);
          });
        }

        const dupes = [...userMap.entries()]
          .filter(([_, count]) => count > 1)
          .map(([id]) => id);

        const resultText = dupes.length
          ? `👥 Diese Nummern sind in mehreren 'Gefahren'-Gruppen:\n\n${dupes.join('\n')}`
          : '✅ Keine Überschneidungen gefunden.';

        await sock.sendMessage(from, { text: resultText });
      } catch (err) {
        console.error('Fehler beim Prüfen:', err);
        await sock.sendMessage(from, { text: '❌ Fehler beim Überprüfen der Gruppen.' });
      }
    }
  });
};

startSock();

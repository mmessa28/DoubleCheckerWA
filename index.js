const {
  makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
} = require("@whiskeysockets/baileys");
const { Boom } = require("@hapi/boom");
const qrcode = require("qrcode-terminal");
const fs = require("fs");

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("auth_info_doublechecker");
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    auth: state,
    version,
    browser: ["DoubleCheckerWA", "Chrome", "1.0"],
    getMessage: async () => undefined,
    markOnlineOnConnect: false,
    syncFullHistory: false,
    msgRetryCounterCache: {},
    generateHighQualityLinkPreview: false,
  });

  sock.ev.on("creds.update", saveCreds);

  // QR-Code im Terminal anzeigen
  sock.ev.on("connection.update", ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      qrcode.generate(qr, { small: true });
      console.log("📱 Scan den QR-Code mit WhatsApp!");
    }

    if (connection === "open") {
      console.log("✅ DoubleCheckerWA ist verbunden!");
    } else if (connection === "close") {
      const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
      console.log("❌ Verbindung getrennt:", reason);
      if (reason !== DisconnectReason.loggedOut) startBot();
    }
  });

  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.remoteJid !== msg.key.participant) return;

    const sender = msg.key.remoteJid;
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";

    if (text.toLowerCase() === "!check") {
      const groups = await sock.groupFetchAllParticipating();
      const relevantGroups = Object.values(groups).filter(group =>
        group.subject.includes("Gefahren")
      );

      const userMap = {};
      for (const group of relevantGroups) {
        for (const participant of group.participants) {
          userMap[participant.id] = (userMap[participant.id] || 0) + 1;
        }
      }

      const mehrfachUser = Object.entries(userMap)
        .filter(([_, count]) => count > 1)
        .map(([id]) => id)
        .join("\n");

      await sock.sendMessage(sender, {
        text: mehrfachUser
          ? `👥 Diese User sind in mehreren 'Gefahren'-Gruppen:\n${mehrfachUser}`
          : "✅ Keine doppelten User gefunden.",
      });
    }
  });

  setInterval(() => console.log("✅ DoubleCheckerWA läuft noch..."), 10000);
}

startBot();

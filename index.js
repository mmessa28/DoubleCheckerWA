const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');

const client = new Client({
    authStrategy: new LocalAuth()
});

let warnedUsers = {};
const badWords = ['idiot', 'fuck', 'bastard']; // „hurensohn“ entfernt für Plattform-Kompatibilität
const groupLinkRegex = /chat\.whatsapp\.com\/[A-Za-z0-9]+/;

client.on('qr', qr => {
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('✅ DoubleCheckerWA ist aktiv!');
});

// GRUPPENMODERATION
client.on('message_create', async msg => {
    if (!msg.fromMe && msg.type === 'chat') {
        const chat = await msg.getChat();
        if (!chat.isGroup) return;

        const user = msg.author || msg.from;
        const content = msg.body.toLowerCase();
        const mentions = [await msg.getContact()];

        // Fremdwerbung
        if (groupLinkRegex.test(content)) {
            await msg.delete(true);
            await chat.removeParticipants([user]);
            await chat.sendMessage(`🚫 @${user.split('@')[0]} wurde wegen Fremdwerbung entfernt.`, { mentions });
            return;
        }

        // Doppelte Nachricht
        const messages = await chat.fetchMessages({ limit: 5 });
        const same = messages.filter(m => m.body === msg.body && m.from === msg.from);
        if (same.length > 1) {
            if (!warnedUsers[user]) {
                warnedUsers[user] = true;
                await chat.sendMessage(`⚠️ @${user.split('@')[0]}, bitte keine doppelten Nachrichten.`, { mentions });
            } else {
                await msg.delete(true);
                await chat.removeParticipants([user]);
                await chat.sendMessage(`🚫 @${user.split('@')[0]} wurde wegen Spam entfernt.`, { mentions });
            }
            return;
        }

        // Beleidigungen
        if (badWords.some(w => content.includes(w))) {
            await msg.delete(true);
            await chat.removeParticipants([user]);
            await chat.sendMessage(`🚫 @${user.split('@')[0]} wurde wegen Beleidigung entfernt.`, { mentions });
        }
    }
});

// DOPPELTE MITGLIEDER-CHECK PER !check
client.on('message', async msg => {
    if (msg.body.toLowerCase() === '!check' && msg.fromMe) {
        const chats = await client.getChats();
        const gefahrenGruppen = chats.filter(c => c.isGroup && c.name.toLowerCase().includes('gefahren'));
        const mitgliederMap = {};

        for (const gruppe of gefahrenGruppen) {
            const participants = gruppe.participants.map(p => p.id._serialized);
            for (const id of participants) {
                mitgliederMap[id] = mitgliederMap[id] ? [...mitgliederMap[id], gruppe.name] : [gruppe.name];
            }
        }

        const doppelte = Object.entries(mitgliederMap).filter(([_, gruppen]) => gruppen.length > 1);

        if (doppelte.length === 0) {
            await msg.reply('✅ Es gibt aktuell keine Nutzer, die in mehreren "Gefahren"-Gruppen sind.');
        } else {
            let text = '🚨 Nutzer in mehreren "Gefahren"-Gruppen:\n\n';
            for (const [id, gruppen] of doppelte) {
                text += `• ${id.split('@')[0]} → ${gruppen.join(', ')}\n`;
            }
            await msg.reply(text);
        }
    }
});

client.initialize();

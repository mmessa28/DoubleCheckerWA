const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { args: ['--no-sandbox'], headless: true }
});

client.on('qr', qr => {
    qrcode.generate(qr, { small: true });
});

client.on('ready', async () => {
    console.log('✅ DoubleCheckerWA ist aktiv und bereit!');
});

client.on('message', async msg => {
    if (msg.body === '!check' && msg.fromMe) {
        const chats = await client.getChats();
        const gefahrenGruppen = chats.filter(c => c.isGroup && c.name.toLowerCase().includes('gefahren'));

        let userMap = {};
        for (const group of gefahrenGruppen) {
            const participants = group.participants;
            for (const p of participants) {
                if (!userMap[p.id._serialized]) {
                    userMap[p.id._serialized] = { count: 1, groups: [group.name] };
                } else {
                    userMap[p.id._serialized].count += 1;
                    userMap[p.id._serialized].groups.push(group.name);
                }
            }
        }

        const doppelteUser = Object.entries(userMap)
            .filter(([_, data]) => data.count > 1)
            .map(([id, data]) => `👤 *${id.split('@')[0]}*: ${data.count} Gruppen\n➡️ ${data.groups.join(', ')}`);

        if (doppelteUser.length === 0) {
            await msg.reply('✅ Keine doppelten Mitglieder in den "Gefahren"-Gruppen gefunden.');
        } else {
            const chunks = doppelteUser.join('\n\n').match(/(.|[\r\n]){1,3000}/g); // WhatsApp Limit

            for (const chunk of chunks) {
                await msg.reply(`🚨 Doppelte Mitglieder gefunden:\n\n${chunk}`);
            }
        }
    }
});

client.initialize();

client.on('message', async msg => {
    if (msg.fromMe && msg.body === '!check') {
        const chats = await client.getChats();
        const gefahrenGruppen = chats.filter(c => c.isGroup && c.name.toLowerCase().includes('gefahren'));

        let memberMap = {};

        for (const group of gefahrenGruppen) {
            const participants = group.participants.map(p => p.id._serialized);
            for (const id of participants) {
                if (!memberMap[id]) memberMap[id] = [];
                memberMap[id].push(group.name);
            }
        }

        let mehrfachMitglieder = Object.entries(memberMap).filter(([_, gruppen]) => gruppen.length > 1);

        if (mehrfachMitglieder.length === 0) {
            await msg.reply('✅ Niemand ist in mehreren "Gefahren"-Gruppen.');
        } else {
            let text = '⚠️ Diese Mitglieder sind in mehreren "Gefahren"-Gruppen:\n\n';
            for (const [id, gruppen] of mehrfachMitglieder) {
                text += `👤 ${id} → ${gruppen.join(', ')}\n`;
            }
            await msg.reply(text);
        }
    }
});

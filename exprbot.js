const { VK, Keyboard } = require('vk-io');
const { HearManager } = require('@vk-io/hear');
const SteamAPI = require('steamapi');
const SteamID = require('steamid');
const moment = require('moment');
const mysql = require(`mysql-await`);
const fs = require('fs');
var admins = require('./admins.json');
var bans = require('./bans.json');
var cfg = require('./cfg.json');
const msg = new HearManager;
const steam = new SteamAPI(cfg.steamToken);
const pool1 = mysql.createPool(cfg.adminwatchAndBansDB);
const pool2 = mysql.createPool(cfg.gamecmsDB);
const isProd = false;
var admtimer = false;
var vk = isProd ? new VK({ token: cfg.vkTokenProd }) : new VK({ token: cfg.vkTokenDev });

start();

vk.updates.use(async (message, next) => {
    if (message.isGroup || message.isOutbox || !message.isChat || message.is(['chat_kick_user'])) return;
    console.log(`[${await getFirstName(message.senderId)} | ${message.senderId} | ${moment().local().format("DD.MM.YYYY HH:mm")}]:${message.text}`);
    await next();
});
vk.updates.on('message_new', msg.middleware);
vk.updates.on('message_new', (message) => {
    if (message.hasMessagePayload) {
        if (message.messagePayload == 'mystats') getStats(message);
        if (message.messagePayload.event == 'confirmban') confirmBan(message);
        if (message.messagePayload.event == 'rejectban') rejectBan(message);
    }
});

msg.hear(/^!новый\s*([^\s]*)\s*([^\s]*)\s*([^\s]*)\s*(.*)$/i, async (message) => {
    if (!getCurrentAdm(message.senderId).access) return message.send(`⛔ Недостаточно прав для выполнения этого действия`);
    if (!message.$match[4] || isNaN(Number(message.$match[3]))) return message.send(`⚠ Использование: !новый @ссылка [ссылка на стим] [ид пользователя на сайте] [дискорд]`);
    try {
        var sid = await steam.resolve(message.$match[2]);
    } catch {
        return message.send(`⚠ Использование: !новый @ссылка [ссылка на стим] [ид пользователя на сайте] [дискорд]`);
    }
    if (getCurrentAdm(message) != undefined) return message.send(`⚠ Администратор уже занесен в базу данных`);
    admins.push({
        id: Number(message.$match[1].slice(3, message.$match[1].indexOf('|'))),
        uid: admins[admins.length - 1].uid + 1,
        gcmsid: Number(message.$match[3]),
        job: "Хелпер",
        date: moment().format("DD.MM.YYYY"),
        cash: 30,
        vigs: {
            count: 0,
            notes: []
        },
        preds: {
            count: 0,
            notes: []
        },
        bans: 0,
        offbans: 0,
        steamid: sid,
        discord: message.$match[4],
        inactive: "",
        specadm: false,
        verified: false,
        access: false,
        notes: ""
    });
    fs.writeFileSync('./admins.json', JSON.stringify(admins, null, '\t'));
    var currentAdm = admins.find(x => x.id === Number(message.$match[1].slice(3, message.$match[1].indexOf('|'))));
    var sid2 = new SteamID(sid);
    sid2 = sid2.getSteam2RenderedID(true);
    var nick = await getSteamNickname(currentAdm.steamid);
    const connection1 = await pool1.awaitGetConnection();
    const connection2 = await pool2.awaitGetConnection();
    var res = [0, 0, 0, 0, 0];
    var reasons = ["sb_admins", "sb_admins_servers_groups", "gcms admins", "gcms admins__services", "gcms users"];
    var text = ``;
    try {
        await connection1.awaitBeginTransaction();
        await connection2.awaitBeginTransaction();
        await connection1.awaitQuery('SET NAMES utf8');
        await connection2.awaitQuery('SET NAMES utf8');
        var args1 = [nick, sid2, "1fcc1a43dfb4a474abb925f54e65f426e932b59e", 0, "", 0, 87, "Helper", "", null, 0, "", "", ""];
        res[0] = await connection1.awaitQuery('INSERT INTO sb_admins (user,authid,password,gid,email,extraflags,immunity,srv_group,srv_flags,srv_password,expired,skype,comment,vk) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)', args1);
        var last = await connection1.awaitQuery('SELECT * FROM sb_admins ORDER BY aid DESC LIMIT 1');
        var args2 = [last[0].aid, 1, -1, 1];
        res[1] = await connection1.awaitQuery('INSERT INTO sb_admins_servers_groups(admin_id, group_id, srv_group_id, server_id) VALUES (?,?,?,?)', args2);
        var args3 = [sid2, "", "", "ce", 1, message.$match[3]];
        res[2] = await connection2.awaitQuery('INSERT INTO admins (name, pass, pass_md5, type, server, user_id) VALUES (?, ?, ?, ?, ?, ?)', args3);
        var last = await connection2.awaitQuery('SELECT * FROM admins ORDER BY id DESC LIMIT 1');
        var args4 = [last[0].id, 4, 52, moment().format("YYYY-MM-DD HH:mm:ss"), "0000-00-00 00:00:00", 0, 0];
        res[3] = await connection2.awaitQuery('INSERT INTO admins__services (admin_id, service, service_time, bought_date, ending_date, irretrievable, previous_group) VALUES (?, ?, ?, ?, ?, ?, ?)', args4);
        res[4] = await connection2.awaitQuery('UPDATE users SET rights = 18 WHERE id = ? LIMIT 1', message.$match[3]);
        await connection1.awaitCommit();
        await connection2.awaitCommit();
    } catch {
        text = `❌ При добавлении администратора ${nick} произошли ошибки`;
        for (i = 0; i < res.length; i++) {
            text += res[i] ? ` (${reasons[i]} - ${res[i].affectedRows}/1)` : ` (${reasons[i]} - 0/1)`
        };
        await connection1.awaitRollback();
        await connection2.awaitRollback();
    }
    if (text[0] != '❌') text = `✔ Администратор ${nick} успешно добавлен`;
    message.send(text);
    connection1.release();
    connection2.release();
});

msg.hear(/^(?:!команды)$/i, async (message) => {
    if (getCurrentAdm(message.senderId).access) message.send(`📝 Команды для управляющего состава:\n!статус - проверка работоспособности бота\n!команды - выводит список команд\n!админы - список администраторов\n!статистика @ссылка - статистика администратора\n!наказания @ссылка - выводит наказания администратора\n!проверен @ссылка - помечает администратора провереным\n!новый @ссылка [стим] [ид пользователя на сайте] [дискорд] - добавление нового администратора\n!должность @ссылка [должность] - изменение должности\n!неактив @ссылка [кол-во дней] - устанавливает неактив администратору\n!примечание @ссылка [примечание] - устанавливает примечание администратору\n!баллы @ссылка [кол-во] - изменение баллов\n!выговор @ссылка [1-2] [причина] - выдача выговора\n!пред @ссылка [1-2] [причина] - выдача предупреждения\n!снятьвыг @ссылка [1-3] - снятие выговора\n!снятьпред @ссылка [1-2] - снятие предупреждения\n!снять @ссылка - снятие администратора\n!оффбан [стим] [срок в минутах] [причина] - отправка запроса на бан нарушителя\n`);
    else message.send(`📝 Команды для администраторов:\n!статус - проверка работоспособности бота\n!команды - выводит список команд\n!админы - выводит список администраторов\n!статистика @ссылка - статистика администратора\n!наказания @ссылка - выводит наказания администратора\n!оффбан [стим] [срок в минутах] [причина] - отправка запроса на бан нарушителя\n!снятьвыг @ссылка [1-3] - снятие выговора\n!снятьпред @ссылка [1-2] - снятие предупреждения`);
});

msg.hear(/^(?:!админы)$/i, async (message) => {
    cfg.startTime = + new Date;
    if (!getCurrentAdm(message.senderId).access && admtimer == true) return message.send(`⚠ Следующее использование команды доступно через ${moment.utc(moment.duration(cfg.endTime - cfg.startTime).asMilliseconds()).format('HH:mm:ss')}`);
    var admSteamIds = [];
    var sozdatel = zam = kurator = administrator = moderator = helper = "";
    for (var i = 0; i < admins.length; i++) {
        admSteamIds[i] = admins[i].steamid;
    }
    var admData = await steam.getUserSummary(admSteamIds);
    for (var i = 0; i < admins.length; i++) {
        var verif = admins[i].verified ? "✔" : "🚨";
        var currentAdmData = admData.find(x => admins[i].steamid == x.steamID);
        var nick = admins[i].uid == 4 ? currentAdmData.nickname.replaceAll("$", "") : currentAdmData.nickname;
        switch (admins[i].job) {
            case "Администратор": administrator += `[ ${verif} ${admins[i].job} - [id${admins[i].id}|${nick}] ]  [ ${admins[i].vigs.count}/3 ] [ ${admins[i].preds.count}/3 ] [ ${admins[i].cash} ]\n`; break;
            case "Модератор": moderator += `[ ${verif} ${admins[i].job} - [id${admins[i].id}|${nick}] ]  [ ${admins[i].vigs.count}/3 ] [ ${admins[i].preds.count}/3 ] [ ${admins[i].cash} ]\n`; break;
            case "Хелпер": helper += `[ ${verif} ${admins[i].job} - [id${admins[i].id}|${nick}] ]  [ ${admins[i].vigs.count}/3 ] [ ${admins[i].preds.count}/3 ] [ ${admins[i].cash} ]\n`; break;
            case "Куратор": kurator += `[ ${verif} ${admins[i].job} - [id${admins[i].id}|${nick}] ]  [ ${admins[i].vigs.count}/3 ] [ ${admins[i].preds.count}/3 ] [ ${admins[i].cash} ]\n`; break;
            case "Создатель": sozdatel += `[ ${verif} ${admins[i].job} - [id${admins[i].id}|${nick}] ]  [ ${admins[i].vigs.count}/3 ] [ ${admins[i].preds.count}/3 ] [ ${admins[i].cash} ]\n`; break;
            case "Заместитель создателя": zam += `[ ${verif} ${admins[i].job} - [id${admins[i].id}|${nick}] ]  [ ${admins[i].vigs.count}/3 ] [ ${admins[i].preds.count}/3 ] [ ${admins[i].cash} ]\n`; break;
        }
    }
    message.send({
        message: `📝 Список администраторов:\n` + sozdatel + zam + kurator + administrator + moderator + helper + `💾 Всего администраторов - ${admins.length}`,
        disable_mentions: 1
    });
    cfg.startTime = + new Date;
    cfg.endTime = cfg.startTime + 7200000;
    admtimer = true;
    setTimeout(() => admtimer = false, 72000000);
    fs.writeFileSync('./cfg.json', JSON.stringify(cfg, null, '\t'));
});

msg.hear(/^(?:!статистика)\s*(.*)$/i, async (message) => {
    await getStats(message);
});

msg.hear(/^(?:!наказания)\s*(.*)$/i, async (message) => {
    if (getCurrentAdm(message) == undefined) return message.send(`⚠ Администратора нет в базе данных`);
    if (currentAdm.vigs.notes[0] == undefined && currentAdm.preds.notes[0] == undefined) return message.send(`✔ У администратора ${await getSteamNickname(currentAdm.steamid)} нет наказаний`)
    text = `📝 Наказания администратора ${await getSteamNickname(currentAdm.steamid)}:\n`;
    var i = 0;
    if (currentAdm.vigs.notes[0] == undefined) text += `⛔ Выговоров нет\n`;
    else {
        text += `⛔ Выговоры:\n`;
        for (var nts of currentAdm.vigs.notes) {
            if (nts == "") continue;
            i++;
            text += `${i}. ${nts}\n`;
        }
    }
    if (currentAdm.preds.notes[0] == undefined) text += `⚠ Предупреждений нет`;
    else {
        text += `⚠ Предупреждения:\n`
        i = 0;
        for (var nts of currentAdm.preds.notes) {
            if (nts == "") continue;
            i++;
            text += `${i}. ${nts}\n`;
        }
    }
    message.send(text);
});

msg.hear(/^(?:!оффбан)\s*([^\s]*)\s*(\d*)\s*(.*)$/i, async (message) => {
    try {
        var sid64 = await steam.resolve(message.$match[1]);
    } catch {
        return message.send(`⚠ Использование: !оффбан [ссылка на стим] [срок в секундах] [причина]`);
    }
    if (!message.$match[3] || isNaN(Number(message.$match[2]))) return message.send(`⚠ Использование: !оффбан [стим] [срок в секундах] [причина]`);
    getCurrentAdm(message.senderId);
    var count = bans[bans.length - 1].id + 1;
    var sid2 = new SteamID(sid64);
    sid2 = sid2.getSteam2RenderedID(true);
    bans.push({
        id: count,
        adminId: currentAdm.uid,
        status: 0,
        steam2id: sid2,
        length: Number(message.$match[2]),
        reason: message.$match[3]
    });
    const builder = Keyboard.builder()
        .textButton({
            label: 'Подтвердить',
            payload: {
                event: 'confirmban',
                id: count
            },
            color: Keyboard.POSITIVE_COLOR
        })
        .textButton({
            label: 'Отклонить',
            payload: {
                event: 'rejectban',
                id: count
            },
            color: Keyboard.NEGATIVE_COLOR
        });
    message.send(`⏳ Оффбан (ID: ${count}) записан. Ожидайте рассмотрения`);
    message.send({
        message: `⚠ Заявка на оффбан (ID: ${count}) от ${await getSteamNickname(currentAdm.steamid)}:\nНик: ${await getSteamNickname(sid64)}\nСрок: ${message.$match[2]}\nПричина: ${message.$match[3]}\n[id190628413|Максим]`,
        keyboard: builder.inline(),
        chat_id: cfg.headAdminsChatId
    });
    fs.writeFileSync('./bans.json', JSON.stringify(bans, null, '\t'));;
});

msg.hear(/^(?:!должность)\s*([^\s]*)\s*(.*)$/i, async (message) => {
    if (!getCurrentAdm(message.senderId).access) return message.send(`⛔ Недостаточно прав для выполнения этого действия`);
    if (!message.$match[2] && !message.hasReplyMessage) return message.send(`⚠ Использование: !должность @ссылка [должность] или ответ на сообщение командой !должность [должность]`);
    if (getCurrentAdm(message) == undefined) return message.send(`⚠ Администратора нет в базе данных`);
    currentAdm.job = message.$match[1].substring(0, 3) == '[id' ? message.$match[2] : message.$match[1] + ' ' + message.$match[2];
    message.send(`💼 Должность администратора ${await getSteamNickname(currentAdm.steamid)} изменена на ${currentAdm.job}`);
    fs.writeFileSync('./admins.json', JSON.stringify(admins, null, '\t'));
});

msg.hear(/^(?:!проверен)\s*(.*)$/i, async (message) => {
    if (!getCurrentAdm(message.senderId).access) return message.send(`⛔ Недостаточно прав для выполнения этого действия`);
    if (!message.$match[1] && !message.hasReplyMessage) return message.send(`⚠ Использование: !проверен @ссылка или ответ на сообщение командой !неактив`);
    if (getCurrentAdm(message) == undefined) return message.send(`⚠ Администратора нет в базе данных`);
    currentAdm.verified = true;
    message.send(`✔ Администратор ${await getSteamNickname(currentAdm.steamid)} проверен`);
    fs.writeFileSync('./admins.json', JSON.stringify(admins, null, '\t'));
});

msg.hear(/^(?:!неактив)\s*([^\s]*)\s*([\d\s]*)$/i, async (message) => {
    if (!getCurrentAdm(message.senderId).access) return message.send(`⛔ Недостаточно прав для выполнения этого действия`);
    var days = message.$match[1].substring(0, 3) == '[id' ? message.$match[2] : message.$match[1];
    if (!message.$match[2] && !message.hasReplyMessage || isNaN(Number(days))) return message.send(`⚠ Использование: !неактив @ссылка [кол-во дней] или ответ на сообщение командой !неактив [кол-во дней]`);
    if (getCurrentAdm(message) == undefined) return message.send(`⚠ Администратора нет в базе данных`);
    currentAdm.inactive = moment().add(days, 'days').format("DD.MM.YYYY");
    message.send(`🔜 Администратор ${await getSteamNickname(currentAdm.steamid)} ушел в неактив до ${currentAdm.inactive}`);
    fs.writeFileSync('./admins.json', JSON.stringify(admins, null, '\t'));
});

msg.hear(/^(?:!примечание)\s*([^\s]*)\s*(.*)$/i, async (message) => {
    if (!getCurrentAdm(message.senderId).access) return message.send(`⛔ Недостаточно прав для выполнения этого действия`);
    if (!message.$match[2] && !message.hasReplyMessage) return message.send(`⚠ Использование: !примечание @ссылка [примечание] или ответ на сообщение командой !примечание [примечание]`);
    if (getCurrentAdm(message) == undefined) return message.send(`⚠ Администратора нет в базе данных`);
    currentAdm.notes = message.$match[1].substring(0, 3) == '[id' ? message.$match[2] : message.$match[1] + ' ' + message.$match[2];
    message.send(`📒 Изменено примечание администратору ${await getSteamNickname(currentAdm.steamid)}: ${currentAdm.notes}`);
    fs.writeFileSync('./admins.json', JSON.stringify(admins, null, '\t'));
});

msg.hear(/^(?:!баллы)\s*([^\s]*)\s*([-\d]*)$/i, async (message) => {
    if (!getCurrentAdm(message.senderId).access) return message.send(`⛔ Недостаточно прав для выполнения этого действия`);
    var value = message.$match[1].substring(0, 3) == '[id' ? Number(message.$match[2]) : Number(message.$match[1]);
    if (!message.$match[2] && !message.hasReplyMessage || isNaN(Number(value))) return message.send(`⚠ Использование: !баллы @ссылка [кол-во баллов] или ответ на сообщение командой !баллы [кол-во баллов]`);
    if (getCurrentAdm(message) == undefined) return message.send(`⚠ Администратора нет в базе данных`);
    message.send(`✔ Количество баллов у администратора ${await getSteamNickname(currentAdm.steamid)}:\nБыло: ${currentAdm.cash}\nСтало: ${currentAdm.cash += value}`);
    fs.writeFileSync('./admins.json', JSON.stringify(admins, null, '\t'));
});

msg.hear(/^(?:!выговор)\s*([^\s]*)\s*([\d]*)\s*(.*)$/i, async (message) => {
    if (!getCurrentAdm(message.senderId).access) return message.send(`⛔ Недостаточно прав для выполнения этого действия`);
    var value = message.$match[1].substring(0, 3) == '[id' ? Number(message.$match[2]) : Number(message.$match[1]);
    if (!message.$match[3] && !message.hasReplyMessage || isNaN(Number(value)) || value >= 3) return message.send(`⚠ Использование: !выговор @ссылка [1-2] [примечание] или ответ на сообщение командой !выговор [1-2] [примечание]`);
    if (getCurrentAdm(message) == undefined) return message.send(`⚠ Администратора нет в базе данных`);
    if (currentAdm.vigs.count + value >= 4) return message.send(`⚠ Вы не можете выдать администратору больше 3 выговоров`);
    var reason = message.$match[1].substring(0, 3) == '[id' ? message.$match[3] : message.$match[2];
    var today = moment().format("DD.MM.YYYY");
    var text = value == 1 ? 'выдан выговор' : `выдано 2 выговора`;
    for (var i = 0; i < value; i++) {
        currentAdm.vigs.notes.unshift(reason + ` (${today})`);
        currentAdm.vigs.count++;
    }
    message.send(`⛔ Администратору ${await getSteamNickname(currentAdm.steamid)} ${text} c причиной: ${reason}`);
    if (currentAdm.vigs.count == 3) message.send(`⚠ У администратора ${await getSteamNickname(currentAdm.steamid)} 3 выговора`);
    fs.writeFileSync('./admins.json', JSON.stringify(admins, null, '\t'));
});

msg.hear(/^(?:!пред)\s*([^\s]*)\s*([\d]*)\s*(.*)$/i, async (message) => {
    if (!getCurrentAdm(message.senderId).access) return message.send(`⛔ Недостаточно прав для выполнения этого действия`);
    var value = message.$match[1].substring(0, 3) == '[id' ? Number(message.$match[2]) : Number(message.$match[1]);
    if (!message.$match[3] && !message.hasReplyMessage || isNaN(value) || value >= 3) return message.send(`⚠ Использование: !пред @ссылка [1-2] [причина] или ответ на сообщение командой !пред [1-2] [причина]`);
    if (getCurrentAdm(message) == undefined) return message.send(`⚠ Администратора нет в базе данных`);
    if (currentAdm.vigs.count == 2 && currentAdm.preds.count + value >= 4) return message.send(`⚠ Вы не можете выдать администратору больше 3 выговоров`);
    var reason = message.$match[1].substring(0, 3) == '[id' ? message.$match[3] : message.$match[2];
    var today = moment().format("DD.MM.YYYY");
    var text = value == 1 ? 'предупреждение' : `2 предупреждения`;
    for (var i = 0; i < value; i++) {
        currentAdm.preds.notes.unshift(reason + ` (${today})`);
        currentAdm.preds.count++;
    }
    message.send(`⚠ Администратору ${await getSteamNickname(currentAdm.steamid)} ${text} с причиной: ${reason}`);
    if (currentAdm.preds.count >= 3) {
        for (var i = 0; i < 3; i++) {
            currentAdm.preds.notes[--currentAdm.preds.count] += " (перенесено в выговор)";
        }
        currentAdm.vigs.notes.unshift(`За 3 предупреждения (${today})`);
        currentAdm.vigs.count++;
        message.send(`⛔ Администратору ${await getSteamNickname(currentAdm.steamid)} выдан выговор за 3 предупреждения`);
    }
    if (currentAdm.vigs.count == 3) message.send(`⚠ У администратора ${await getSteamNickname(currentAdm.steamid)} 3 выговора`);
    fs.writeFileSync('./admins.json', JSON.stringify(admins, null, '\t'));
});

msg.hear(/^(?:!снятьвыг)\s*([^\s]*)\s*(.*)$/i, async (message) => {
    var value = message.$match[1].substring(0, 3) == '[id' ? Number(message.$match[2]) : Number(message.$match[1]);
    if (isNaN(Number(value))) return message.send(`⚠ Использование: !снятьвыг @ссылка [1-3] или ответ на сообщение командой !снятьвыг [1-3]`);
    if (!getCurrentAdm(message.senderId).access && currentAdm.id != message.senderId) return message.send("⛔ Вы не можете снять выговор другому администратору");
    if (getCurrentAdm(message) == undefined) return message.send(`⚠ Администратора нет в базе данных`);
    if (currentAdm.vigs.count < value) return message.send(`⚠ Вы не можете снять больше выговоров, чем есть`);
    if (currentAdm.cash < 200 * value) return message.send(`⚠ У администратора ${await getSteamNickname(currentAdm.steamid)} недостаточно баллов для снятия наказания`);
    var today = moment().format("DD.MM.YYYY");
    var text = value == 1 ? 'снят выговор' : `снято ${value} выговора`;
    for (var i = 0; i < value; i++) {
        currentAdm.cash -= 200;
        currentAdm.vigs.notes[--currentAdm.vigs.count] += ` (снят ${today})`;
    }
    message.send(`✔ Администратору ${await getSteamNickname(currentAdm.steamid)} ${text}. Остаток ${currentAdm.cash} баллов`);
    fs.writeFileSync('./admins.json', JSON.stringify(admins, null, '\t'));
});

msg.hear(/^(?:!снятьпред)\s*([^\s]*)\s*(.*)$/i, async (message) => {
    var value = message.$match[1].substring(0, 3) == '[id' ? Number(message.$match[2]) : Number(message.$match[1]);
    if (isNaN(Number(value))) return message.send(`⚠ Использование: !снятьпред @ссылка [1-2] или ответ на сообщение командой !снятьпред [1-2]`);
    if (!getCurrentAdm(message.senderId).access && currentAdm.id != message.senderId) return message.send("⛔ Вы не можете снять предупреждение другому администратору");
    if (getCurrentAdm(message) == undefined) return message.send(`⚠ Администратора нет в базе данных`);
    if (currentAdm.preds.count < value) return message.send(`⚠ Вы не можете снять больше предупреждений админстратору, чем у него есть`);
    if (currentAdm.cash < 120 * value) return message.send(`⚠ У администратора ${await getSteamNickname(currentAdm.steamid)} недостаточно баллов для снятия наказания`);
    var today = moment().format("DD.MM.YYYY");
    var text = value == 1 ? 'предупреждение' : `${value} предупреждения`;
    for (var i = 0; i < value; i++) {
        currentAdm.cash -= 120;
        currentAdm.preds.notes[--currentAdm.preds.count] += ` (снято ${today})`;
    }
    message.send(`✔ Администратору ${await getSteamNickname(currentAdm.steamid)} снято ${text}. Остаток ${currentAdm.cash} баллов`);
    fs.writeFileSync('./admins.json', JSON.stringify(admins, null, '\t'));
});

msg.hear(/^(?:!снять)\s*(.*)$/i, async (message) => {
    if (!getCurrentAdm(message.senderId).access) return message.send(`⛔ Недостаточно прав для выполнения этого действия`);
    if (!message.$match[1] && !message.hasReplyMessage) return message.send(`⚠ Использование: !снять @ссылка или ответ на сообщение командой !снять`);
    if (getCurrentAdm(message) == undefined) return message.send(`⚠ Администратора нет в базе данных`);
    var text = ``;
    var res = [0, 0, 0, 0, 0, 0, 0, 0];
    var reasons = ["sb_admins", "sb_admins_servers_groups", "adminwatch", "gcms admins", "gcms admins__services", "gcms users", "json", "chat"];
    var nick = await getSteamNickname(currentAdm.steamid);
    var sid2 = new SteamID(currentAdm.steamid);
    sid2 = sid2.getSteam2RenderedID().slice(10);
    const connection1 = await pool1.awaitGetConnection();
    const connection2 = await pool2.awaitGetConnection();
    try {
        await connection1.awaitBeginTransaction();
        await connection2.awaitBeginTransaction();
        var admData = await connection1.awaitQuery('SELECT * FROM sb_admins WHERE authid LIKE \'%?%\'', Number(sid2));
        res[0] = await connection1.awaitQuery('DELETE FROM sb_admins WHERE authid LIKE \'%?%\'', Number(sid2));
        if (admData.length != 0) res[1] = await connection1.awaitQuery('DELETE FROM sb_admins_servers_groups WHERE admin_id = ?', admData[0].aid);
        res[2] = await connection1.awaitQuery('DELETE FROM adminwatch WHERE steam LIKE \'%?%\'', Number(sid2));
        var admData = await connection2.awaitQuery('SELECT * FROM admins WHERE name LIKE \'%?%\'', Number(sid2));
        res[3] = await connection2.awaitQuery('DELETE FROM admins WHERE name LIKE \'%?%\'', Number(sid2));
        if (admData.length != 0) res[4] = await connection2.awaitQuery('DELETE FROM admins__services WHERE admin_id = ?', admData[0].id);
        res[5] = await connection2.awaitQuery('UPDATE users SET rights = 25 WHERE id = ? LIMIT 1', currentAdm.gcmsid);
        res[6] = currentAdm.uid == admins.splice(admins.indexOf(currentAdm), 1)[0].uid ? res[6] = 1 : res[6] = 0;
        await connection1.awaitCommit();
        await connection2.awaitCommit();
    } catch { }
    connection1.release();
    connection2.release();
    try {
        await vk.api.messages.removeChatUser({
            chat_id: cfg.adminsChatId,
            user_id: currentAdm.id
        });
        res[7] = 1;
    } catch { }
    if (res[0].affectedRows == 0 || res[1].affectedRows == 0 || res[2].affectedRows == 0 || res[3].affectedRows == 0 || res[4].affectedRows == 0 || res[5].affectedRows == 0 || res[6] == 0 || res[7] == 0) {
        text = `❌ При удалении администратора ${nick} произошли ошибки:`;
        for (i = 0; i < res.length - 2; i++) {
            try {
                text += res[i].affectedRows ? ` (${reasons[i]} - ${res[i].affectedRows}/1)` : ` (${reasons[i]} - 0/1)`;
            } catch {
                text += ` (${reasons[i]} - -/1)`;
            }
        }
        text += res[6] ? ` (${reasons[6]} - 1/1)` : ` (${reasons[6]} - 0/1)`;
        text += res[7] ? ` (${reasons[7]} - 1/1)` : ` (${reasons[7]} - 0/1)`;
    } else {
        text = `✔ Администратор ${nick} успешно снят`;
        for (i = 0; i < res.length - 2; i++) {
            try {
                text += res[i].affectedRows ? ` (${reasons[i]} - ${res[i].affectedRows}/1)` : ` (${reasons[i]} - 0/1)`;
            } catch {
                text += ` (${reasons[i]} - -/1)`;
            }
        }
        text += res[6] ? ` (${reasons[6]} - 1/1)` : ` (${reasons[6]} - 0/1)`;
        text += res[7] ? ` (${reasons[7]} - 1/1)` : ` (${reasons[7]} - 0/1)`;
    }
    message.send(text);
    fs.writeFileSync('./admins.json', JSON.stringify(admins, null, '\t'));
});

msg.hear(/^(?:!статус)$/i, async (message) => {
    message.send(`✔ Бот активен`);
});

function start() {
    vk.updates.start();
    console.log("Бот запущен");
    weekResults();
    setInterval(() => weekResults(), 3600000);
}

function getCurrentAdm(arg) {
    if (arg.id != undefined) {
        if (arg.$match != undefined) if (arg.$match[1].substring(0, 3) == '[id' && !arg.hasReplyMessage) return currentAdm = admins.find(x => x.id === Number(arg.$match[1].slice(3, arg.$match[1].indexOf('|'))));
        if (arg.hasReplyMessage) return currentAdm = admins.find(x => x.id === arg.replyMessage.senderId);
        else return currentAdm = admins.find(x => x.id === arg.senderId);
    }
    if (typeof arg == 'number') return currentAdm = admins.find(x => x.id === arg);
    else return currentAdm = admins.find(x => x.id === Number(arg.slice(3, arg.indexOf('|'))));
}

async function getStats(message) {
    const builder = Keyboard.builder()
        .textButton({
            label: 'Моя статистика',
            payload: 'mystats',
            color: Keyboard.SECONDARY_COLOR
        });
    if (getCurrentAdm(message) == undefined) return message.send(`⚠ Администратора нет в базе данных`);
    var s2id = new SteamID(currentAdm.steamid);
    s2id = s2id.getSteam2RenderedID().slice(10);
    const connection = await pool1.awaitGetConnection();
    var admOnline = await connection.awaitQuery('SELECT * FROM adminwatch WHERE steam LIKE \'%?%\'', Number(s2id));
    connection.release();
    var played = admOnline[0]?.played ?? 0;
    played = moment.utc(played * 1000).format("HH:mm:ss");
    var a = moment(currentAdm.date, "DD-MM-YYYY");
    var b = moment(moment().format("DD-MM-YYYY"), "DD-MM-YYYY");
    var c = moment(currentAdm.inactive, "DD-MM-YYYY");
    var admData = await steam.getUserSummary(currentAdm.steamid);
    var verf = currentAdm.verified ? "✔ Администратор проверен" : "🚨 Администратор не проверен";
    var note = currentAdm.notes == "" || currentAdm.notes == " " ? "📒 Примечаний нет" : `📒 Примечания: ${currentAdm.notes}`;
    var activity = c.diff(b, 'days') > 0 ? `🔜 Неактив до: ${currentAdm.inactive} (${c.diff(b, 'days')} days remained)` : `🖥 Активен`;
    message.send({
        message: `📝 Основная информация об администраторе:\n👤 Имя: [id${currentAdm.id}|${await getFirstName(currentAdm.id)}]\n🌐 Steam: ${admData.nickname} - ${admData.url}\n🎮 Discord: ${currentAdm.discord}\n💼 Должность: ${currentAdm.job}\n📅 Дата назначения: ${currentAdm.date} (${b.diff(a, 'days')} days)\n${verf}\n\n📝 Наказания и баллы\n⛔ Выговоров: [${currentAdm.vigs.count}/3]\n⚠ Предупреждений: [${currentAdm.preds.count}/3]\n💲 Баллов: ${currentAdm.cash}\n🚫 Банов: ${currentAdm.bans}\n\n${activity}\n🕒 Онлайн: ${played}\n${note}`,
        disable_mentions: 1,
        keyboard: builder
    });
}

async function rejectBan(message) {
    if (!getCurrentAdm(message.senderId).access) return message.send(`⛔ Недостаточно прав для выполнения этого действия`);
    var currentBan = bans[message.messagePayload.id - 1];
    if (currentBan.status == 2 || currentBan.status == 1) return message.send(`⚠ Оффбан (ID: ${currentBan.id}) уже обработан`);
    currentBan.status = 2;
    message.send({
        message: `❌ Оффбан (ID: ${currentBan.id}) отклонен`,
        chat_id: cfg.adminsChatId
    });
    fs.writeFileSync('./bans.json', JSON.stringify(bans, null, '\t'));;
}

async function confirmBan(message) {
    if (!getCurrentAdm(message.senderId).access) return message.send(`⛔ Недостаточно прав для выполнения этого действия`);
    var currentBan = bans[message.messagePayload.id - 1];
    if (currentBan.status == 2 || currentBan.status == 1) return message.send(`⚠ Оффбан (ID: ${currentBan.id}) уже обработан`);
    var time = Math.floor(new Date().getTime() / 1000);
    var sid64 = new SteamID(currentBan.steam2id);
    sid64 = sid64.getSteamID64();
    var name = await getSteamNickname(sid64);
    var args = [time, 0, currentBan.steam2id, name, time + currentBan.length * 1000, currentBan.length, currentBan.reason, 0, 'STEAM_ID_SERVER', 1];
    const connection = await pool1.awaitGetConnection();
    await connection.awaitQuery('SET NAMES utf8');
    var res = await connection.awaitQuery('INSERT INTO sb_bans(created, type, authid, name, ends, length, reason, aid, adminIp, sid) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', args);
    connection.release();
    console.log(res);
    var currentAdm = admins.find(x => x.uid === currentBan.adminId);
    currentAdm.offbans++;
    currentAdm.bans++;
    currentBan.status = 1;
    message.send({
        message: `✔ Оффбан (ID: ${currentBan.id}) подтвержден, игрок забанен`,
        chat_id: cfg.adminsChatId
    });
    fs.writeFileSync('./admins.json', JSON.stringify(admins, null, '\t'));
    fs.writeFileSync('./bans.json', JSON.stringify(bans, null, '\t'));
}

async function weekResults() {
    var currentTime = + new Date;
    if (currentTime - cfg.endWeek < 604800000) return;
    console.log(currentTime + " Итоги онлайна");
    var admOnlines = [];
    var bInfo = [];
    var text = `⌚ Итоги онлайна:\n\n`;
    const connection = await pool1.awaitGetConnection();
    var dbOnlines = await connection.awaitQuery('SELECT * FROM adminwatch');
    for (i = 0; i < dbOnlines.length; i++) {
        var admData = dbOnlines[i];
        var sid64 = new SteamID(admData.steam);
        sid64 = sid64.getSteamID64();
        var currentAdm = admins.find(x => x.steamid === sid64);
        if (currentAdm == undefined || currentAdm.specadm) continue;
        admOnlines.push({
            uid: currentAdm.uid,
            played: admData.played
        });
    }
    admOnlines.sort(function (a, b) { return a.played - b.played; });
    admOnlines.reverse();
    for (i = 0; i < admOnlines.length; i++) {
        var currentOnline = admOnlines[i];
        var currentAdm = admins.find(x => x.uid === currentOnline.uid);
        var timeToCash = Math.floor(currentOnline.played / 3600) * 5 - 15;
        if (i == 0) {
            text += `🥇 [ [id${currentAdm.id}|${await getSteamNickname(currentAdm.steamid)}] ] [ ${moment.utc(currentOnline.played * 1000).format("HH:mm:ss")} ] [ ${timeToCash} баллов ]\n`;
            if (currentOnline.played * 1000 >= 18000000) {
                text += `Приз - VIP на 7 дней + 70 баллов\n`;
                currentAdm.cash += 70;
            }
        } else if (i == 1) {
            text += `🥈 [ [id${currentAdm.id}|${await getSteamNickname(currentAdm.steamid)}] ] [ ${moment.utc(currentOnline.played * 1000).format("HH:mm:ss")} ] [ ${timeToCash} баллов ]\n`;
            if (currentOnline.played * 1000 >= 18000000) {
                text += `Приз - VIP на 3 дня + 50 баллов\n`;
                currentAdm.cash += 50;
            }
        } else if (i == 2) {
            text += `🥉 [ [id${currentAdm.id}|${await getSteamNickname(currentAdm.steamid)}] ] [ ${moment.utc(currentOnline.played * 1000).format("HH:mm:ss")} ] [ ${timeToCash} баллов ]\n`;
            if (currentOnline.played * 1000 >= 18000000) {
                text += `Приз - VIP на 1 день + 30 баллов\n`;
                currentAdm.cash += 30;
            }
        } else if ((timeToCash + 15) / 5 < 3) {
            text += `❗ [ [id${currentAdm.id}|${await getSteamNickname(currentAdm.steamid)}] ] [ ${moment.utc(currentOnline.played * 1000).format("HH:mm:ss")} ] [ ${timeToCash} баллов ]\n`;
        } else {
            text += `✔ [id${currentAdm.id}|${await getSteamNickname(currentAdm.steamid)}] ] [ ${moment.utc(currentOnline.played * 1000).format("HH:mm:ss")} ] [ ${timeToCash} баллов ]\n`;
        }
        currentAdm.cash += timeToCash;
    }
    text += `\n🚫 Баны:\n\n`
    var dbans = await connection.awaitQuery('SELECT * FROM sb_bans WHERE created > ?', Math.floor(cfg.endWeek / 1000));
    for (i = 0; i < dbans.length; i++) {
        try {
            var sid64 = new SteamID(dbans[i].adminIp);
        } catch {
            continue;
        }
        sid64 = sid64.getSteamID64();
        var currentAdm = admins.find(x => x.steamid === sid64);
        if (currentAdm != undefined && !bInfo.find(x => x.uid === currentAdm.uid)) {
            bInfo.push({
                uid: currentAdm.uid,
                count: 1
            });
        } else if (currentAdm != undefined && bInfo.find(x => x.uid === currentAdm.uid)) {
            var currentbInfo = bInfo.find(x => x.uid === currentAdm.uid);
            currentbInfo.count++;
        };
    }
    cfg.endWeek += 604800000;
    bInfo.sort(function (a, b) { return a.count - b.count; });
    bInfo.reverse();
    for (i = 0; i < bInfo.length; i++) {
        var currentAdm = admins.find(x => x.uid === bInfo[i].uid);
        var pcash = Math.round(bInfo[i].count * 2 / 5) * 5;
        currentAdm.cash += pcash;
        currentAdm.bans += bInfo[i].count;
        text += `[ ${await getSteamNickname(currentAdm.steamid)} ] [ ${bInfo[i].count} шт ] [ ${pcash} баллов ]\n`;
    }
    if (admins.filter(x => x.offbans > 0) != 0) {
        text += `\n🚫 Оффбаны:\n\n`;
        for (i = 0; i < admins.length; i++) {
            var currentAdm = admins[i];
            if (currentAdm.offbans == 0) continue;
            currentAdm.cash += currentAdm.offbans * 5;
            text += `[ ${await getSteamNickname(currentAdm.steamid)} ] [ ${currentAdm.offbans} шт ] [ ${currentAdm.offbans * 5} баллов ]\n`;
            currentAdm.offbans = 0;
        }
    } else text += `\n⛔ Оффбанов нет\n\n`;
    if (isProd) {
        var dbans = await connection.awaitQuery('UPDATE adminwatch SET total = 0, played = 0');
        fs.writeFileSync('./admins.json', JSON.stringify(admins, null, '\t'));
    }
    fs.writeFileSync('./cfg.json', JSON.stringify(cfg, null, '\t'));
    connection.release();
    text += ('\n⌚ Онлайн сброшен');
    await vk.api.messages.send({
        message: text,
        disable_mentions: 1,
        chat_id: cfg.adminsChatId,
        random_id: Math.floor(Math.random() * 2147483647)
    });
}

async function getSteamNickname(arg) {
    return await steam.getUserSummary(arg).then(summary => { return summary.nickname; });
}

async function getFirstName(arg) {
    return await vk.api.users.get({ user_ids: arg }).then(res => { return res[0].first_name });
}
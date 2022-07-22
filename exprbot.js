var http = require('http');

http.get({'host': 'api.ipify.org', 'port': 80, 'path': '/'}, function(resp) {
  resp.on('data', function(ip) {
    console.log("My public IP address is: " + ip);
  });
});
const { VK, API, Keyboard, CallbackService } = require('vk-io');
const { HearManager } = require('@vk-io/hear');
//const { DirectAuthorization, officialAppCredentials } = require('@vk-io/authorization')
const steamAPI1 = require('steamapi');
const SteamID = require('steamid');
const moment = require('moment');
const mysql = require('mysql');
//const callbackService = new CallbackService();
const msg = new HearManager;
const steam = new steamAPI1('15DCDC25DD64BD333FC873C0E6F8268A');
const vk = new VK({
    token: "8aeb54af1586ba010bd7b6a03eb3a47fea9f0a9863179ba0a5126823fd97d8200b8cdaa1d774d0cc8a96a",
    apiMode: "parallel",
    pollingGroupId: 208222538
});
// const direct = new DirectAuthorization({
// 	callbackService,
// 	scope: 'all',
// 	...officialAppCredentials.android, 
// 	login: 79680884805,
// 	password: 'vkgznjy7re35'
// });
const connection = mysql.createConnection({
    host: '46.174.50.7',
    user: 'u29178_admindata',
    password: 'jE8wH6fR3vwB6e',
    database: 'u29178_miraim'
});
connection.connect(function (err) {
    if (!err) {
        console.log("MySQL connected")
    } else {
        console.log("MySQL connection lost");
    }
});
let admins = require('./admins.json');

start('Бот успешно запущен');


// async function run() {
// 	const response = await direct.run();
// 	console.log('Token:', response.token);
// 	console.log('Expires:', response.expires);
// 	console.log('Email:', response.email);
// 	console.log('User ID:', response.user);
// }

// run().catch(console.error);


vk.updates.use(async (context, next) => {
    if (!context.senderId && context.isGroup && context.is('message') && context.isOutbox && !context.isChat)
        return;
    console.log(`[${await getFirstName(context.senderId)}]:${context.text}`);
    await next();
});

vk.updates.on('message', msg.middleware);
vk.updates.on('message_new', (message) => {
    const { messagePayload } = message;
    message.state.command = messagePayload && messagePayload.command ? messagePayload.command : null;
});

msg.hear(/^(?:!новый)\s+([^\s]+)\s+([^\s]+)\s(.+)$/i, async (message) => {
    if (!admins.find(x => x.id === message.$match[1])) {
        var sid; await steam.resolve(message.$match[2]).then(id => { sid = id; });
        admins.push({
            id: Number(message.$match[1].slice(3, message.$match[1].indexOf('|'))),
            uid: admins.length,
            job: "Хелпер",
            date: moment().format("DD.MM.YYYY"),
            cash: 30,
            "vigs": {
                "count": 0,
                "notes": []
            },
            "preds": {
                "count": 0,
                "notes": []
            },
            steamid: sid,
            discord: message.$match[3],
            inactive: "",
            verified: false,
            access: false,
            notes: ""
        });
        message.send(`✅ Добавлен новый администратор - ${await getSteamNickname(message.$match[1])}`);
        saveAdmins();
    } else message.send(`⚠ Администратор уже занесен в базу данных`);
});
msg.hear(/^(?:!команды)$/i, async (message) => {
    message.admin = admins.find(x => x.id === message.senderId);
    if (message.admin.access) return await message.send(`📝 Команды для управляющего состава:\n!команды - выводит список команд\n!админы - список администраторов\n!статистика @ссылка - статистика администратора\n!наказания @ссылка - выводит наказания администратора\n!проверен @ссылка - помечает администратора провереным\n!новый @ссылка [стим] [дискорд] - добавление нового администратора\n!должность @ссылка [должность] - изменение должности\n!неактив @ссылка [кол-во дней] - устанавливает неактив администратору\n!примечание @ссылка [примечание] - устанавливает примечание администратору\n!баллы @ссылка [кол-во] - изменение баллов\n!выговор @ссылка [кол-во] [причина] - выдача выговора\n!пред @ссылка [кол-во] [причина] - выдача предупреждения\n!снятьвыг @ссылка [кол-во] - снятие выговора\n!снятьпред @ссылка [кол-во] - снятие предупреждения\n!снять @ссылка - снять администратора`);
    else await message.send(`📝 Команды для администраторов:\n!команды - выводит список команд\n!админы - выводит список администраторов\n!статистика @ссылка - статистика администратора\n!наказания @ссылка - выводит наказания администратора`);
});

msg.hear(/^(?:!админы)$/i, async (message) => {
    message.send(`⏳ Команда выполняется, ожидайте...`);
    text = `📝Список админов:\n`;
    for (var i = 0; i <= 2; i++) {
        await adminsList(i, 0);
    }
    for (var i = 3; i <= admins.length - 1; i++) {
        if (!(await adminsList(i, 1))) continue;
    }
    for (var i = 3; i <= admins.length - 1; i++) {
        if (!(await adminsList(i, 2))) continue;
    }
    for (var i = 3; i <= admins.length - 1; i++) {
        if (!(await adminsList(i, 3))) continue;
    }
    for (var i = 3; i <= admins.length - 1; i++) {
        if (!(await adminsList(i, 4))) continue;
    }
    message.send(text);
});

msg.hear(/^(?:!статистика)\s(.+)$/i, async (message) => {
    getCurrentAdm(message.$match[1]);
    /* var online = '';
     getOnline(message.$match[1], function (result) { online = result; online = moment.utc(online * 1000).format("HH:mm:ss"); });
     🕒 Онлайн: ${online}\n
     */
    var a = moment(currentAdm.date, "DD-MM-YYYY");
    var b = moment(moment().format("DD-MM-YYYY"), "DD-MM-YYYY");
    var c = moment(currentAdm.inactive, "DD-MM-YYYY");
    var profile; await steam.getUserSummary(currentAdm.steamid).then(summary => { profile = summary.url; });
    if (currentAdm.verified) var verf = "✅ Администратор проверен"; else var verf = "🚨 Администратор не проверен"
    if (currentAdm.notes == "") var note = "📒 Примечаний нет"; else var note = `📒 Примечания: ${currentAdm.notes}`;
    message.send(`📝 Основая информация о пользователе ⬇\n👤 Имя: [id${currentAdm.id}|${await getFirstName(currentAdm.id)}]\n🌐 Steam: ${await getSteamNickname(message.$match[1])} - ${profile}\n🎮 Discord: ${currentAdm.discord}\n💼 Должность: ${currentAdm.job}\n📅 Дата назначения: ${currentAdm.date} (${b.diff(a, 'days')} days)\n${verf}\n\n📝 Наказания и баллы\n⛔ Выговоров: [${currentAdm.vigs.count}/3]\n⚠ Предупреждений: [${currentAdm.preds.count}/3]\n💲 Баллов: ${currentAdm.cash}\n\n${getActivity(message.$match[1])}\n${note}`);
});

msg.hear(/^(?:!наказания)\s(.+)$/i, async (message) => {
    getCurrentAdm(message.$match[1]);
    if (currentAdm.vigs.notes[0] == undefined && currentAdm.preds.notes[0] == undefined) return message.send(`✅ У администратора ${await getSteamNickname(message.$match[1])} нет наказаний`)
    var i = 0;
    text = `📝 Наказания администратора ${await getSteamNickname(message.$match[1])}:\n`;
    if (currentAdm.vigs.notes[0] == undefined) text += `⛔ Выговоров нет\n`;
    else {
        text += `⛔ Выговоры:\n`;
        for (let nts of currentAdm.vigs.notes) {
            if (nts == "") continue;
            i++;
            text += `${i}. ${nts}\n`;
        }
    }
    if (currentAdm.preds.notes[0] == undefined) text += `⚠ Предупреждений нет`;
    else {
        text += `⚠ Предупреждения:\n`
        i = 0;
        for (let nts of currentAdm.preds.notes) {
            if (nts == "") continue;
            i++;
            text += `${i}. ${nts}\n`;
        }
    }
    message.send(text);
});

msg.hear(/^(?:!оффбан)\s+([^\s]+)\s+(\d+)\s(.+)$/i, async (message) => {

});

msg.hear(/^(?:!должность)\s+([^\s]+)\s+(.+)$/i, async (message) => {
    if (message.senderId == 488624280 || message.senderId == 190628413) {
        getCurrentAdm(message.$match[1]);
        currentAdm.job = message.$match[2];
        message.send(`💼 Должность администратора ${await getSteamNickname(message.$match[1])} изменена на ${message.$match[2]}`);
        saveAdmins();
    } else message.send(`⛔ Недостаточно прав для выполнения этого действия.`);
});

msg.hear(/^(?:!проверен)\s(.+)$/i, async (message) => {
    if (message.senderId == 488624280 || message.senderId == 190628413) {
        getCurrentAdm(message.$match[1]);
        currentAdm.verified = true;
        message.send(`✅ Администратор ${await getSteamNickname(message.$match[1])} проверен.`)
    } else message.send(`⛔ Недостаточно прав для выполнения этого действия.`);
});

msg.hear(/^(?:!неактив)\s(.+)\s([0-9]+)$/i, async (message) => {
    if (message.senderId == 488624280 || message.senderId == 190628413) {
        getCurrentAdm(message.$match[1]);
        currentAdm.inactive = moment().add(message.$match[2], 'days').format("DD.MM.YYYY");
        message.send(`🔜 Администратор ${await getSteamNickname(message.$match[1])} ушел в неактив до ${currentAdm.inactive}`);
        saveAdmins();
    } else message.send(`⛔ Недостаточно прав для выполнения этого действия.`);
});

msg.hear(/^(?:!примечание)\s(.+)\b\s(.+)$/i, async (message) => {
    if (message.senderId == 488624280 || message.senderId == 190628413) {
        getCurrentAdm(message.$match[1]);
        currentAdm.notes = message.$match[2];
        message.send(`📒 Изменено примечание администратору ${await getSteamNickname(message.$match[1])}: ${currentAdm.note}`);
        saveAdmins();
    } else message.send(`⛔ Недостаточно прав для выполнения этого действия.`);
});

msg.hear(/^(?:!баллы)\s(.+)\s([0-9]+)(\s[-])?$/i, async (message) => {
    if (message.senderId == 488624280 || message.senderId == 190628413) {
        var arg2 = Number(message.$match[2]);
        getCurrentAdm(message.$match[1]);
        if (message.$match[3] == ' -') {
            currentAdm.cash -= arg2;
            message.send(`➖ Текущее количество баллов у администратора ${await getSteamNickname(message.$match[1])} - ${currentAdm.cash}. Изначальное количество: ${Number(currentAdm.cash) + arg2}`);
        } else {
            currentAdm.cash += arg2;
            message.send(`➕ Текущее количество баллов у администратора ${await getSteamNickname(message.$match[1])} - ${currentAdm.cash}. Изначальное количество: ${Number(currentAdm.cash) - arg2}`);
        }
        saveAdmins();
    } else message.send(`⛔ Недостаточно прав для выполнения этого действия.`);
});

msg.hear(/^(?:!выговор)\s(.+)\s([12])\s(.+)$/i, async (message) => {
    if (message.senderId == 488624280 || message.senderId == 190628413) {
        let currentAdm = admins.find(x => x.id === Number(message.$match[1].slice(3, message.$match[1].indexOf('|'))));
        if (message.$match[2] == 1) {
            currentAdm.vigs.notes.push(message.$match[3]);
            currentAdm.vigs.count++;
            message.send(`⛔ Администратору ${await getSteamNickname(message.$match[1])} выдан выговор c причиной: ${message.$match[3]}`);
        } else {
            currentAdm.vigs.notes.push(message.$match[3]);
            currentAdm.vigs.count++;
            currentAdm.vigs.notes.push(message.$match[3]);
            currentAdm.vigs.count++;
            message.send(`⛔ Администратору ${await getSteamNickname(message.$match[1])} выдано 2 выговора c причиной: ${message.$match[3]}`);
        }
        saveAdmins();
    } else message.send(`⛔ Недостаточно прав для выполнения этого действия.`);
});

msg.hear(/^(?:!пред)\s(.+)\s([12])\s(.+)$/i, async (message) => {
    if (message.senderId == 488624280 || message.senderId == 190628413) {
        getCurrentAdm(message.$match[1]);
        if (message.$match[2] == 1) {
            currentAdm.preds.notes.push(message.$match[3]);
            currentAdm.preds.count++;
            message.send(`⚠ Администратору ${await getSteamNickname(message.$match[1])} выдано предупреждение с причиной: ${message.$match[3]}`);
        } else {
            currentAdm.preds.notes.push(message.$match[3]);
            currentAdm.preds.count++;
            currentAdm.preds.notes.push(message.$match[3]);
            currentAdm.preds.count++;
            message.send(`⚠ Администратору ${await getSteamNickname(message.$match[1])} выдано 2 предупреждения с причиной: ${message.$match[3]}`);
        }
        if (currentAdm.preds.count == 3) {
            for (var i = 0; i <= 2; i++) {
                currentAdm.preds.notes[currentAdm.preds.count - 1] += " (перенесено в выговор)";
                currentAdm.preds.count--;
            }
            currentAdm.vigs.notes.push("За 3 предупреждения");
            currentAdm.vigs.count++;
            message.send(`⛔ Администратору ${await getSteamNickname(message.$match[1])} выдан выговор за 3 предупреждения`)
        }
        saveAdmins();
    } else message.send(`⛔ Недостаточно прав для выполнения этого действия.`);
});

msg.hear(/^(?:!снятьвыг)\s(.+)\s([123])$/i, async (message) => {
    if (message.senderId == 488624280 || message.senderId == 190628413) {
        getCurrentAdm(message.$match[1]);
        if (message.$match[2] > currentAdm.vigs.count) return message.send(`⚠ Вы не можете снять больше выговоров админстратору, чем у него есть`);
        if (currentAdm.vigs.count == 0) return message.send(`⚠ У администратора ${await getSteamNickname(message.$match[1])} нет выговоров`);
        if (message.$match[2] == 1 && currentAdm.cash >= 200 && currentAdm.vigs.count > 0) {
            currentAdm.cash -= 200;
            currentAdm.vigs.count--;
            currentAdm.vigs.notes[currentAdm.vigs.count] += " (снят)";
            message.send(`✅ Администратору ${await getSteamNickname(message.$match[1])} снят выговор. Остаток ${currentAdm.cash} баллов`);
            saveAdmins();
        } else if (message.$match[2] == 2 && currentAdm.cash >= 400 && currentAdm.vigs.count > 1) {
            currentAdm.cash -= 400;
            currentAdm.vigs.count--;
            currentAdm.vigs.notes[currentAdm.vigs.count] += " (снят)";
            currentAdm.vigs.count--;
            currentAdm.vigs.notes[currentAdm.vigs.count] += " (снят)";
            message.send(`✅ Администратору ${await getSteamNickname(message.$match[1])} снято 2 выговора. Остаток ${currentAdm.cash} баллов`);
            saveAdmins();
        } else if (message.$match[2] == 3 && currentAdm.cash >= 600 && currentAdm.vigs.count > 2) {
            currentAdm.cash -= 600;
            currentAdm.vigs.count--;
            currentAdm.vigs.notes[currentAdm.vigs.count] += " (снят)";
            currentAdm.vigs.count--;
            currentAdm.vigs.notes[currentAdm.vigs.count] += " (снят)";
            currentAdm.vigs.count--;
            currentAdm.vigs.notes[currentAdm.vigs.count] += " (снят)";
            message.send(`✅ Администратору ${await getSteamNickname(message.$match[1])} снято 3 выговора. Остаток ${currentAdm.cash} баллов`);
            saveAdmins();
        } else return message.send(`🚫 У администратора ${await getSteamNickname(message.$match[1])} недостаточно баллов для снятия наказания`);
    } else message.send(`⛔ Недостаточно прав для выполнения этого действия.`);
});

msg.hear(/^(?:!снятьпред)\s(.+)\s([12])$/i, async (message) => {
    if (message.senderId == 488624280 || message.senderId == 190628413) {
        getCurrentAdm(message.$match[1]);
        if (message.$match[2] > currentAdm.preds.count) return message.send(`⚠ Вы не можете снять больше предупреждений админстратору, чем у него есть`);
        if (currentAdm.preds.count == 0) return message.send(`⚠ У администратора ${await getSteamNickname(message.$match[1])} нет предупреждений`);
        if (message.$match[2] == 1 && currentAdm.cash >= 120 && currentAdm.preds.count > 0) {
            currentAdm.cash -= 120;
            currentAdm.preds.count--;
            currentAdm.preds.notes[currentAdm.preds.count] += " (снято)";
            message.send(`✅ Администратору ${await getSteamNickname(message.$match[1])} снято предупреждение. Остаток ${currentAdm.cash} баллов`);
            saveAdmins();
        } else if (message.$match[2] == 2 && currentAdm.cash >= 240 && currentAdm.preds.count > 1) {
            currentAdm.cash -= 240;
            currentAdm.preds.count--;
            currentAdm.preds.notes[currentAdm.preds.count] += " (снято)";
            currentAdm.preds.count--;
            currentAdm.preds.notes[currentAdm.preds.count] += " (снято)";
            message.send(`✅ Администратору ${await getSteamNickname(message.$match[1])} снято 2 предупреждения. Остаток ${currentAdm.cash} баллов`);
            saveAdmins();
        } else return message.send(`🚫 У администратора ${await getSteamNickname(message.$match[1])} недостаточно баллов для снятия наказания`);
    } else message.send(`⛔ Недостаточно прав для выполнения этого действия.`);
});

msg.hear(/^(?:!снять)\s(.+)$/i, async (message) => {
    if (message.senderId == 488624280 || message.senderId == 190628413) {
        if (!getCurrentAdm(message.$match[1])) return message.send(`🚫 Администратора нет в базе данных`);
        await getSteamNickname(message.$match[1]);
        message.send(`✅ Администратор ${await getSteamNickname(message.$match[1])} снят`);
        removeUser(currentAdm.id);
        admins.splice(admins.indexOf(currentAdm), 1);
        saveAdmins();
    } else message.send(`⛔ Недостаточно прав для выполнения этого действия.`);
});

msg.hear(/^(?:!тест)$/i, async (message) => {
    console.log(await getInfo());
});

function start(start) {
    vk.updates.start();
    console.log(start);
}

function getCurrentAdm(arg1) {
    return currentAdm = admins.find(x => x.id === Number(arg1.slice(3, arg1.indexOf('|'))));
}

function getActivity(arg1) {
    getCurrentAdm(arg1);
    var b = moment(moment().format("DD-MM-YYYY"), "DD-MM-YYYY");
    var c = moment(currentAdm.inactive, "DD-MM-YYYY");
    if (currentAdm.inactive == "") return `🖥 Активен`;
    if (c.diff(b, 'days') > 0) return `🔜 Неактив до: ${currentAdm.inactive} (${c.diff(b, 'days')} days remained)`;
    else return `🖥 Активен`;
}

function getOnline(arg1, callback) {
    getCurrentAdm(arg1);
    var qry = `SELECT * FROM adminwatch`;
    var s2id = new SteamID(currentAdm.steamid);
    s2id = s2id.getSteam2RenderedID(true);
    s2id = s2id.slice(10);
    connection.query(qry, function (err, result, online) {
        if (err) console.log(err);
        cResult = result.find(x => x.steam.slice(10) === s2id);
        return callback(cResult.played);
    });
}

async function adminsList(i, arg) {
    let currentAdm = admins[i];
    if (arg == 0 || arg == 1 && currentAdm.job == "Следящий за хелперами" || (arg == 2 && currentAdm.job == "Администратор") || (arg == 3 && currentAdm.job == "Модератор") || (arg == 4 && currentAdm.job == "Хелпер")) {
        if (currentAdm.verified) var verif = "✅"; else var verif = "🚨";
        var nick; await steam.getUserSummary(currentAdm.steamid).then(summary => { nick = summary.nickname; });
        return text += `[ ${verif} ${currentAdm.job} - [id${currentAdm.id}|${nick}] ]  [${currentAdm.vigs.count}/3] [${currentAdm.preds.count}/3] [${currentAdm.cash}]\n`;
    }
    return 0;
}

async function getSteamNickname(arg1) {
    getCurrentAdm(arg1);
    var nick; await steam.getUserSummary(currentAdm.steamid).then(summary => { nick = summary.nickname; });
    return nick;
}

async function getFirstName(id) {
    const resp = await vk.api.users.get({
        user_ids: id
    });
    return resp[0].first_name;
}

async function removeUser(arg) {
    const chats = await vk.api.messages.removeChatUser({
        chat_id: 2,
        user_id: arg
    });
    return 1;
}

async function saveAdmins() {
    require('fs').writeFileSync('./admins.json', JSON.stringify(admins, null, '\t'));
    return true;
}

setInterval(async () => {
    await saveAdmins();
    console.log('Admins saved!');
}, 600000);
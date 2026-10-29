// Глава 2: оформление сообщений чата (предметы — в js/items.js)

// Сообщения переписки: Саша слева, Анжела справа
function chatIn(text, time) {
    return `<span class='chat-from-sasha'>рафаэль амброзиус кусто${time ? ' · ' + time : ''}</span>${text}`;
}
function chatOut(text, time) {
    return `<span class='chat-from-me'>Анжело❤️${time ? ' · ' + time : ''}</span>${text}`;
}

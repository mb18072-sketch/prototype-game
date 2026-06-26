export const depth = {
    battle: {
        board: 400,
        bullet: {
            inside: 500,
            outside: {
                low: 700,
                high: 1000
            },
        },
        soul: 800
    },
        ui: {
            text: 900,
            menu: 350,
        }
}

export function normalizeKey(key) {
    key = key.toUpperCase();

    const map = {
        "CONTROL": "CTRL",
        "SHIFT": "SHIFT",
        "ALT": "ALT",
        "META": "META",
        "ESCAPE": "ESC",
        " ": "SPACE",
        "ARROWUP": "UP",
        "ARROWDOWN": "DOWN",
        "ARROWLEFT": "LEFT",
        "ARROWRIGHT": "RIGHT",
        "ENTER": "ENTER",
        "TAB": "TAB",
        "BACKSPACE": "BACKSPACE"
    };

    if (map[key]) return map[key];

    // 記号そのまま
    if (key.length === 1) return key;

    return key;
}
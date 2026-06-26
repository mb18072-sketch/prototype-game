export class SaveManager {
    static saveOptions(data) {
        localStorage.setItem("game_options", JSON.stringify(data));
    }

    static loadOptions() {
        const raw = localStorage.getItem("game_options");
        if (!raw) return null;
        return JSON.parse(raw);
    }
}
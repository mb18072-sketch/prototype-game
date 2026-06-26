class AssetLoader {
    constructor(scene) {
        this._image = new Map();
        this._audio = new Map();
        this._json = new Map();
        this._xml = new Map();
        this._text = new Map();
        this._fonts = new Map();
        this.scene = scene;

        this._files = new Map(); // key=> {handle,path,type}って感じ
        this._promises = [];
    }

    _makeKey(path) {
        return path.replace(/\.[^/.]+$/, "");
    }

    async scanDirectory(dirHandle, basePath = "") {
        for await (const [name, handle] of dirHandle.entries()) {
            const path = basePath ? `${basePath}/${name}` : name;

            if (handle.kind === "directory") {
                await this.scanDirectory(handle, path);
                continue;
            }

            const ext = path.split(".").pop().toLowerCase();
            const key = this._makeKey(path);

            let type = null;

            switch (ext) {
                case "json": type = "json"; break;
                case "xml":
                case "fnt":
                    type = "xml";
                    break;
                case "txt": type = "text"; break;
                case "ttf":
                case "otf": type = "font"; break;

                case "png":
                case "jpg":
                case "jpeg":
                case "webp":
                    type = "image";
                    break;

                case "ogg":
                case "mp3":
                case "wav":
                    type = "audio";
                    break;
            }

            if (!type) continue;

            if (!this._files.has(key)) {
                this._files.set(key, []);
            }

            this._files.get(key).push({handle, path, type});
        }
    }

    _loadImage(file,key) {
        return file.arrayBuffer().then(buffer => {
            const blob = new Blob([buffer]);
            const url = URL.createObjectURL(blob);

            const img = new Image();
            img.src = url;

            return new Promise(resolve => {
                img.onload = () => {
                    this._image.set(key,img);
                    resolve(img);
                };
            });
        });
    }

    _loadAudio(file,key) {
        return file.arrayBuffer().then(buffer => {
            const blob = new Blob([buffer]);
            const url = URL.createObjectURL(blob);

            this._audio.set(key,url);
            return url;
        })
    }

    _loadJSON(file, key) {
        return file.text().then(text => {
            const json = JSON.parse(text);
            this._json.set(key, json);
            return json;
        });
    }

    _loadXML(file, key) {
        return file.text().then(text => {
            const parser = new DOMParser();
            const xml = parser.parseFromString(text, "application/xml");
            this._xml.set(key, xml);
            return text;
        });
    }

    _loadText(file, key) {
        return file.text().then(text => {
            this._text.set(key, text);
            return text;
        });
    }

    _loadFont(file, key) {
        return file.arrayBuffer().then(buffer => {
            const font = new FontFace(key, buffer);

            return font.load().then(loaded => {
                document.fonts.add(loaded);
                this._fonts.set(key, loaded);
                return loaded;
            });
        });
    }

    _loadBitmapFont(key) {
        const img = this._image.get(key); const xml = this._xml.get(key);
        if (!img || !xml) return;
        if (!this.scene.textures.exists(key)) {
            this.scene.textures.addImage(key, img);
        }
        const texture = this.scene.textures.get(key); const frame = texture.get();

        const data = Phaser.GameObjects.BitmapText.ParseXMLBitmapFont(xml, frame, 0, 0, texture);

        this.scene.cache.bitmapFont.add(key,
                                        {
                                            data: data,
                                            texture: key,
                                            frame: null
                                        });
    }

    async loadAll() {
        const tasks = [];

        for (const [key,infos] of this._files) {
            for(const info of infos) {
                const {handle,type} = info;
                tasks.push(
                    handle.getFile().then(file => {
                        switch (type) {
                            case "image":
                                return this._loadImage(file,key);
                            case "audio":
                                return this._loadAudio(file,key);
                            case "json":
                                return this._loadJSON(file,key);

                            case "xml":
                                return this._loadXML(file,key);

                            case "text":
                                return this._loadText(file,key);

                            case "font":
                                return this._loadFont(file,key);
                        }
                    }).catch(err => {
                        alert("error")
                        throw err;
                    })
                );
            }
        }

        await Promise.all(tasks);

        for (const key of this._image.keys()) {
            if (this._xml.has(key) && this._image.has(key)) {
                this._loadBitmapFont(key);
            }
        }
    }

    getimage(name) {
        return this._image.get(name);
    }

    getaudio(name) {
        return this._audio.get(name);
    }

    getjson(name) {
        return this._json.get(name);
    }

    getxml(name) {
        return this._xml.get(name);
    }

    gettext(name) {
        return this._text.get(name);
    }
}

class HandleDB {
    constructor() {
        this.dbp = new Promise((resolve, reject) => {
            const req = indexedDB.open("UndertaleAssetDB", 1);
            req.onupgradeneeded = () => {
                req.result.createObjectStore("handles");
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    async get(key) {
        const db = await this.dbp;
        return new Promise((resolve, reject) => {
            const tx = db.transaction("handles", "readonly");
            const store = tx.objectStore("handles");
            const req = store.get(key);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    async set(key, value) {
        const db = await this.dbp;
        return new Promise((resolve, reject) => {
            const tx = db.transaction("handles", "readwrite");
            const store = tx.objectStore("handles");
            store.put(value, key);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }
}

class SaveManager {
    static saveOptions(data) {
        localStorage.setItem("game_options", JSON.stringify(data));
    }

    static loadOptions() {
        const raw = localStorage.getItem("game_options");
        if (!raw) return null;
        return JSON.parse(raw);
    }
}
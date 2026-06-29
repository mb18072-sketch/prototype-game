import { SaveManager } from './core.js';
import { InputManager, SoundManager } from './managers.js';
import { MenuCursor, BattleCard } from './ui.js';
import { Board, RedSoul, Bone } from './objects.js';
import { normalizeKey } from './constants.js';

export class BootScene extends Phaser.Scene {
    constructor() {
        super({key: "BootScene"});
    }

    create() {
        this.input.once("pointerdown",async () => {
            if (this.sound.context.state === "suspended") {
                await this.sound.context.resume();
            }

            const saved = SaveManager.loadOptions();

            if (saved) {
                Object.entries(saved).forEach(([key,value]) => { this.registry.set(key,value); });
            } else {
                this.registry.set("lang","en");
                this.registry.set("keybind",{
                    confirm: ["Z","ENTER"],
                    cancel: ["X","SHIFT"],
                    aux: ["C"],
                    up: ["UP"], down: ["DOWN"],
                    left: ["LEFT"],
                    right: ["RIGHT"],
                    modifier: ["CTRL"]
                });
                this.registry.set("bgm",50);
                this.registry.set("se",50);
                this.registry.set("fullscreen",false);
                this.registry.set("textSpeed",5);
                this.registry.set("battleUI","classic");
                this.registry.set("developer",false);
            }
            this.scene.start("TitleScene");
        })
    }
}

export class UndertaleScene extends Phaser.Scene {
    constructor(key) {
        super(key);

        this.fullscreenKey = null;
        this.ctrlKey = null;
    }

    preload() {}
    //6f6f6fが灰色
    create() {
        this.ready = false;

        this.createCommon();
        Promise.resolve(this.onCreate()).then(() => {
            this.ready = true;
        });
    }

    applyOptionChange() {
        const data = {
            lang: this.registry.get("lang"),
            keybind: this.registry.get("keybind"),
            bgm: this.registry.get("bgm"),
            se: this.registry.get("se"),
            fullscreen: this.registry.get("fullscreen"),
            textSpeed: this.registry.get("textSpeed"),
            battleUI: this.registry.get("battleUI"),
            developer: this.registry.get("developer")
            };

        SaveManager.saveOptions(data);
    }


    createCommon() {
        this.pendingAnimation = [];

        this.input.setDefaultCursor("none");

        this.inputManager = new InputManager(this);
        if (!this.registry.get("soundManager")) {
            this.soundManager = new SoundManager(this);
            this.registry.set("soundManager",this.soundManager);
        } else {
            this.soundManager = this.registry.get("soundManager");
            this.soundManager.scene = this;
        }

        if (this.registry.get("developer")) {
            this.createDebugOverlay();
        }
    }

    onCreate() {}

    loadSpriteSheet(key,img,config) {
        if (config?.meta?.type === "spritesheet") {
            this.load.spritesheet(
                key,
                img,
                {
                    frameWidth: config.texture.frameWidth,
                    frameHeight: config.texture.frameHeight,
                    margin: config.texture.margin ?? 0,
                    spacing: config.texture.spacing ?? 0
                }
            );

            this.pendingAnimation.push({
                key: key,
                config: config
            })
        }
    }

    createSpriteAnimation() {
        for (const sheet of this.pendingAnimation) {
            const key = sheet.key;
            const config = sheet.config;

            if (config.animations) {
                for (const [animName, anim] of Object.entries(config.animations)) {
                    this.anims.create({
                        key: `${key}:${animName}`,
                        frames: this.anims.generateFrameNumbers(key,{
                            frames: anim.frames
                        }),
                        frameRate: anim.frameRate,
                        repeat: anim.repeat
                    });
                }
            }
        }

        this.pendingAnimation.length = 0;
    }

    createDebugOverlay() {
        this.debugText = this.add.bitmapText(12,12,"assets/fonts/dataFont/dataFont","", 16).setDepth(9999);
    }
    
    update(time,delta) {
        if (!this.ready) return;
        this.updateCommon(time,delta);
        this.onUpdate(time,delta);
    }

    updateCommon(time,delta) {
        if (
            this.inputManager.isDown("modifier") &&
            this.inputManager.wasPressed("confirm")
        ) {
            this.toggleFullscreen();
        }

        if (this.registry.get("developer") && this.debugText) {
            this.updateDebugOverlay(delta)
        }
    }

    updateDebugOverlay(delta) {
        const fps = this.game.loop.actualFps;

        let memory = "N/A";
        if (performance.memory) {
            const used = performance.memory.usedJSHeapSize / 1048576;
            const total = performance.memory.totalJSHeapSize / 1048576;
            memory = `${used.toFixed(1)}MB / ${total.toFixed(1)}MB`;
        }

        const objects = this.children.list.length;

        this.debugText.setText([
            `FPS: ${fps.toFixed(1)}`,
            `MEM: ${memory}`,
            `SCENE: ${this.scene.key}`,
            ` OBJ: ${objects}`,
            `DELTA: ${delta.toFixed(2)}`
        ]);

        const t = this.time.now * 0.0002;
        const hue = t % 1;
        const color = Phaser.Display.Color.HSVToRGB(hue, 1, 1);

        this.debugText.setTint(color.color);
    }

    onUpdate() {}

    drawText(string,x,y,{
        fontKey = "Determinationmono",
        fontSize = 32,
        color = 0xffffff,
        depth = 1000,
        origin = 0.5
    } = {}) {
        const fontPath = `assets/fonts/${fontKey}/${fontKey}`;

        const text = this.add.bitmapText(x,y,fontPath,string,fontSize).setDepth(depth);
        if (typeof origin === 'number') {
            text.setOrigin(origin);
        } else {
            text.setOrigin(origin.x, origin.y);
        }

        text.setTint(color);

        text.setFontFamily = (newFontKey) => {
            const newPath = `assets/fonts/${newFontKey}/${newFontKey}`;

            text.setFont(newPath);
        };

        return text;
    }

    getTextFromKey(jsonName,key) {
        const lang = this.registry.get("lang") ?? "en";
        const json = this.cache.json.get(`${jsonName}_${lang}`);

        if (!json) {
            console.warn(`JSON not found: ${jsonName}_${lang}`);
            return key;
        }
        
       return key
        .split(".")
        .reduce((o,k) => o?.[k],json)??key;
    }

    drawTextKey(jsonName,key,x,y,{
        fontSize = 32,
        color = 0xffffff,
        depth = 1000,
        origin = 0.5
    }={}
               ) {
        const string = this.getTextFromKey(jsonName,key);
        const lang = this.registry.get("lang") ?? "en";
        const fontKey = lang === "jp" ? "JF-Dot-Shinonome14" : "Determinationmono";
        return this.drawText(string,x,y,{fontKey,fontSize,color,depth,origin});
               }

    setFullscreen(enabled) {
        const wrapper = document.getElementById("game-wrapper");

        if (enabled) {
            if (!this.scale.isFullscreen) {
                this.scale.startFullscreen();
            }
            wrapper.style.width = "100vw";
            wrapper.style.height = "100vh";
        } else {
            if (this.scale.isFullscreen) {
                this.scale.stopFullscreen();
            }
            wrapper.style.width = "640px";
            wrapper.style.height = "480px";
        }

        this.registry.set("fullscreen", enabled);
    }

    toggleFullscreen() {
        const current = this.registry.get("fullscreen");
        this.setFullscreen(!current);
    }
}

export class TitleScene extends UndertaleScene {
    constructor() {
        super({ key: "TitleScene"});
    }

    preload() {
        this.load.bitmapFont("assets/fonts/dataFont/dataFont", "./assets/fonts/dataFont/dataFont.png", "./assets/fonts/dataFont/dataFont.xml");
        this.load.bitmapFont("assets/fonts/JF-Dot-Shinonome14/JF-Dot-Shinonome14", "./assets/fonts/JF-Dot-Shinonome14/JF-Dot-Shinonome14.png", "./assets/fonts/JF-Dot-Shinonome14/JF-Dot-Shinonome14.xml");
        this.load.bitmapFont("assets/fonts/Determinationmono/Determinationmono", "./assets/fonts/Determinationmono/Determinationmono.png", "./assets/fonts/Determinationmono/Determinationmono.xml");
    }

    onCreate() {
        this.drawText("タイトル",320,240,{
            fontKey: "JF-Dot-Shinonome14",
            fontSize: 64,
            origin: 0.5
        });

        this.drawText("[PRESS Z OR ENTER]",320,360,{
            fontSize: 24,
            color: 0x6f6f6f,
            origin: 0.5
        });

    }

    onUpdate() {
        if (this.inputManager.wasPressed("confirm")) {
            this.scene.start("MainMenuScene");
        }
        
    }
}

export class MainMenuScene extends UndertaleScene {
    constructor() {
        super({ key: "MainMenuScene" });
    }

    preload(){
        this.load.json("assets/data/Menu_en", "./assets/data/Menu_en.json");
        this.load.json("assets/data/Menu_jp", "./assets/data/Menu_jp.json");
        this.load.json("assets/data/Option_en", "./assets/data/Option_en.json");
        this.load.json("assets/data/Option_jp", "./assets/data/Option_jp.json");
        this.load.json("assets/data/Option_config", "./assets/data/Option_config.json");

        this.load.audio("assets/sounds/snd_switch", "./assets/sounds/snd_switch.wav");
        this.load.audio("assets/sounds/snd_confirm", "./assets/sounds/snd_confirm.wav");
        this.load.audio("assets/sounds/snd_cancel", "./assets/sounds/snd_cancel.wav");
    }

    onCreate() {
        this.items = [
            {label: "menu.option",x: 320,y: 220},
            {label: "menu.play",x: 320,y: 260},
        ];
        if (this.registry.get("developer")) this.items.push({label: "menu.editor",x: 320,y: 300});

        this.cursorManager = new MenuCursor({
            rows: this.items.length,
            cols: 1,
            loop: true
        });
            this.texts = this.items.map(item =>
                this.drawTextKey("assets/data/Menu",
                                 item.label,
                                 item.x,
                                 item.y
                                )
                                       )
    }

    onUpdate() {
        if (this.inputManager.wasPressed("up")) {
            this.cursorManager.move(0,-1);
            this.soundManager.playSE("assets/sounds/snd_switch");
        }

        if (this.inputManager.wasPressed("down")) {
            this.cursorManager.move(0,1);
            this.soundManager.playSE("assets/sounds/snd_switch");
        }

        if (this.inputManager.wasPressed("confirm")
           ) {
            this.decide();
            this.soundManager.playSE("assets/sounds/snd_confirm");
           }

        this.managerUpdate();
    }

    decide() {
        const index = this.cursorManager.index;

        switch (index) {
            case 0:
                this.scene.start("OptionScene");
                break;
            case 1:
                this.scene.start("BattleSelectScene");
                break;
            case 2:
                this.scene.start("EditorScene");
                break;
        }
    }

    managerUpdate() {
        const selected = this.cursorManager.index;

        this.texts.forEach((text,i) => {
            text.setTint(
                i === selected ? 0xffff33:0xffffff
            );
        });
    }
}

export class OptionScene extends UndertaleScene {
    constructor() {
        super({ key: "OptionScene" });
    }

    onCreate() {
        /*====型について====
        型はtypeで決めます。
        ====種類について====
        label 変数を持たないただの文章
        cycle 2つ以上の値を自由に選ばせる ２つの値を指定する
        toggle T or Fみたいな感じでOnOffを切り替えれる
        range スライダー minとmaxを指定する
        persent 0~100の数値スライダー minとmaxを指定する

        ===特殊な型===
        blank 空白
        key Enterが押されたときに、keyを変える画面を開くプレイヤーの操作がenter→Zだったら、ここに入る値はzになる
        group 複数のoptionを一つにまとめて管理ができる
        */
        this.items = JSON.parse(JSON.stringify(this.cache.json.get("assets/data/Option_config")));

        const bindGetSet = (item) => {
            if (!item.registryKey) return;
            const keys = item.registryKey.split(".");

            item.get = () => {
                let current = this.registry.get(keys[0]);
                for (let i = 1; i < keys.length; i++) {
                    current = current?.[keys[i]];
                }
                return current ?? item.default ?? [];
            };

            item.set = (v) => {
                const rootKey = keys[0];

                if (keys.length === 1) {
                    this.registry.set(rootKey, v);
                    return;
                }

                let rootObj = JSON.parse(JSON.stringify(this.registry.get(rootKey) ?? {}));
                
                let current = rootObj;
                for (let i = 1; i < keys.length - 1; i++) {
                    const nextKey = keys[i];
                    if (!current[nextKey]) current[nextKey] = {};
                    current = current[nextKey];
                }
                const lastKey = keys[keys.length - 1];
                current[lastKey] = v;

                this.registry.set(rootKey, rootObj);
            };
        };

        const scanItemsRecursively = (itemsDict) => {
            Object.values(itemsDict).forEach(item => {
                if (item.type === "group" && item.items) {
                    scanItemsRecursively(item.items);
                } else {
                    bindGetSet(item);
                }
            });
        };

        scanItemsRecursively(this.items);

        this.waitingKey = false;
        this.waitingOption = null;
        this._listeningKey = false;

        this.itemList = Object.values(this.items);

        this.lineHeight = 40;
        this.currentLine = 0;
        this.textObjects = this.createOptions(this.itemList,40,60,this.lineHeight);
        this.cursorTargets = this.textObjects.filter(
            t => t.option.type !== "label"
        );

        this.scrollOffset = 0;
        this.centerY = 240

        this.cursorManager = new MenuCursor({
            rows: this.cursorTargets.length,
            cols: 1,
            loop: true
        });
    }

    createOptions(array,startX,startY,lineHeight,handle = null,depth = 0) {
        const texts = [];
        for (const item of array) {
            const type = item.type;
            switch (type) {
                case "label":
                    break;
                    
                case "cycle":
                    break;
                
                case "toggle":
                    break;
                    
                case "range":
                    break;
                    
                case "persent":
                    break;
                    
                case "key":
                    break;
                    
                case "group":
                    const newArray = Object.values(item.items);
                    const childTexts = this.createOptions(newArray,startX,startY,lineHeight,item.handle,depth+10);
                    texts.push(...childTexts);
                    continue;
            }

            let x = startX + depth;
            let y = startY + this.currentLine*lineHeight;
            let origin = 0;
            if (type === "label") {
                x = 320;
                y += 16
                origin = 0.5
            }
            
            let label;
            if (handle) {
                label = this.drawTextKey(
                    "assets/data/Option",
                    `${handle}.${item.label}`,
                    x,//縦に並べるならこれでよき
                    y,
                    {origin:origin}
                );
            } else {
                label = this.drawTextKey(
                    "assets/data/Option",
                    `${item.label}`,
                    x,
                    y,
                    {origin:origin}
                );
            }

            let valueText = item.get?.();

            if (Array.isArray(valueText)) {
                valueText = valueText.join(" / ");
            }

            if (typeof valueText === "boolean") valueText = valueText ? "ON" : "OFF";
            const lang = this.registry.get("lang") ?? "en";
            const font = lang === "en" ? "Determinationmono" : "JF-Dot-Shinonome14";

            const value = this.drawText(
                valueText ?? "",
                400,
                y,
                {
                    fontKey: font,
                    origin:0
                }
            );
            texts.push({
                label: label,
                value: value,
                option: item,
                baseY: y,
                key: handle ? `${handle}.${item.label}` : item.label,
                updateValue: () => {
                    let v = item.get?.();

                    if (Array.isArray(v)) {
                        v = v.join(" / ");
                    }

                    if (typeof v === "boolean") v = v ? "ON" : "OFF";

                    value.setText(v ?? "");
                }
            });
            this.currentLine++;
        }
        return texts;
    }

    adjustScroll(delta) {
        const target = this.cursorTargets[this.cursorManager.row];
        const targetOffset = target.baseY - this.centerY;
        
        const speed = 10;

        this.scrollOffset +=
            (targetOffset - this.scrollOffset) *
            (1 - Math.exp(-speed * delta / 1000));

        this.updateTextPositions();
    }

    updateTextPositions() {
        this.textObjects.forEach((text,i) => {
            const y = text.baseY - this.scrollOffset;
            text.label.y = y;
            text.value.y = y;

            if (y < -20 || y > 500) {
                text.label.setVisible(false);
                text.value.setVisible(false);
            } else {
                text.label.setVisible(true);
                text.value.setVisible(true);
            }
        });
    }

    handleDeveloperToggle(enabled) {
        if (enabled) {
            if (!this.debugText) {
                this.createDebugOverlay();
            }
        } else {
            if (this.debugText) {
                this.debugText.destroy();
                this.debugText = null;
            }
        }
    }

    changeOption(v = null) {
        const row = this.cursorManager.row;
        const text = this.cursorTargets[row];
        const option = text.option;
        switch (option.type) {
            case "cycle":
                if (!v) {
                    const list = option.value;
                    let index = list.indexOf(option.get());

                    index = (index+1)% list.length;

                    option.set(list[index]);

                    this.refreshLanguage();
                }
                break;
                
            case "toggle":
                if (!v) {
                    const newValue = !option.get();
                    option.set(newValue);

                    if (option === this.items.fullscreen) this.setFullscreen(newValue);

                    if (option === this.items.developer) this.handleDeveloperToggle(newValue);
                }
                break;
                
            case "range": {
                if (v) {
                    const current = option.get();
                    let value = current + v;
                    if (value > option.max) value = option.max;
                    if (value < option.min) value = option.min;
                    option.set(value);
                }
                break;
            }
                
            case "persent":{
                if (v) {
                    const current = option.get();
                    let value = current + v;
                    if (value > 100) value = 100;
                    if (value < 0) value = 0;
                    option.set(value);
                }
                break;
            }
                
            case "key":
                if (!v) {
                    this.waitingKey = true;
                    this.waitingOption = option;
                    const text = this.cursorTargets[this.cursorManager.row];
                    text.value.setText("...");
                    text.value.setTint(0xffff33);
                    return;
                }
                break;
        }

        text.updateValue();
        this.applyOptionChange();
    }

    toggleFullscreen() {
        super.toggleFullscreen();

        this.cursorTargets.forEach(t => t.updateValue());
    }

    refreshLanguage() {
        const lang = this.registry.get("lang") ?? "en";
        const font = lang === "en" ? "Determinationmono" : "JF-Dot-Shinonome14";
        for (const obj of this.textObjects) {
            if (obj.key) {

                const newText = this.getTextFromKey(
                    "assets/data/Option",
                    obj.key,
                )

                obj.label.setText(newText);
            }

            obj.label.setFontFamily(font);
            obj.value.setFontFamily(font);
        }
    }

    onUpdate(time,delta) {
        if (this.inputManager.wasPressed("up") && !this.waitingKey) {
            this.cursorManager.move(0,-1);
            this.soundManager.playSE("assets/sounds/snd_switch");
        }

        if (this.inputManager.wasPressed("down") && !this.waitingKey) {
            this.cursorManager.move(0,1);
            this.soundManager.playSE("assets/sounds/snd_switch");
        }

        if (this.inputManager.isRepeated("left",300,60) && !this.waitingKey) {
            this.changeOption(-1);
            this.soundManager.playSE("assets/sounds/snd_confirm");
        }

        if (this.inputManager.isRepeated("right",300,60) && !this.waitingKey) {
            this.changeOption(1);
            this.soundManager.playSE("assets/sounds/snd_confirm");
        }

        if (this.inputManager.wasPressed("confirm") && !this.waitingKey) {
            this.changeOption();
            this.soundManager.playSE("assets/sounds/snd_confirm");
        }

        if (this.waitingKey && !this._listeningKey) {
            this._listeningKey = true;
            const key = this.input.keyboard.once("keydown",(e) => {
                const code = normalizeKey(e.key);

                let current = [...(this.waitingOption.get() ?? [])];
                const text = this.cursorTargets[this.cursorManager.row];

                if (current.includes(code)) {
                    this.waitingKey = false;
                    this._listeningKey = false;
                    text.updateValue();
                    text.value.setTint(0xffffff);
                    this.soundManager.playSE("assets/sounds/snd_cancel");
                    this.applyOptionChange();
                    this.input.keyboard.resetKeys();
                    return;
                }

                if (current.length === 0) {
                    current = [code];
                } else if (current.length === 1) {
                    current = [code];
                } else {
                    current = [current[1], code];
                }

                this.waitingOption.set(current);
                text.updateValue();
                this.waitingKey = false;
                this.waitingOption = null;
                this._listeningKey = false;
                text.value.setTint(0xffffff);
                this.soundManager.playSE("assets/sounds/snd_confirm");
                this.input.keyboard.resetKeys();

                this.applyOptionChange();
            })
        }

        if (this.inputManager.wasPressed("cancel") && !this.waitingKey) {
            this.scene.start("MainMenuScene");
            this.soundManager.playSE("assets/sounds/snd_cancel");
        }

        this.managerUpdate();
        this.adjustScroll(delta);
    }

    managerUpdate() {
        const selected = this.cursorManager.index;

        this.cursorTargets.forEach((text,i) => {
            text.label.setTint(
                i === selected ? 0xffff33:0xffffff
            );
        });
    }
}

export class BattleSelectScene extends UndertaleScene {
    constructor() {
        super({key: "BattleSelectScene"});
    }

    preload() {
        this.loadSpriteSheet("assets/images/soul/soul","./assets/images/soul/soul.png","./assets/images/soul/soul.json");

        this.load.image("assets/images/bone","./assets/images/bone.png");
    }

    async onCreate() {
        this.createSpriteAnimation();
        this._files = new Map();

        this.updateables = [];

        const triggerText = this.drawText("[CLICK TO LOAD BATTLE FOLDER]",320,240,{
            fontSize: 32,
            color: 0xffffff,
            origin: 0.5
        });

        const exit = this.drawText("EXIT",200,400,{
            fontSize: 32,
            color: 0xffffff,
            origin: 0.5
        });

        const start = this.drawText("START",440,400,{
            fontSize: 32,
            color: 0x6f6f6f,
            origin: 0.5
        });

        const openFolderAndPlay = async () => {
            try{
                const dirHandle = await window.showDirectoryPicker();
                triggerText.setText("Loading files...");
                await this.scanDirectory(dirHandle);

                for (const [fileKey,array] of this._files) {
                    if (array.length <= 1) continue;

                    const bitmapImg = array.filter(file => file.type === "image");
                    const bitmapXML = array.filter(file => file.type === "xml");

                    if (bitmapImg.length === 0 || bitmapXML.length === 0) continue;
                    for (const file of bitmapImg) file.type = "bitmap";
                    for (const file of bitmapXML) file.type = "bitmap";
                }
                triggerText.setText(`${dirHandle.name}`);
                triggerText.setTint(0xffff33);
                start.setTint(0xffffff);

                start.setInteractive({ useHandCursor: true });
                start.on("pointerdown", () => {
                    this.scene.start("PlayScene",{
                        assets: this._files
                    });
                });
            } catch (err) {
                triggerText.setText("Can't load the folder");
            }
        }

        triggerText.setInteractive({ useHandCursor: true });
        triggerText.on("pointerdown", () => {
            openFolderAndPlay();
        });

        exit.setInteractive({ useHandCursor: true });
        exit.on("pointerdown", () => {
            this.scene.start("MainMenuScene");
        });
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

            this._files.get(key).push({handle, path, type,ext});
        }
    }

    _makeKey(path) {
        return path.replace(/\.[^/.]+$/, "");
    }
}

export class PlayScene extends UndertaleScene {
    constructor() {
        super({key: "PlayScene"})
    }

    init(data) {
        this.files = data.assets;
    }

    async preload() {
        for (const [key,assets] of this.files.entries()) {
            await this.sameKeyAssetsLoad(key,assets);
        }

        this.load.start();

        await new Promise((resolve) => {
            this.load.once("complete",resolve);
        });
    }

    async sameKeyAssetsLoad(key,assets) {
        const isBitmap = assets.some(asset => asset.type === "bitmap");

        if (isBitmap) {
            const imgAsset = assets.find(a => ["png", "jpg", "jpeg", "webp"].includes(a.ext));
            const xmlAsset = assets.find(a => ["xml", "fnt"].includes(a.ext));

            if (imgAsset && xmlAsset) {
                const imgFile = await imgAsset.handle.getFile();
                const xmlFile = await xmlAsset.handle.getFile();

                const imgUrl = URL.createObjectURL(imgFile);
                const xmlUrl = URL.createObjectURL(xmlFile);

                this.load.bitmapFont(key, imgUrl, xmlUrl);
            }
        } else {
            for (const asset of assets) {
                const file = await asset.handle.getFile();
                const blobUrl = URL.createObjectURL(file);

                this.load[asset.type](key,blobUrl);
                URL.revokeObjectURL(blobUrl);
            }
        }
    }

    onCreate() {
        this.updateables = [];
        this.board = new Board(this,320,320,566,130);
        this.soul = new RedSoul(this,320,320,this.board);
        const bone = new Bone(this,320,320,20);
    }

    onUpdate(time,delta) {
        for (const obj of this.updateables) {
            obj.update0?.(time,delta);
        }

        for (const obj of this.updateables) {
            obj.update1?.(time,delta);
        }

        for (const obj of this.updateables) {
            obj.update2?.(time,delta);
        }
    }

    changeSoul(SoulClass) {
        const old = this.soul;

        const x = old.x;
        const y = old.y;
        const board = old.board;
        const hpManager = old.hpManager;

        old.destroy();

        this.soul = new SoulClass(this, x, y, board);

        this.soul.hpManager = hpManager;
    }
}

export class EditorScene extends UndertaleScene {
    constructor() {
        super({key: "EditorScene"})
    }
}
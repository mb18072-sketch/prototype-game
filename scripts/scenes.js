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
        this.assets = this.registry.get("assets");
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
        const json = this.assets.getjson(`${jsonName}_${lang}`);
        
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
        this.items = {
            lang :{
                label: "option.lang",
                type: "cycle",
                value: ["en","jp"],
                get: () => this.registry.get("lang") ?? "en",
                set: (v) => this.registry.set("lang",v)
            },
            keybind :{
                label: "option.keybind.title",
                type: "label"
            },
            keys :{
                handle: "option.keybind.actions",
                type: "group",
                items: {
                    confirm: {
                        label: "confirm",
                        type: "key",
                        get: () => this.registry.get("keybind")?.confirm ?? [],
                        set: (v) => {
                            const kb = this.registry.get("keybind");
                            kb.confirm = v;
                            this.registry.set("keybind",kb)
                        }
                    },
                    cancel: {
                        label: "cancel",
                        type: "key",
                        get: () => this.registry.get("keybind")?.cancel ?? [],
                        set: (v) => {
                            const kb = this.registry.get("keybind");
                            kb.cancel = v;
                            this.registry.set("keybind",kb)
                        }
                    },
                    aux: {
                        label: "aux",
                        type: "key",
                        get: () => this.registry.get("keybind")?.aux ?? [],
                        set: (v) => {
                            const kb = this.registry.get("keybind");
                            kb.aux = v;
                            this.registry.set("keybind",kb)
                        }
                    },
                    up: {
                        label: "up",
                        type: "key",
                        get: () => this.registry.get("keybind")?.up ?? [],
                        set: (v) => {
                            const kb = this.registry.get("keybind");
                            kb.up = v;
                            this.registry.set("keybind",kb)
                        }
                    },
                    down: {
                        label: "down",
                        type: "key",
                        get: () => this.registry.get("keybind")?.down ?? [],
                        set: (v) => {
                            const kb = this.registry.get("keybind");
                            kb.down = v;
                            this.registry.set("keybind",kb)
                        }
                    },
                    left: {
                        label: "left",
                        type: "key",
                        get: () => this.registry.get("keybind")?.left ?? [],
                        set: (v) => {
                            const kb = this.registry.get("keybind");
                            kb.left = v;
                            this.registry.set("keybind",kb)
                        }
                    },
                    right: {
                        label: "right",
                        type: "key",
                        get: () => this.registry.get("keybind")?.right ?? [],
                        set: (v) => {
                            const kb = this.registry.get("keybind");
                            kb.right = v;
                            this.registry.set("keybind",kb)
                        }
                    },
                    modifier: {
                        label: "modifier",
                        type: "key",
                        get: () => this.registry.get("keybind")?.modifier ?? [],
                        set: (v) => {
                            const kb = this.registry.get("keybind");
                            kb.modifier = v;
                            this.registry.set("keybind",kb)
                        }
                    }
                },
            },
            sound: {
                label: "option.sound.title",
                type: "label"
            },
            sounds: {
                handle: "option.sound",
                type: "group",
                items: {
                    bgm: {
                        label: "bgm",
                        type: "persent",
                        get: () => this.registry.get("bgm"),
                        set: (v) => this.registry.set("bgm",v)
                    },
                    se: {
                        label: "se",
                        type: "persent",
                        get: () => this.registry.get("se"),
                        set: (v) => this.registry.set("se",v)
                    }
                }
            },
            display: {
                label: "option.display",
                type: "label",
            },
            fullscreen: {
                label: "option.fullscreen",
                type: "toggle",
                get: () => this.registry.get("fullscreen"),
                set: (v) => this.registry.set("fullscreen",v)
            },
            textSpeed: {
                label: "option.textSpeed",
                type: "range",
                min: 1,
                max: 15,
                get: () => this.registry.get("textSpeed"),
                set: (v) => this.registry.set("textSpeed",v)
            },
            battleUI: {
                label: "option.battleUI",
                type: "cycle",
                value:["classic","preview"],
                get: () => this.registry.get("battleUI") ?? "classic",
                set: (v) => this.registry.set("battleUI",v)
            },
            developer: {
                label: "option.developer",
                type: "toggle",
                get: () => this.registry.get("developer"),
                set: (v) => this.registry.set("developer",v)
            }
        }

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

    async onCreate() {
    const root = this.registry.get("rootHandle");

        const assetsHandle = await root.getDirectoryHandle("assets");
        const gamesHandle = await assetsHandle.getDirectoryHandle("games");

        this.battles = [];

        for await (const [name,handle] of gamesHandle.entries()) {
            if (handle.kind !== "directory") continue;

            const data = this.assets.getjson(
                `assets/games/${name}/data/gamedata`
            );

            if (!data) continue;

            this.battles.push({
                id: name,
                handle: handle,
                data: data
            });
        }
        this.UIType = this.registry.get("battleUI")==="preview";
        this.battleCards = this.battles.map((b,i) => {
            const icon = this.add.image(0,0,b.data.icon);
            if (this.UIType) {
                const text =
                    this.drawText(
                        b.id,
                        40,
                        120 + i * 40,
                        {origin: 0}
                    );
                icon.x = 120;
                icon.y = 0;
                const obj1 = new BattleCard(this,0,text.y,b,"preview",{
                    text: text,
                    icon: icon
                });
                this.add.existing(obj1);
                return obj1;
            } else {
                const border = this.add.rectangle(0,0,168,168,0xffffff).setOrigin(0.5);

                const inner = this.add.rectangle(0,0,162,162,0x000000).setOrigin(0.5);
                const obj2 = new BattleCard(this,360+i*207,240,b,"classic",{
                    border: border,
                    inner: inner,
                    icon: icon
                });
                this.add.existing(obj2);
                return obj2;
            }
        });
        this.cursor = 0;
        if (!this.UIType) {
            this.soulCursor = this.add.sprite(0,0,"assets/images/soul/soul",0);
            this.soulCursor.setTint(0xff0000);
            this.soulCursor.setAngle(135);
            this.scrollOffset = 0;
            this.maxScroll = this.battles.length * 207-207;
            window.addEventListener("mousemove", (e) => {
                const rect = this.game.canvas.getBoundingClientRect();

                const x = (e.clientX - rect.left) * (this.scale.width / rect.width);
                const y = (e.clientY - rect.top) * (this.scale.height / rect.height);

                this.soulCursor.x = x;
                this.soulCursor.y = y;
                const clampedX = Phaser.Math.Clamp(x, 0, this.scale.width);
                const clampedY = Phaser.Math.Clamp(y, 0, this.scale.height);

                this.soulCursor.x = clampedX;
                this.soulCursor.y = clampedY;
            });
        }
        this.input.on("pointerdown", (pointer) => {
            for (let i = 0; i < this.battleCards.length; i++) {
                const card = this.battleCards[i];

        // scroll考慮した当たり判定
                const bounds = card.getBounds();

                if (bounds.contains(pointer.x, pointer.y)) {
                    this.soundManager.playSE("assets/sounds/snd_confirm");

                    const selected = this.battles[i];

                    this.scene.start("PlayScene", {
                        battle: selected
                    });

                    break;
                }
            }
        });
    }

    onUpdate() {
        if (this.inputManager.wasPressed("cancel")) {
            this.scene.start("MainMenuScene");
            this.soundManager.playSE("assets/sounds/snd_cancel");
        }
        let select = false;
        if (this.UIType) {
            if (this.inputManager.wasPressed("up")) {
                this.cursor = (this.cursor - 1 + this.battleCards.length) % this.battleCards.length;
                this.soundManager.playSE("assets/sounds/snd_switch");
            }

            if (this.inputManager.wasPressed("down")) {
                this.cursor = (this.cursor + 1) % this.battleCards.length;
                this.soundManager.playSE("assets/sounds/snd_switch");
            }

            if (this.inputManager.wasPressed("confirm")) {
                this.soundManager.playSE("assets/sounds/snd_confirm");
                const selected = this.battles[this.cursor];

                this.scene.start("PlayScene", {
                    battle: selected
                });
            }

            this.battleCards.forEach((t,i) => {
                t.UIUpdate(i===this.cursor);
            });
        } else {
            const pointer = this.input.activePointer;
            
            if (this.scrollOffset < 0) {
                if (this.soulCursor.x < 30) {
                    this.scrollOffset += 6;
                }
            }
            if (this.scrollOffset > -this.maxScroll) {
                if (this.soulCursor.x > 610) {
                    this.scrollOffset -= 6;
                }
            }
            for (const card of this.battleCards) {
                
                const isHover = card.getBounds().contains(pointer.x, pointer.y);
                if (isHover && !card.wasSelected) this.soundManager.playSE("assets/sounds/snd_switch");
                card.UIUpdate(isHover);
                card.x = card.baseX + this.scrollOffset;
                card.wasSelected = isHover
            }
        }
    }
}

export class PlayScene extends UndertaleScene {
    constructor() {
        super({key: "PlayScene"})
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
export class InputManager {
    constructor(scene) {
        this.scene = scene;
        this.keyboard = scene.input.keyboard;

        this.keyCache = {};
    }
    getKeys(action) {
        const keybind = this.scene.registry.get("keybind");
        const keys = keybind?.[action];
        if (!keys) return [];

        return keys.map(code => {
            if (!this.keyCache[code]) {
                this.keyCache[code] = this.keyboard.addKey(code);
            }
            return this.keyCache[code];
        })
    }

    wasPressed(action) {
            return this.getKeys(action)
                .some(key =>Phaser.Input.Keyboard.JustDown(key));
    }

    isDown(action) {
        return this.getKeys(action)
                .some(key =>key.isDown);
    }

    isReleased(action) {
        return this.getKeys(action)
            .some(key => Phaser.Input.Keyboard.JustUp(key));
    }
    isRepeated(action, delay = 300, interval = 60) {
        const key = this.getKeys(action)[0];
        if (!key) return false;

        const duration = key.getDuration();

        if (Phaser.Input.Keyboard.JustDown(key)) return true;

        if (key.isDown && duration > delay) {
            return (duration - delay) % interval < 16;
        }

        return false;
    }
}

export class SoundManager {
    constructor(scene) {
        this.scene = scene;
        this.bgm = null;
    }

    playBGM(key) {
        if (this.bgm) this.bgm.stop();

        this.bgm = this.scene.sound.add(key, { loop: true });
        this.bgm.setVolume(this.getBGMVolume());
        this.bgm.play();
    }

    playSE(key) {
         alert(this.scene.registry.get("se"));
        this.scene.sound.play(key, {
            volume: this.getSEVolume()
        });
        alert("endSe")
    }

    getBGMVolume() {
        return this.scene.registry.get("bgm") / 100;
    }

    getSEVolume() {
        return this.scene.registry.get("se") / 100;
    }

    updateVolume() {
        if (this.bgm) {
            this.bgm.setVolume(this.getBGMVolume());
        }
    }
}

export class HpManager {
    constructor(scene,maxHp,Hp,soul) {

        scene.updateables.push(this);

        this.scene = scene;
        this.soul = soul;

        this.maxHp = maxHp;
        this.hp = Hp;
        this.kr = 0;
        this.inv = 0;

        this.damageTimer = 0;

        this.scene.events.on("bullet_hit",this.onHit,this);

        this.nextDamageSource = null;
    }

    onHit(bullet,soul) {
        if (soul !== this.soul) return;
        if (this.inv > 0 && !bullet.ignoreInv) return;
        if (!this.nextDamageSource || bullet.damage > this.nextDamageSource.damage) this.nextDamageSource = bullet;
    }

    damage(damage,inv,kr=0) {
        this.hp -= damage;
        if (this.hp > 0) {
            this.kr += kr;
            } else {
            this.hp = 1;
            this.kr -= damage;
            }
        this.inv = inv;
        this.scene.soundManager.playSE("assets/sounds/snd_hurt");
        this.checkHp();
    }

    heal(heal) {
        this.hp += heal;
        this.scene.soundManager.playSE("assets/sounds/snd_heal");
        this.checkHp();
    }

    checkHp() {
        if (this.hp + this.kr > this.maxHp) this.hp = this.maxHp-this.kr;

        if (this.hp <= 0) {
            if (this.kr > 0) {
                this.hp = 1;
            } else {
                this.scene.events.emit("gameover");
            }
        }
    }

    update0(time,delta) {}

    update1(time,delta) {}

    update2(time,delta) {
        if (this.inv > 0) {
            this.inv -= delta;
            if (this.inv < 0) this.inv = 0;
        }
        if (this.nextDamageSource) {
            this.damageTimer += delta;
            while (this.damageTimer >= 16.66) {
                this.damageTimer -= 16.66;
                this.damage(this.nextDamageSource.damage,this.nextDamageSource.inv,this.nextDamageSource.kr);
                this.nextDamageSource = null;
            }
        }
    }
}
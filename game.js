// ==========================================
// 1. 各シーンのクラス定義
// ==========================================
class BootScene extends Phaser.Scene {
    constructor() { super('BootScene'); }
    preload() {}
    create() { this.scene.start('TitleScene'); }
}

class TitleScene extends Phaser.Scene {
    constructor() { super('TitleScene'); }
    create() {
        this.add.text(180, 200, '4-LANE RHYTHM RPG\n\nCLICK TO START', { fill: '#fff', fontSize: '32px', align: 'center' });
        this.input.on('pointerdown', () => this.scene.start('PlayScene'));
    }
}

// --- 4レーン版 音ゲー本番画面 ---
class PlayScene extends Phaser.Scene {
    constructor() { super('PlayScene'); }

    create() {
        // 🛣️ 4レーンのX座標を設定（DFJKの並びに合わせて綺麗に配置）
        // レーン0, 1 = 防御用（D, Fキー） / レーン2, 3 = ゲージ用（J, Kキー）
        this.laneXs = [180, 260, 380, 460]; 
        this.targetY = 400; // 判定ラインの高さ

        // 判定ラインの目印（四角）と対応キーのテキストを設置
        const colors = [0xff2222, 0xff7777, 0x77ffff, 0x22ffff];
        const keyNames = ['Dキー', 'Fキー', 'Jキー', 'Kキー']; // ★DFJKに変更！

        for (let i = 0; i < 4; i++) {
            this.add.rectangle(this.laneXs[i], this.targetY, 60, 10, colors[i]);
            this.add.text(this.laneXs[i] - 20, this.targetY + 20, keyNames[i], { fontSize: '12px' });
        }

        // 📦 ノーツ管理グループ
        this.notesGroup = this.add.group();

        // ⏱️ タイマー（0.6秒ごとにノーツを湧かせる）
        this.time.addEvent({
            delay: 600,
            callback: this.spawnNote,
            callbackScope: this,
            loop: true
        });

        // ⌨️ キーボード入力設定（★DFJKに完全修正！）
        this.keys = [
            this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
            this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F),
            this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.J),
            this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.K)
        ];
    }

    update() {
        const noteSpeed = 6; // 4レーン用に少しスピーディに
        const children = this.notesGroup.getChildren();

        // ノーツの移動と見逃し（MISS）処理
        for (let i = children.length - 1; i >= 0; i--) {
            const note = children[i];
            note.y += noteSpeed;

            if (note.y > 450) {
                // 防御レーン（0か1）を見逃したらダメージ
                if (note.laneIndex < 2) {
                    this.hp -= 10;
                    this.hpText.setText('PLAYER HP: ' + this.hp);
                    this.judgeText.setText('MISS! ダメージ').setColor('#ff0000');
                } else {
                    this.judgeText.setText('MISS').setColor('#888888');
                }
                this.combo = 0;
                this.comboText.setText('COMBO: ' + this.combo);
                
                note.destroy();
            }
        }

        // 4つのキーの入力をループでチェック
        for (let i = 0; i < 4; i++) {
            if (Phaser.Input.Keyboard.JustDown(this.keys[i])) {
                this.checkHit(i); // 押されたキーに対応するレーンを判定
            }
        }

        // ゲームオーバー
        if (this.hp <= 0) {
            this.judgeText.setText('GAME OVER').setColor('#ff0000');
            this.scene.pause();
        }
    }

    // 💡 判定処理
    checkHit(laneIndex) {
        const children = this.notesGroup.getChildren();
        let closestNote = null;
        let minDistance = 999;

        // 同じレーンで一番近いノーツを探す
        for (let i = 0; i < children.length; i++) {
            const note = children[i];
            if (note.laneIndex === laneIndex) {
                const dist = Math.abs(note.y - this.targetY);
                if (dist < minDistance) {
                    minDistance = dist;
                    closestNote = note;
                }
            }
        }

        // 判定圏内ならヒット
        if (closestNote && minDistance < 60) {
            if (minDistance < 15) {
                this.judgeText.setText('PERFECT!!!').setColor('#00ff00');
                this.combo++;
                if (laneIndex >= 2) this.gauge += 15; // ゲージレーンならチャージ
            } else if (minDistance < 35) {
                this.judgeText.setText('GOOD').setColor('#ffff00');
                this.combo++;
                if (laneIndex >= 2) this.gauge += 8;
            } else {
                this.judgeText.setText('BAD').setColor('#ff8800');
                this.combo = 0;
            }

            if (this.gauge >= 100) this.gauge = 100;

            this.gaugeText.setText('ACTION GAUGE: ' + this.gauge + '%');
            this.comboText.setText('COMBO: ' + this.combo);
            closestNote.destroy();
        }
    }
}

// ==========================================
// 2. 設定（config）と起動
// ==========================================
const config = {
    type: Phaser.WEBGL,
    width: 640,
    height: 480,
    backgroundColor: "#111111",
    pixelArt: true,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    audio: { disableWebAudio: false },
    scene: [BootScene, TitleScene, PlayScene]
};

const game = new Phaser.Game(config);
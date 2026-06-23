// ==========================================
// 1. 各シーンのクラス定義
// ==========================================

// --- 素材読み込み画面 ---
class BootScene extends Phaser.Scene {
    constructor() { super('BootScene'); }
    preload() {}
    create() { this.scene.start('TitleScene'); }
}

// --- タイトル画面 ---
class TitleScene extends Phaser.Scene {
    constructor() { super('TitleScene'); }
    create() {
        this.add.text(180, 200, 'RHYTHM RPG\n\nCLICK TO START', { fill: '#fff', fontSize: '32px', align: 'center' });
        this.input.on('pointerdown', () => this.scene.start('PlayScene'));
    }
}

// --- 音ゲー本番画面（プロトタイプ） ---
class PlayScene extends Phaser.Scene {
    constructor() { super('PlayScene'); }

    create() {
        // --- 📊 ステータス初期化 ---
        this.hp = 100;
        this.gauge = 0;

        // --- 📝 UIテキスト ---
        this.hpText = this.add.text(20, 20, 'PLAYER HP: 100', { fontSize: '18px', fill: '#ff5555' });
        this.gaugeText = this.add.text(20, 50, 'ACTION GAUGE: 0%', { fontSize: '18px', fill: '#55ffff' });
        this.comboText = this.add.text(20, 80, 'COMBO: 0', { fontSize: '18px', fill: '#ffffff' });
        this.combo = 0;
        
        this.judgeText = this.add.text(240, 150, 'READY?', { fontSize: '32px', fill: '#fff', align: 'center' });

        // --- 🛣️ レーンと判定ラインの配置（X座標を固定） ---
        this.leftLaneX = 240;  // 左レーン（防御）
        this.rightLaneX = 400; // 右レーン（ゲージ）
        this.targetY = 400;    // 判定ラインの高さ

        // 判定ライン（ターゲット）の目印を設置
        this.add.rectangle(this.leftLaneX, this.targetY, 60, 10, 0xff5555);  // 赤
        this.add.rectangle(this.rightLaneX, this.targetY, 60, 10, 0x55ffff); // 青
        this.add.text(this.leftLaneX - 30, this.targetY + 20, 'Dキー(防)', { fontSize: '12px' });
        this.add.text(this.rightLaneX - 30, this.targetY + 20, 'Jキー(溜)', { fontSize: '12px' });

        // --- 📦 ノーツ管理用のグループ ---
        // これを作っておくと、for文を使わなくても複数のノーツを一括で動かせます
        this.notesGroup = this.add.group();

        // --- ⏱️ 定期的にノーツを湧かせるタイマー ---
        // 1秒（1000ミリ秒）ごとに、ランダムでどちらかのレーンにノーツを生成する
        this.time.addEvent({
            delay: 1000,
            callback: this.spawnNote,
            callbackScope: this,
            loop: true
        });

        // --- ⌨️ キーボード入力の設定 ---
        this.keyD = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
        this.keyJ = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.J);
    }

    // 💡 ノーツを新しく生成する関数
    spawnNote() {
        // 50%の確率で左（1）か右（2）かを決める
        const laneType = Phaser.Math.Between(1, 2); 
        const x = (laneType === 1) ? this.leftLaneX : this.rightLaneX;
        const color = (laneType === 1) ? 0xff0000 : 0x00ffff; // 赤か青

        // 画面の上端（Y=0）にノーツ（円）を作成
        const note = this.add.circle(x, 0, 15, color);
        
        // 後で判定するときに「どっちのレーンか」が分かるように、目印（カスタムプロパティ）を仕込んでおく
        note.laneType = laneType;

        // グループにポイッと放り込む
        this.notesGroup.add(note);
    }

    update() {
        const noteSpeed = 5; // ノーツが落ちる速度（ピクセル/フレーム）
        const children = this.notesGroup.getChildren();

        // --- 1. すべてのノーツを下方向に移動させる（逆ループで安全に削除） ---
        for (let i = children.length - 1; i >= 0; i--) {
            const note = children[i];
            note.y += noteSpeed;

            // 判定ラインを通り過ぎて画面外（Y=450以上）に行っちゃった場合
            if (note.y > 450) {
                if (note.laneType === 1) {
                    // 防御ノーツをスルーした場合はペナルティ！ダメージ！
                    this.hp -= 15;
                    this.hpText.setText('PLAYER HP: ' + this.hp);
                    this.judgeText.setText('MISS! ダメージ').setColor('#ff0000');
                } else {
                    // ゲージノーツはスルーしてもノーダメージ、MISSになるだけ
                    this.judgeText.setText('MISS').setColor('#888888');
                }
                this.combo = 0;
                this.comboText.setText('COMBO: ' + this.combo);
                
                note.destroy(); // 画面とグループから消去
            }
        }

        // --- 2. プレイヤーのキー入力と判定 ---
        if (Phaser.Input.Keyboard.JustDown(this.keyD)) {
            this.checkHit(1); // 左レーン（Dキー）の判定チェック
        }
        if (Phaser.Input.Keyboard.JustDown(this.keyJ)) {
            this.checkHit(2); // 右レーン（Jキー）の判定チェック
        }

        // --- 3. ゲームオーバー判定 ---
        if (this.hp <= 0) {
            this.judgeText.setText('GAME OVER').setColor('#ff0000');
            this.scene.pause();
        }
    }

    // 💡 キーが押されたとき、一番近いノーツを叩けているかチェックする関数
    checkHit(laneType) {
        const children = this.notesGroup.getChildren();
        let closestNote = null;
        let minDistance = 999;

        // 今画面にあるノーツの中から「同じレーン」かつ「一番判定ラインに近い」ものを探す
        for (let i = 0; i < children.length; i++) {
            const note = children[i];
            if (note.laneType === laneType) {
                const dist = Math.abs(note.y - this.targetY);
                if (dist < minDistance) {
                    minDistance = dist;
                    closestNote = note;
                }
            }
        }

        // 一番近いノーツがあり、それが判定圏内（例えば距離60ピクセル以内）ならヒット！
        if (closestNote && minDistance < 60) {
            
            if (minDistance < 15) {
                this.judgeText.setText('PERFECT!!!').setColor('#00ff00');
                this.combo++;
                if (laneType === 2) this.gauge += 20; // ゲージノーツなら大幅チャージ
            } else if (minDistance < 35) {
                this.judgeText.setText('GOOD').setColor('#ffff00');
                this.combo++;
                if (laneType === 2) this.gauge += 10;
            } else {
                this.judgeText.setText('BAD').setColor('#ff8800');
                this.combo = 0;
            }

            // ゲージの最大値は100
            if (this.gauge >= 100) this.gauge = 100;

            // UI更新
            this.gaugeText.setText('ACTION GAUGE: ' + this.gauge + '%');
            this.comboText.setText('COMBO: ' + this.combo);

            // 叩いたノーツは消す！
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
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    audio: { disableWebAudio: false },
    scene: [BootScene, TitleScene, PlayScene]
};

const game = new Phaser.Game(config);
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
        // --- 📊 ステータス初期化 ---
        this.hp = 100;
        this.maxHp = 100; // 最大HPの制限用
        this.gauge = 0;
        this.combo = 0;

        // --- 📝 UIテキスト表示 ---
        this.hpText = this.add.text(20, 20, 'PLAYER HP: 100 / 100', { fontSize: '18px', fill: '#ff5555' });
        this.gaugeText = this.add.text(20, 50, 'ACTION GAUGE: 0%', { fontSize: '18px', fill: '#55ffff' });
        this.comboText = this.add.text(20, 80, 'COMBO: 0', { fontSize: '18px', fill: '#ffffff' });
        this.healTipText = this.add.text(20, 110, '[SPACE] HEAL (Req: 50%)', { fontSize: '14px', fill: '#888888' });
        this.judgeText = this.add.text(240, 120, 'READY?', { fontSize: '32px', fill: '#fff' });

        // --- 🛣️ 4レーンの設定（DFJK） ---
        // レーン0, 1 = 防御（敵ノーツ用）、レーン2, 3 = ゲージ（BFノーツ用）
        this.laneXs = [180, 260, 380, 460]; 
        this.targetY = 400; // 判定ライン（strumY）

        // 判定ラインの見た目（画像が入るまでは矩形）
        const colors = [0xff2222, 0xff7777, 0x77ffff, 0x22ffff];
        const keyNames = ['D(防)', 'F(防)', 'J(溜)', 'K(溜)'];
        for (let i = 0; i < 4; i++) {
            this.add.rectangle(this.laneXs[i], this.targetY, 60, 10, colors[i]);
            this.add.text(this.laneXs[i] - 15, this.targetY + 20, keyNames[i], { fontSize: '12px' });
        }

        // --- 📦 ノーツ管理グループ ---
        this.notesGroup = this.add.group();

        // --- 📊 FNF JSON譜面の高度な解析 ---
        const chartData = this.cache.json.get('fnfSong');
        this.songSpeed = chartData.song.speed || 3.3; 
        this.speedFactor = 0.45 * this.songSpeed;

        this.allNotesData = []; // ここに解析したノーツをまとめます

        if (chartData.song.notes && chartData.song.notes.length > 0) {
            chartData.song.notes.forEach(section => {
                const mustHitSection = section.mustHitSection; // BFのターンかどうかのフラグ
                
                if (section.sectionNotes) {
                    section.sectionNotes.forEach(noteData => {
                        const strumTime = noteData[0]; // ノーツの時間（ms）
                        const fnfLane = noteData[1];   // FNFのレーン（0〜7）

                        if (fnfLane < 0) return; // 有効外のデータはスキップ

                        // 💡 FNFの仕様に合わせた「敵」と「BF」の厳密な判定
                        let isBfNote = false;
                        
                        if (fnfLane >= 4) {
                            // レーン4〜7は、基本の向きとは「逆」のキャラクターのノーツ
                            isBfNote = mustHitSection ? false : true;
                        } else {
                            // レーン0〜3は、基本の向きのキャラクターのノーツ
                            isBfNote = mustHitSection ? true : false;
                        }

                        // 💡 敵のノーツか、BFのノーツかによって流すレーンを振り分ける
                        let myLaneIndex = 0;
                        if (isBfNote) {
                            // 【味方（BF）ノーツ】＝ 画面右側のゲージレーン（JキーかKキー：レーン2〜3）に割り当て
                            myLaneIndex = (fnfLane % 2 === 0) ? 2 : 3; 
                        } else {
                            // 【敵ノーツ】＝ 画面左側の防御レーン（DキーかFキー：レーン0〜1）に割り当て
                            myLaneIndex = (fnfLane % 2 === 0) === 0 ? 0 : 1;
                        }

                        this.allNotesData.push({
                            strumTime: strumTime,
                            lane: myLaneIndex,
                            isBfNote: isBfNote, // 後でミス時のペナルティ判定に使用
                            spawned: false
                        });
                    });
                }
            });
        }

        // 譜面データを時間順にソート
        this.allNotesData.sort((a, b) => a.strumTime - b.strumTime);

        // --- ⌨️ キーボード入力設定（DFJK ＋ スペースキー） ---
        this.keys = [
            this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
            this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F),
            this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.J),
            this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.K)
        ];
        this.keySpace = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

        // --- 🎧 楽曲再生 ---
        this.songAudio = this.sound.add('songAudio');
        this.songAudio.play();
    }

    update() {
        if (!this.songAudio.isPlaying) return;

        const songPosition = this.songAudio.seek * 1000; // Conductor.songPosition
        const lookAheadTime = this.targetY / this.speedFactor; // ノーツ先読み時間

        // 1. ノーツの出現チェック
        this.allNotesData.forEach(noteData => {
            if (!noteData.spawned && (noteData.strumTime - songPosition) < lookAheadTime) {
                // 通常は画像（sprite）、プロトタイプ用に円図形（赤：敵の攻撃、青：BFのゲージ）
                const color = (noteData.lane < 2) ? 0xff0000 : 0x00ffff;
                const noteSprite = this.add.circle(this.laneXs[noteData.lane], -50, 15, color);
                
                noteSprite.strumTime = noteData.strumTime;
                noteSprite.laneIndex = noteData.lane;
                noteSprite.isBfNote = noteData.isBfNote;

                this.notesGroup.add(noteSprite);
                noteData.spawned = true;
            }
        });

        // 2. 画面上のノーツの移動 ＆ 見逃し（MISS）判定
        const children = this.notesGroup.getChildren();
        for (let i = children.length - 1; i >= 0; i--) {
            const note = children[i];
            const distance = (note.strumTime - songPosition) * this.speedFactor;
            note.y = this.targetY - distance;

            // 判定ラインを通り過ぎて160ms以上遅れたら自動MISS
            if (note.strumTime - songPosition < -160) {
                // 敵の攻撃（防御ノーツ）を見逃したときだけ大ダメージ！
                if (!note.isBfNote) {
                    this.hp -= 12; // ダメージ量
                    if (this.hp < 0) this.hp = 0;
                    this.hpText.setText(`PLAYER HP: ${this.hp} / ${this.maxHp}`);
                    this.judgeText.setText('MISS! ダメージ').setColor('#ff0000');
                } else {
                    // 自キャラのノーツ（ゲージノーツ）はスルーしてもノーダメージ
                    this.judgeText.setText('MISS').setColor('#888888');
                }
                this.combo = 0;
                this.comboText.setText('COMBO: ' + this.combo);
                note.destroy();
            }
        }

        // 3. プレイヤーのノーツ入力判定（DFJK）
        for (let i = 0; i < 4; i++) {
            if (Phaser.Input.Keyboard.JustDown(this.keys[i])) {
                this.checkHit(i, songPosition);
            }
        }

        // 4. 💡 スペースキーでの回復処理
        // ゲージが50以上、かつ現在のHPが最大HP未満のときに発動可能
        if (this.gauge >= 50 && this.hp < this.maxHp) {
            this.healTipText.setText('[SPACE] HEAL READY! (可)').setColor('#00ff00');
            
            if (Phaser.Input.Keyboard.JustDown(this.keySpace)) {
                this.gauge -= 50; // ゲージを50消費
                this.hp += 25;   // HPを25回復
                
                // ★最大HP（100）を超えないように制限
                if (this.hp > this.maxHp) {
                    this.hp = this.maxHp;
                }

                // UIの更新
                this.hpText.setText(`PLAYER HP: ${this.hp} / ${this.maxHp}`);
                this.gaugeText.setText('ACTION GAUGE: ' + this.gauge + '%');
                this.judgeText.setText('CURE! 回復成功').setColor('#00ffbb');
            }
        } else {
            // 条件を満たしていない時はテキストを暗くしておく
            if (this.hp >= this.maxHp) {
                this.healTipText.setText('[SPACE] HP MAX').setColor('#888888');
            } else {
                this.healTipText.setText('[SPACE] HEAL (Req: 50%)').setColor('#888888');
            }
        }

        // ゲームオーバー判定
        if (this.hp <= 0) {
            this.judgeText.setText('GAME OVER').setColor('#ff0000');
            this.songAudio.stop();
            this.scene.pause();
        }
    }

    // 🕒 ミリ秒ズレ判定処理
    checkHit(laneIndex, songPosition) {
        const children = this.notesGroup.getChildren();
        let closestNote = null;
        let minDiff = 99999;

        for (let i = 0; i < children.length; i++) {
            const note = children[i];
            if (note.laneIndex === laneIndex) {
                const diff = Math.abs(note.strumTime - songPosition);
                if (diff < minDiff) {
                    minDiff = diff;
                    closestNote = note;
                }
            }
        }

        if (closestNote && minDiff < 160) {
            if (minDiff <= 45) { // PERFECT (SICK)
                this.judgeText.setText('PERFECT!!!').setColor('#00ff00');
                this.combo++;
                // ゲージレーン（2 or 3）を叩いた時のみゲージ増加
                if (laneIndex >= 2) this.gauge += 15;
            } else if (minDiff <= 90) { // GOOD
                this.judgeText.setText('GOOD').setColor('#ffff00');
                this.combo++;
                if (laneIndex >= 2) this.gauge += 8;
            } else { // BAD
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
// ==========================================
// 1. 各シーンのクラス定義
// ==========================================

// --- 📦 アセット読み込みシーン ---
class BootScene extends Phaser.Scene {
    constructor() { super('BootScene'); }
    
    preload() {
        // 📊 FNFのJSON譜面データを読み込み
        this.load.json('fnfSong', 'assets/untold-loneliness-hard.json'); 
        
        // 🎧 音楽ファイルを読み込み（ファイルがなくてもエラーで止まらないようにPlayScene側でガードします）
        this.load.audio('songAudio', 'assets/untold.mp3'); 
    }
    
    create() { 
        this.scene.start('TitleScene'); 
    }
}

// --- 🎮 タイトル画面シーン ---
class TitleScene extends Phaser.Scene {
    constructor() { super('TitleScene'); }
    
    create() {
        this.add.text(180, 200, '4-LANE RHYTHM RPG\n\nCLICK TO START', { 
            fill: '#ffffff', 
            fontSize: '32px', 
            align: 'center' 
        });
        
        // 画面クリックで本番（PlayScene）へ進む
        this.input.on('pointerdown', () => this.scene.start('PlayScene'));
    }
}

// --- 🔥 音ゲー本番画面シーン ---
class PlayScene extends Phaser.Scene {
    constructor() { super('PlayScene'); }

    create() {
        // --- 📊 プレイヤーのステータス初期化 ---
        this.hp = 100;
        this.maxHp = 100; 
        this.gauge = 0;   
        this.combo = 0;

        // --- 📝 UIテキスト表示 ---
        this.hpText = this.add.text(20, 20, 'PLAYER HP: 100 / 100', { fontSize: '18px', fill: '#ff5555' });
        this.gaugeText = this.add.text(20, 50, 'ACTION GAUGE: 0%', { fontSize: '18px', fill: '#55ffff' });
        this.comboText = this.add.text(20, 80, 'COMBO: 0', { fontSize: '18px', fill: '#ffffff' });
        this.healTipText = this.add.text(20, 110, '[SPACE] HEAL (Req: 50%)', { fontSize: '14px', fill: '#888888' });
        this.judgeText = this.add.text(240, 120, 'READY?', { fontSize: '32px', fill: '#ffffff' });

        // --- 🛣️ 4レーンの設定（DFJKの並び） ---
        this.laneXs = [180, 260, 380, 460]; 
        this.targetY = 400; 

        // 判定ラインの見た目（矩形）
        const colors = [0xff2222, 0xff7777, 0x77ffff, 0x22ffff];
        const keyNames = ['D(防)', 'F(防)', 'J(溜)', 'K(溜)'];
        for (let i = 0; i < 4; i++) {
            this.add.rectangle(this.laneXs[i], this.targetY, 60, 10, colors[i]);
            this.add.text(this.laneXs[i] - 15, this.targetY + 20, keyNames[i], { fontSize: '12px' });
        }

        // --- 📦 ノーツ管理グループ ---
        this.notesGroup = this.add.group();

        // 初期値
        this.songSpeed = 3.3;
        this.allNotesData = [];

        // --- 📊 FNF JSON譜面の解析 ---
        try {
            const chartData = this.cache.json.get('fnfSong');
            
            if (chartData) {
                const songData = chartData.song ? chartData.song : chartData;
                this.songSpeed = songData.speed || 3.3; 

                if (songData.notes && songData.notes.length > 0) {
                    songData.notes.forEach(section => {
                        if (!section || !section.sectionNotes) return;

                        const mustHitSection = section.mustHitSection; 
                        
                        section.sectionNotes.forEach(noteData => {
                            if (!noteData || noteData.length < 2) return;

                            const strumTime = parseFloat(noteData[0]); 
                            const fnfLane = parseInt(noteData[1], 10); 

                            if (isNaN(strumTime) || isNaN(fnfLane) || fnfLane < 0) return;

                            // 💡 敵・味方ノーツの分離
                            let isBfNote = false;
                            if (mustHitSection) {
                                isBfNote = (fnfLane < 4);
                            } else {
                                isBfNote = (fnfLane >= 4);
                            }

                            // 💡 4レーン（DFJK）への圧縮割り当て
                            let myLaneIndex = 0;
                            const rawLane = fnfLane % 4; 

                            if (isBfNote) {
                                myLaneIndex = (rawLane === 0 || rawLane === 1) ? 2 : 3;
                            } else {
                                myLaneIndex = (rawLane === 0 || rawLane === 1) ? 0 : 1;
                            }

                            this.allNotesData.push({
                                strumTime: strumTime,
                                lane: myLaneIndex,
                                isBfNote: isBfNote,
                                spawned: false
                            });
                        });
                    });
                }
            }
        } catch (error) {
            console.error("JSON解析エラー:", error);
        }

        // 譜面データを時間の早い順にソート
        this.allNotesData.sort((a, b) => a.strumTime - b.strumTime);
        this.speedFactor = 0.45 * this.songSpeed;

        // --- ⌨️ キーボード入力設定（DFJK ＋ スペースキー） ---
        this.keys = [
            this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
            this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F),
            this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.J),
            this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.K)
        ];
        this.keySpace = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

        // --- 🎧 【重要】ここを完全安全化しました ---
        this.useDummyTimer = true; // デフォルトで自前タイマーを使用する（絶対に止まらないようにする）
        this.dummyTime = 0;
        this.songAudio = null;

        // オーディオの追加と再生を完全に別枠で囲み、失敗してもゲームが絶対に止まらないようにガード
        try {
            if (this.sound.keys.hasOwnProperty('songAudio') || this.cache.audio.exists('songAudio')) {
                this.songAudio = this.sound.add('songAudio');
                this.songAudio.play();
                this.useDummyTimer = false; // 再生に成功したら実曲タイマーに切り替え
                console.log("音楽の再生に成功しました。楽曲同期モードで動きます。");
            }
        } catch (e) {
            console.warn("オーディオの再生に失敗したか、ファイルがありません。無音デバッグモードで動きます。", e);
            this.useDummyTimer = true;
        }
    }

    update(time, delta) {
        // 曲の位置（ミリ秒）を取得
        let songPosition = 0;
        
        if (this.useDummyTimer || !this.songAudio || !this.songAudio.isPlaying) {
            this.dummyTime += delta;
            songPosition = this.dummyTime;
        } else {
            songPosition = this.songAudio.seek * 1000; 
        }

        // 「READY?」の文字を最初の3秒間（3000ms）だけ表示し、過ぎたら消す（またはSTART!にする）
        if (songPosition > 2000) {
            if (songPosition < 3500) {
                this.judgeText.setText('START!').setColor('#00ff00');
            } else if (this.judgeText.text === 'START!') {
                this.judgeText.setText(''); // 文字を消す
            }
        }

        const lookAheadTime = this.targetY / this.speedFactor; 

        // 1. ノーツの出現チェック
        this.allNotesData.forEach(noteData => {
            if (!noteData.spawned && (noteData.strumTime - songPosition) < lookAheadTime) {
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

            if (note.strumTime - songPosition < -160) {
                if (!note.isBfNote) {
                    this.hp -= 12; 
                    if (this.hp < 0) this.hp = 0;
                    this.hpText.setText(`PLAYER HP: ${this.hp} / ${this.maxHp}`);
                    this.judgeText.setText('MISS! ダメージ').setColor('#ff0000');
                } else {
                    this.judgeText.setText('MISS').setColor('#888888');
                }
                this.combo = 0;
                this.comboText.setText('COMBO: ' + this.combo);
                note.destroy();
            }
        }

        // 3. プレイヤーのキー入力判定（DFJK）
        for (let i = 0; i < 4; i++) {
            if (Phaser.Input.Keyboard.JustDown(this.keys[i])) {
                this.checkHit(i, songPosition);
            }
        }

        // 4. スペースキーでの回復処理
        if (this.gauge >= 50 && this.hp < this.maxHp) {
            this.healTipText.setText('[SPACE] HEAL READY! (可)').setColor('#00ff00');
            
            if (Phaser.Input.Keyboard.JustDown(this.keySpace)) {
                this.gauge -= 50; 
                this.hp += 25;   
                if (this.hp > this.maxHp) this.hp = this.maxHp;

                this.hpText.setText(`PLAYER HP: ${this.hp} / ${this.maxHp}`);
                this.gaugeText.setText('ACTION GAUGE: ' + this.gauge + '%');
                this.judgeText.setText('CURE! 回復成功').setColor('#00ffbb');
            }
        } else {
            if (this.hp >= this.maxHp) {
                this.healTipText.setText('[SPACE] HP MAX').setColor('#888888');
            } else {
                this.healTipText.setText('[SPACE] HEAL (Req: 50%)').setColor('#888888');
            }
        }

        // ゲームオーバー判定
        if (this.hp <= 0) {
            this.judgeText.setText('GAME OVER').setColor('#ff0000');
            if (this.songAudio) {
                try { this.songAudio.stop(); } catch(e){}
            }
            this.scene.pause();
        }
    }

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
            if (minDiff <= 45) { 
                this.judgeText.setText('PERFECT!!!').setColor('#00ff00');
                this.combo++;
                if (laneIndex >= 2) this.gauge += 15; 
            } else if (minDiff <= 90) { 
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
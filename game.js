// ==========================================
// 1. 各シーンのクラス定義
// ==========================================

// --- 📦 アセット読み込みシーン ---
class BootScene extends Phaser.Scene {
    constructor() { super('BootScene'); }
    
    preload() {
        // 📊 FNFのJSON譜面データを読み込み
        this.load.json('fnfSong', 'assets/untold-loneliness-hard.json'); 
        // 🎧 音楽ファイルを読み込み
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
        // 1280x720の画面に合わせて中央寄りに配置
        this.add.text(420, 300, '4-LANE RHYTHM RPG\n\nCLICK TO START', { 
            fill: '#ffffff', 
            fontSize: '48px', 
            align: 'center' 
        });
        
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

        // --- 📝 UIテキスト表示（1280x720用に配置を調整） ---
        this.hpText = this.add.text(50, 40, 'PLAYER HP: 100 / 100', { fontSize: '24px', fill: '#ff5555', fontStyle: 'bold' });
        this.gaugeText = this.add.text(50, 80, 'ACTION GAUGE: 0%', { fontSize: '24px', fill: '#55ffff', fontStyle: 'bold' });
        this.comboText = this.add.text(50, 120, 'COMBO: 0', { fontSize: '24px', fill: '#ffffff', fontStyle: 'bold' });
        this.healTipText = this.add.text(50, 160, '[SPACE] HEAL (Req: 50%)', { fontSize: '18px', fill: '#888888' });
        
        // 現在が「防御」か「チャージ」か一目でわかるモード表示を追加
        this.modeText = this.add.text(540, 100, 'READY?', { fontSize: '40px', fill: '#ffffff', fontStyle: 'bold' });
        this.judgeText = this.add.text(580, 200, '', { fontSize: '36px', fill: '#ffffff' });

        // --- 🛣️ 4レーンの設定（DFJKを画面中央付近に配置） ---
        // 1280のセンター付近（500〜700pxあたり）に綺麗に並べます
        this.laneXs = [480, 560, 660, 740]; 
        this.targetY = 600; // 判定ラインの高さ（高さ720pxの画面なので下寄りの600pxへ配置）

        // 判定ラインの見た目（矩形）
        const colors = [0xff2222, 0xff7777, 0x77ffff, 0x22ffff];
        const keyNames = ['D', 'F', 'J', 'K'];
        for (let i = 0; i < 4; i++) {
            this.add.rectangle(this.laneXs[i], this.targetY, 65, 12, colors[i]);
            this.add.text(this.laneXs[i] - 10, this.targetY + 25, keyNames[i], { fontSize: '18px', fontStyle: 'bold' });
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

                        const mustHitSection = section.mustHitSection; // trueならBFターン、falseなら敵ターン
                        
                        section.sectionNotes.forEach(noteData => {
                            if (!noteData || noteData.length < 2) return;

                            const strumTime = parseFloat(noteData[0]); 
                            const fnfLane = parseInt(noteData[1], 10); 

                            if (isNaN(strumTime) || isNaN(fnfLane) || fnfLane < 0) return;

                            // 💡 FNFのフォーマットから、そのノートが「現在カメラが向いている側」のものかを判別
                            let isSectionOwnerNote = false;
                            if (mustHitSection) {
                                isSectionOwnerNote = (fnfLane < 4); // BFターンの時にBFが叩くノーツ
                            } else {
                                isSectionOwnerNote = (fnfLane >= 4); // 敵ターンの時に敵が叩くノーツ
                            }

                            // カメラの向きとノートの持ち主が一致しているものだけを、プレイヤーがDFJKで打つべきノーツとして採用
                            if (isSectionOwnerNote) {
                                const rawLane = fnfLane % 4; // 0,1,2,3(左,下,上,右)をそのままDFJK(0,1,2,3)にマップ
                                
                                this.allNotesData.push({
                                    strumTime: strumTime,
                                    lane: rawLane,            // プレイヤーは常に割り当てられたDFJKで打つ
                                    isBfTurn: mustHitSection, // セクションごとのターン状態をノーツに持たせる
                                    spawned: false
                                });
                            }
                        });
                    });
                }
            }
        } catch (error) {
            console.error("JSON解析エラー:", error);
        }

        // 譜面データを時間の早い順にソート
        this.allNotesData.sort((a, b) => a.strumTime - b.strumTime);
        
        // 🔽 提示されたスクロールスピード計算式（0.45 * songSpeed）をそのまま適用！
        this.speedFactor = 0.45 * this.songSpeed;

        // --- ⌨️ キーボード入力設定（DFJK ＋ スペースキー） ---
        this.keys = [
            this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
            this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F),
            this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.J),
            this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.K)
        ];
        this.keySpace = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

        // --- 🎧 オーディオ再生 ＆ 安全対策 ---
        this.useDummyTimer = true; 
        this.dummyTime = 0;
        this.songAudio = null;

        try {
            if (this.sound.keys.hasOwnProperty('songAudio') || this.cache.audio.exists('songAudio')) {
                this.songAudio = this.sound.add('songAudio');
                this.songAudio.play();
                this.useDummyTimer = false; 
            }
        } catch (e) {
            this.useDummyTimer = true;
        }
    }

    update(time, delta) {
        let songPosition = 0;
        if (this.useDummyTimer || !this.songAudio || !this.songAudio.isPlaying) {
            this.dummyTime += delta;
            songPosition = this.dummyTime;
        } else {
            songPosition = this.songAudio.seek * 1000; 
        }

        // スタート演出用
        if (songPosition < 2000) {
            this.modeText.setText('READY?').setColor('#ffffff');
        }

        // 🔽 画面外の上端(Y=0)から判定ライン(Y=600)まで降りてくるのにかかる時間を逆算
        const lookAheadTime = this.targetY / this.speedFactor; 

        // 1. ノーツの出現チェック
        this.allNotesData.forEach(noteData => {
            if (!noteData.spawned && (noteData.strumTime - songPosition) < lookAheadTime) {
                // 💡 敵のターン(isBfTurn=false)なら赤色の防御ノーツ、味方のターンなら青色のチャージノーツ
                const color = noteData.isBfTurn ? 0x00ffff : 0xff0000;
                const noteSprite = this.add.circle(this.laneXs[noteData.lane], -50, 20, color); // 画面が広いのでサイズを少し大きく(20)
                
                noteSprite.strumTime = noteData.strumTime;
                noteSprite.laneIndex = noteData.lane;
                noteSprite.isBfTurn = noteData.isBfTurn;

                this.notesGroup.add(noteSprite);
                noteData.spawned = true;
            }
        });

        // 2. 画面上のノーツの移動 ＆ 見逃し（MISS）判定
        const children = this.notesGroup.getChildren();
        
        // 現在流れているノーツを基準に、画面中央のモードテキストをリアルタイム更新
        if (children.length > 0) {
            const nextNote = children[0];
            if (nextNote.isBfTurn) {
                this.modeText.setText('【BF TURN】CHARGE!').setColor('#00ffff');
            } else {
                this.modeText.setText('【ENEMY TURN】DEFEND!').setColor('#ff3333');
            }
        }

        for (let i = children.length - 1; i >= 0; i--) {
            const note = children[i];
            
            // 🔽 提示されたスクロール位置の計算式をそのまま適用
            const distance = (note.strumTime - songPosition) * this.speedFactor;
            note.y = this.targetY - distance;

            // 判定ラインをスルーして160ms以上遅れたら自動的にMISS
            if (note.strumTime - songPosition < -160) {
                if (!note.isBfTurn) {
                    // 🔴 敵ターンのノーツ（防御）を見逃したら大ダメージ！
                    this.hp -= 12; 
                    if (this.hp < 0) this.hp = 0;
                    this.hpText.setText(`PLAYER HP: ${this.hp} / ${this.maxHp}`);
                    this.judgeText.setText('MISS! ダメージ').setColor('#ff0000');
                } else {
                    // 🔵 味方ターン（チャージ）のノーツは見逃してもノーダメージ
                    this.judgeText.setText('MISS').setColor('#888888');
                }
                this.combo = 0;
                this.comboText.setText('COMBO: ' + this.combo);
                note.destroy();
            }
        }

        // 3. プレイヤーのキー入力判定（DFJKでどちらのノーツも打てる）
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
            this.modeText.setText('GAME OVER').setColor('#ff0000');
            this.judgeText.setText('');
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
            if (minDiff <= 45) { // PERFECT
                this.judgeText.setText('PERFECT!!!').setColor('#00ff00');
                this.combo++;
                // 🔵 BFのターン中（チャージノーツ）のみ、成功時に行動ゲージがプラスされる
                if (closestNote.isBfTurn) this.gauge += 15; 
            } else if (minDiff <= 90) { // GOOD
                this.judgeText.setText('GOOD').setColor('#ffff00');
                this.combo++;
                if (closestNote.isBfTurn) this.gauge += 8;
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
    width: 1280,        // 👈 新しい本家サイズに適応
    height: 720,       // 👈 新しい本家サイズに適応
    backgroundColor: "#111111",
    pixelArt: true,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    audio: { disableWebAudio: false },
    scene: [BootScene, TitleScene, PlayScene]
};

const game = new Phaser.Game(config);
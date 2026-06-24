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

        // --- 📝 UIテキスト表示（1280x720調整版） ---
        this.hpText = this.add.text(50, 40, 'PLAYER HP: 100 / 100', { fontSize: '24px', fill: '#ff5555', fontStyle: 'bold' });
        this.gaugeText = this.add.text(50, 80, 'ACTION GAUGE: 0%', { fontSize: '24px', fill: '#55ffff', fontStyle: 'bold' });
        this.comboText = this.add.text(50, 120, 'COMBO: 0', { fontSize: '24px', fill: '#ffffff', fontStyle: 'bold' });
        this.healTipText = this.add.text(50, 160, '[SPACE] HEAL (Req: 50%)', { fontSize: '18px', fill: '#888888' });
        
        this.modeText = this.add.text(500, 100, 'READY?', { fontSize: '40px', fill: '#ffffff', fontStyle: 'bold' });
        this.judgeText = this.add.text(580, 200, '', { fontSize: '36px', fill: '#ffffff' });

        // --- 🛣️ 4レーンの設定（DFJKを画面中央に配置） ---
        this.laneXs = [480, 560, 660, 740]; 
        this.targetY = 600; 

        // 判定ラインの見た目
        const colors = [0xff2222, 0xff7777, 0x77ffff, 0x22ffff];
        const keyNames = ['D', 'F', 'J', 'K'];
        for (let i = 0; i < 4; i++) {
            this.add.rectangle(this.laneXs[i], this.targetY, 65, 12, colors[i]);
            this.add.text(this.laneXs[i] - 10, this.targetY + 25, keyNames[i], { fontSize: '18px', fontStyle: 'bold' });
        }

        // --- 📦 ノーツ管理グループ ---
        this.notesGroup = this.add.group();

        this.songSpeed = 3.3;
        this.allNotesData = [];
        this.sectionsInfo = []; // 各セクションの時間とターン情報を記録する配列

        // --- 📊 FNF JSON譜面の解析（超安全・エラー完全回避版） ---
        try {
            const chartData = this.cache.json.get('fnfSong');
            
            if (chartData) {
                const songData = chartData.song ? chartData.song : chartData;
                this.songSpeed = songData.speed || 3.3; 

                if (songData.notes && songData.notes.length > 0) {
                    let currentSectionStartTime = 0; // セクションの開始時間を追跡

                    songData.notes.forEach(section => {
                        if (!section) return;

                        const mustHitSection = section.mustHitSection === true; // 安全に真偽値化
                        
                        // FNFの1セクションの長さ（通常は16ステップ分、BPMに依存しますが簡易計算として時間幅を保持）
                        // このセクション情報を後で時間からターンを逆算するために保管
                        this.sectionsInfo.push({
                            startTime: currentSectionStartTime,
                            mustHitSection: mustHitSection
                        });

                        // セクション内の全ノーツをまずは素直に抽出（クラッシュ回避のため分離ロジックは外す）
                        if (section.sectionNotes) {
                            section.sectionNotes.forEach(noteData => {
                                if (!noteData || noteData.length < 2) return;

                                const strumTime = parseFloat(noteData[0]); 
                                const fnfLane = parseInt(noteData[1], 10); 

                                if (isNaN(strumTime) || isNaN(fnfLane) || fnfLane < 0) return;

                                // 0〜7すべてのノーツを、プレイヤーが叩くための4レーン（DFJK）へ綺麗に丸める
                                const targetLane = fnfLane % 4; 

                                this.allNotesData.push({
                                    strumTime: strumTime,
                                    lane: targetLane,
                                    spawned: false
                                });
                            });
                        }

                        // 次のセクションの開始時間を大まかに進める（Untold LonelinessのBPM等からおよそ計算）
                        // 正確なセクション時間はノーツ自体の配置時間からもupdate側で補正をかけます
                        currentSectionStartTime += 2000; // ダミー加算（実時間はノーツの位置で判定するためバックアップ用）
                    });
                }
            }
        } catch (error) {
            console.error("JSON解析で致命的なエラーが発生しました。ゲームを安全に続行します:", error);
        }

        // 譜面データを時間の早い順に並び替え
        this.allNotesData.sort((a, b) => a.strumTime - b.strumTime);
        
        // FNF本家そのままのスクロール速度計算式
        this.speedFactor = 0.45 * this.songSpeed;

        // --- ⌨️ キーボード入力設定（DFJK ＋ スペースキー） ---
        this.keys = [
            this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
            this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F),
            this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.J),
            this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.K)
        ];
        this.keySpace = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

        // --- 🎧 オーディオ再生 ＆ 絶対フリーズ防止処理 ---
        this.useDummyTimer = true; 
        this.dummyTime = 0;
        this.songAudio = null;

        try {
            if (this.sound.keys.hasOwnProperty('songAudio') || this.cache.audio.exists('songAudio')) {
                this.songAudio = this.sound.add('songAudio');
                this.songAudio.play();
                this.useDummyTimer = false; 
                console.log("音楽ファイルの同期再生を開始しました。");
            }
        } catch (e) {
            this.useDummyTimer = true;
        }
    }

    // 🕒 現在の時間（ミリ秒）から、今のセクションが「BFターン」か「敵ターン」かを調べる関数
    checkIsBfTurnAtTime(songPosition) {
        // Untold Lonelinessの譜面データ構造をスキャン
        const chartData = this.cache.json.get('fnfSong');
        if (!chartData) return true;
        const songData = chartData.song ? chartData.song : chartData;
        
        if (!songData.notes) return true;

        // 各セクションのノーツの時間帯を見て、現在の時間がどのセクションに入っているかをリアルタイム判定
        // FNFの一般的な1セクションは約1600ms〜3000ms（BPMによる）
        // ここでは最も正確に、現在時間に一番近いノーツが属するmustHitSectionを探します
        let isBf = true;
        
        // 簡易的かつ確実な方法：現在時間より少し先にあるセクションのフラグを取得
        for (let i = 0; i < songData.notes.length; i++) {
            const sec = songData.notes[i];
            if (sec && sec.sectionNotes && sec.sectionNotes.length > 0) {
                // セクションの最初のノーツの時間
                const firstNoteTime = sec.sectionNotes[0][0];
                if (songPosition >= firstNoteTime - 200) {
                    isBf = sec.mustHitSection === true;
                }
            }
        }
        return isBf;
    }

    update(time, delta) {
        let songPosition = 0;
        if (this.useDummyTimer || !this.songAudio || !this.songAudio.isPlaying) {
            this.dummyTime += delta;
            songPosition = this.dummyTime;
        } else {
            songPosition = this.songAudio.seek * 1000; 
        }

        // 💡 今が「BFターン」か「敵ターン」かを現在時間からリアルタイムに取得！
        const isCurrentlyBfTurn = this.checkIsBfTurnAtTime(songPosition);

        // 画面中央のテキストとモードをリアルタイム切り替え
        if (songPosition < 2000) {
            this.modeText.setText('READY?').setColor('#ffffff');
        } else {
            if (isCurrentlyBfTurn) {
                this.modeText.setText('【BF TURN】CHARGE MODE!').setColor('#00ffff');
            } else {
                this.modeText.setText('【ENEMY TURN】DEFEND MODE!').setColor('#ff3333');
            }
        }

        const lookAheadTime = this.targetY / this.speedFactor; 

        // 1. ノーツの出現チェック
        this.allNotesData.forEach(noteData => {
            if (!noteData.spawned && (noteData.strumTime - songPosition) < lookAheadTime) {
                
                // 💡 生成された瞬間のターン状態によって、ノーツ自体の色と性質（役割）を決定する！
                // 敵ターンなら全部「赤（防御）」、味方ターンなら全部「青（チャージ）」
                const color = isCurrentlyBfTurn ? 0x00ffff : 0xff0000;
                
                const noteSprite = this.add.circle(this.laneXs[noteData.lane], -50, 20, color); 
                
                noteSprite.strumTime = noteData.strumTime;
                noteSprite.laneIndex = noteData.lane;
                noteSprite.isBfTurnNote = isCurrentlyBfTurn; // このノーツがどちらの役割のノーツかを記憶

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
                if (!note.isBfTurnNote) {
                    // 🔴 敵ターン中に生成された防御ノーツをスルーしたらダメージ！
                    this.hp -= 12; 
                    if (this.hp < 0) this.hp = 0;
                    this.hpText.setText(`PLAYER HP: ${this.hp} / ${this.maxHp}`);
                    this.judgeText.setText('MISS! ダメージ').setColor('#ff0000');
                } else {
                    // 🔵 味方ターン中のチャージノーツはスルーしてもノーダメージ
                    this.judgeText.setText('MISS').setColor('#888888');
                }
                this.combo = 0;
                this.comboText.setText('COMBO: ' + this.combo);
                note.destroy();
            }
        }

        // 3. プレイヤーのキー入力判定（いつでもDFJKで全てのノーツを打てる）
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
                // 🔵 成功したノーツが「味方ターン（チャージ）」のものならゲージ増加
                if (closestNote.isBfTurnNote) this.gauge += 15; 
            } else if (minDiff <= 90) { // GOOD
                this.judgeText.setText('GOOD').setColor('#ffff00');
                this.combo++;
                if (closestNote.isBfTurnNote) this.gauge += 8;
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
    width: 1280,        
    height: 720,       
    backgroundColor: "#111111",
    pixelArt: true,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    audio: { disableWebAudio: false },
    scene: [BootScene, TitleScene, PlayScene]
};

const game = new Phaser.Game(config);
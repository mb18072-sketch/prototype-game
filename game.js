const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    scene: {
        preload: preload,
        create: create
    }
};

const game = new Phaser.Game(config);

function preload() {
    // 同じ場所にある data.json を読み込む
    this.load.json('gameData', 'data.json');
}

function create() {
    const myData = this.cache.json.get('gameData');
    this.add.text(100, 100, 'JSONテスト: ' + myData.message, { fill: '#0f0', fontSize: '32px' });
}
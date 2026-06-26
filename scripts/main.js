import { 
    BootScene, 
    TitleScene, 
    MainMenuScene, 
    OptionScene, 
    BattleSelectScene, 
    PlayScene, 
    EditorScene 
} from "./scenes.js";

window.addEventListener("DOMContentLoaded", async () => {
    await document.fonts.load('16px "Determination"');
    await document.fonts.load('16px "JF東雲ゴシック"');
    await document.fonts.ready;

    const config = {
        type: Phaser.WEBGL,
        width: 640,
        height: 480,
        parent: "game",
        backgroundColor: "#000000",

        pixelArt: true,

        scale: {
            mode: Phaser.Scale.FIT,
            autoCenter: Phaser.Scale.CENTER_BOTH
        },

        physics: {
            default: "matter",
            matter: {
                gravity: { y:  },
                debug: false
            }
        },

        scene: [
            BootScene,
            TitleScene,
            MainMenuScene,
            OptionScene,
            BattleSelectScene,
            PlayScene,
            EditorScene
               ]
    };

    new Phaser.Game(config);
});
export class MenuCursor {
    constructor({
        rows = 1,
        cols = 1,
        loop = true
    }) {
        this.rows = rows;
        this.cols = cols;
        this.loop = loop;

        this.row = 0;
        this.col = 0;
    }

    move (dx,dy) {
        let r = this.row + dy;
        let c = this.col + dx;

        if (this.loop) {
            r = (r + this.rows) % this.rows;
            c = (c + this.cols) % this.cols;
        } else {
            r = Phaser.Math.Clamp(r,0,this.rows-1);
            c = Phaser.Math.Clamp(c,0,this.cols-1);
        }

        this.row = r;
        this.col = c;
    }

    get index() {
        return this.row * this.cols + this.col;
    }
}

export class BattleCard extends Phaser.GameObjects.Container {
    constructor(scene,x,y,battleData,type,objects = {}) {
        super(scene,x,y);

        this.baseX = x;
        this.battleData = battleData;
        this.type = type;
        this.objects = objects;
        this.arrayObjects = Object.values(objects);

        for (const key in objects) {
            this.add(objects[key]);

            objects[key].x = 0;
            objects[key].y = 0;
        }

        if (this.type === "preview") {
            this.setSize(this.objects.text.width,
                         this.objects.text.height);
            this.objects.icon.y = 240-this.y;
            this.objects.icon.x = 480;
            this.objects.icon.scale = 1.3;
        } else {
            this.setSize(168, 168);
        }
    }

    UIUpdate(selected = false) {
        if (this.type === "preview") {
            this.objects.text.setTint(selected ? 0xffff33 : 0xffffff);
            this.objects.icon.setVisible(selected);
        } else {
            this.objects.border.setFillStyle(selected ? 0xffff33 : 0xffffff);
            if (selected) {
                this.objects.icon.clearTint();
            } else {
                this.objects.icon.setTintFill(0xffffff);
            }
        }
    }
}
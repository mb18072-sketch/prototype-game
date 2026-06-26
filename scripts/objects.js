export class UndertaleObject extends Phaser.Physics.Matter.Sprite {
    constructor(scene, x, y, texture, depth = 200) {
        super(scene.matter.world, x, y, texture);

        scene.add.existing(this);
        scene.updateables.push(this);

        this.applyCustomPhysics();
        this.setDepth(depth);

        this.input = scene.inputManager;
        this.sound = scene.soundManager;
        this.assets = scene.assets;

        this.anchorX = x;
        this.anchorY = y;

        this.offsetX = 0;
        this.offsetY = 0;
    }

    applyCustomPhysics() {
        this.setFixedRotation();
        this.setFrictionAir(0);
        this.setSensor(true);
        this.setIgnoreGravity(true);
        this.setBounce(0);
        this.setFriction(0);
    }

    destroy(fromScene) {
        if (this.scene && this.scene.updateables) {
            this.scene.updateables =
                this.scene.updateables.filter(obj => obj !== this);
        }

        super.destroy(fromScene);
    }

    setOffset(x, y) {
        this.offsetX = x;
        this.offsetY = y;

        this.updatePosition();
    }

    setAnchor(x, y) {
        this.anchorX = x;
        this.anchorY = y;

        this.updatePosition();
    }

    updatePosition() {
        const rad = Phaser.Math.DegToRad(this.angle);

        const x =
            this.anchorX +
            this.offsetX * Math.cos(rad) -
            this.offsetY * Math.sin(rad);

        const y =
            this.anchorY +
            this.offsetX * Math.sin(rad) +
            this.offsetY * Math.cos(rad);

        this.setPosition(x,y);
    }

    setAngle(angle) {
        super.setAngle(angle);
        this.updatePosition();
        return this;
    }

    getAnchorPosition() {
        return {
            x: this.anchorX,
            y: this.anchorY
        };
    }

    update0(time, delta) {}
    update1(time, delta) {}
    update2(time, delta) {}
}

export class Board extends Phaser.GameObjects.Graphics {
    constructor(scene,x,y,width,height) {
        super(scene,{x: x+0.5,y: y+0.5});

        scene.add.existing(this);
        scene.updateables.push(this);

        this.w = width;
        this.h = height;
        this.lineThickness = 5;
        this.setDepth(depth.battle.board);

        this.updateHalfSize();

        this.draw();

        this.maskGraphics = scene.make.graphics({
            x: x,
            y: y,
            add: false
        });

        this.maskGraphics.fillStyle(0xffffff);
        this.maskGraphics.fillRect(
            -this.w/2,
            -this.h/2,
            this.w,
            this.h
        );

        this.innerMask = this.maskGraphics.createGeometryMask();
    }

    updateHalfSize() {
        this.hw = this.w / 2;
        this.hh = this.h / 2;
    }

    draw() {
        this.clear();

        this.fillStyle(0x000000,1);
        this.fillRect(-this.w / 2,-this.h / 2,this.w,this.h);

        this.lineStyle(this.lineThickness,0x000000,1);
        this.strokeRect(-(this.w + this.lineThickness) / 2, -(this.h + this.lineThickness) / 2,this.w + this.lineThickness,this.h + this.lineThickness);

        this.lineStyle(this.lineThickness,0xffffff,1);
        this.strokeRect(-this.w / 2,-this.h / 2,this.w,this.h);
    }

    resize(w,h) {
        this.w = w;
        this.h = h;
        this.updateHalfSize();
        this.draw();
    }

    update0(time,delta) {}

    update1(time,delta) {}

    update2(time,delta) {}
}

export class Soul extends UndertaleObject {
    constructor(scene,x,y,board,color=0xffffff) {
        super(scene,x,y,"assets/images/soul/soul",depth.battle.soul);

        this.setTint(color);

        this.baseScale = 1;
        this.baseRectangle = 4;
        this.setScale(this.baseScale);
        this.setRectangle(this.baseRectangle,this.baseRectangle);
        this.hw = 8;
        this.hh = 8;

        this.hpManager = new HpManager(scene,92,92,this);

        this.inv = 0;

        this.baseSpeed = 2;
        this.board = board;
        this.followBoard = true;

        this.applyCustomPhysics();
    }

    clampToRotateBox(board) {
        const rad = Phaser.Math.DegToRad(board.angle);
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);

        const dx = this.x - board.x;
        const dy = this.y - board.y;

        let lx = dx * cos + dy * sin;
        let ly = -dx * sin + dy * cos;

        lx = Phaser.Math.Clamp(
            lx,
            -board.hw + this.hw + board.lineThickness/2,
            board.hw - this.hw - board.lineThickness/2
        );

        ly = Phaser.Math.Clamp(
            ly,
            -board.hh + this.hh + board.lineThickness/2,
            board.hh - this.hh - board.lineThickness/2
        );

        this.setAnchor(
            board.x + (lx * cos - ly * sin),
            board.y + (lx * sin + ly * cos)
        );
    }

    inputReload() {
        const controls = {
            left: this.input.isDown("left"),
            right: this.input.isDown("right"),
            up: this.input.isDown("up"),
            down: this.input.isDown("down"),
            cancel: this.input.isDown("cancel"),
            confirm: this.input.isDown("confirm"),
        }
        this.controls = controls;
    }


    update0(time,delta) {
        this.clampToRotateBox(this.board);
    }

    update1(time,delta){}

    update2(time,delta) {}
}

export class RedSoul extends Soul {
    constructor(scene,x,y,board) {
        super(scene,x,y,board,0xff0000);
    }

    update0(time,delta) {
        this.inputReload();
        const speed = this.baseSpeed * 60 * delta / 1000;
        const dx = (this.controls.right - this.controls.left) * (1-this.controls.cancel*0.5)*speed;
        const dy = (this.controls.down - this.controls.up) * (1-this.controls.cancel*0.5)*speed;
        this.setAnchor(this.anchorX + dx,this.anchorY + dy);
        super.update0(time,delta);
    }
}

export class Bullet extends UndertaleObject {
    constructor(scene,x,y,baseWidth,baseHeight,scaleX,scaleY,texture,destroyOnHit,destroyOutsideBoard,ignore,inv,damage,kr=0,Depth=depth.battle.bullet.inside,events={hit: "bullet_hit"}) {
        super(scene,x,y,texture,Depth);

        this.baseWidth = baseWidth;
        this.baseHeight = baseHeight;

        this.resetScale(scaleX,scaleY);

        this.setDamage(damage,kr,inv,ignore);
        this.setType("white");
        this.destroyOnHit = destroyOnHit;
        this.destroyOutsideBoard = destroyOutsideBoard;

        this.bulletEvents = events;


        if (Depth === depth.battle.bullet.inside) {
            this.setMask(scene.board.innerMask);
        }
    }

    setType(t) {
        this.type = t;
        switch (t) {
            case "white":
                this.setTint(0xffffff);
                break;
            case "blue":
                this.setTint()
        }
    }

    setDamage(d,kr,inv,ignore) {
        this.damage = d;
        this.kr = kr;
        this.inv = inv;
        this.ignoreInv = ignore;
    }

    resetScale(scaleX,scaleY) {
        this.scaleX = scaleX;
        this.scaleY = scaleY;
        this.setRectangle(this.baseWidth*scaleX,this.baseHeight*scaleY);
        this.setScale(scaleX,scaleY);
        this.applyCustomPhysics();
    }

    onHitSoul(soul) {
        this.scene.events.emit(this.bulletEvents.hit,this,soul);

        if (this.destroyOnHit) this.destroy();
    }

    update1(time,delta) {
        const soul = this.scene.soul;

        if (this.scene.matter.overlap(this.body,soul.body)) {
            this.onHitSoul(soul);
        }
    }
}

export class Bone extends Bullet {
    constructor(scene,x,y,length,ignore=true,destroyOnHit=false,inv=1000,damage,kr=0,events={hit: "bullet_hit"}){
        super(
            scene,
            x,
            y,
            4,
            length+2,
            1,
            1,
            "assets/images/bone",
            destroyOnHit,
            true,
            ignore,
            inv,
            damage,
            kr,
            depth.battle.bullet.inside,
            events
        );

        this.setAlpha(0);

        this.visual = scene.add.nineslice(x,y,"assets/images/bone",null,10,14,0,0,6,6);

        this.visual.setDepth(this.depth);
        if (this.mask) this.visual.setMask(this.mask);

        this.changeLength(length);
    }

    changeLength(length) {
        this.length = length;

        const collisionHeight = length+8;

        if (this.bodyHeight !== collisionHeight) {
            this.bodyHeight = collisionHeight;
            this.setRectangle(6,collisionHeight);
            this.applyCustomPhysics();
            this.setOffset(0,-collisionHeight / 2);
        }

        if (this.visual) {
            this.visual.setSize(10,length+12);
        }
    }

    update0(time,delta) {
        this.changeLength(this.length+0.2);
        if (this.visual) {
            this.visual.setPosition(this.x,this.y);
            this.visual.setAngle(this.angle);
        }
    }

    destroy(fromScene) {
        if (this.visual) this.visual.destroy();
        super.destroy(fromScene);
    }
}
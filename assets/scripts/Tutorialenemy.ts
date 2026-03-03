import { _decorator, Component, Node, tween, Vec3, Sprite } from 'cc';
import { GameManager, GameState } from './GameManager';
const { ccclass, property } = _decorator;

@ccclass('TutorialEnemy')
export class TutorialEnemy extends Component {

    @property(Node) promptNode: Node = null!;
    @property({ tooltip: 'Расстояние до игрока, при котором игра ставится на паузу. Меньше = ближе к игроку' })
    triggerX: number = 100;
    @property playerX: number = 0;

    private speed: number = 0;

    private _prompted: boolean = false;
    private _done: boolean = false;
    private _started: boolean = false;  // ждём пока игра начнётся

    protected start(): void {
        if (this.promptNode) this.promptNode.active = false;

        // Автоматически ставим его на ту же самую высоту, что и остальных врагов (y = -185)
        const pos = this.node.position;
        this.node.setPosition(pos.x, -185, pos.z);

        // Поворачиваем спрайт лицом влево (к игроку)
        const sprite = this.getComponent(Sprite);
        if (sprite) {
            sprite.spriteFrame.flipUVX = true; // Для 2D спрайтов часто используется flipUVX или scale.x = -1
        } else {
            // Либо разворачиваем саму ноду (надежнее, так как там может быть анимация)
            this.node.setScale(new Vec3(-1, 1, 1));
        }
    }

    protected update(dt: number): void {
        const gm = GameManager.instance;
        if (!gm || gm.state !== GameState.PLAYING) return;

        // Если туториал еще не дошел до паузы, он бежит на игрока БЫСТРЕЕ фона
        if (!this._prompted) {
            this.speed = gm.speed + 300; // Добавляем 300 к скорости фона (как у обычных врагов)
        }

        // Первый кадр после старта — блокируем прыжок
        if (!this._started) {
            this._started = true;
            gm.blockJump();
        }

        // Двигаемся всегда (даже после _done — уходим за экран)
        if (this.speed > 0) {
            const pos = this.node.position;
            const nx = pos.x - this.speed * dt;
            this.node.setPosition(nx, pos.y, pos.z);

            // Удаляем когда ушли далеко за левый край экрана (исчезает позже)
            if (nx < -1500) {
                gm.endTutorial();
                this.node.destroy();
                return;
            }
        }

        if (this._done) return;

        // Когда близко к игроку — останавливаемся и показываем подсказку
        const nx = this.node.position.x;
        if (!this._prompted && nx < this.playerX + this.triggerX) {
            this._prompted = true;
            this.speed = 0;
            this._showPrompt();
        }
    }

    private _showPrompt(): void {
        if (!this.promptNode) return;
        this.promptNode.active = true;

        // Останавливаем игру (фон, препятствия)
        const gm = GameManager.instance;
        if (gm) gm.pauseGame();

        const finger = this.promptNode.getChildByName('FingerNode');
        if (finger) {
            tween(finger)
                .to(0.5, { scale: new Vec3(1.2, 1.2, 1) }, { easing: 'sineInOut' })
                .to(0.5, { scale: new Vec3(1.0, 1.0, 1) }, { easing: 'sineInOut' })
                .union()
                .repeatForever()
                .start();
        }
    }

    public onPlayerJumped(): void {
        if (!this._prompted || this._done) return;
        this._done = true;

        if (this.promptNode) this.promptNode.active = false;

        // Возобновляем игру и убираем туториал
        const gm = GameManager.instance;
        if (gm) {
            gm.resumeGame();
            gm.endTutorial();
        }

        // Враг убегает дальше после прыжка игрока
        this.speed = gm.speed + 350;
    }
}
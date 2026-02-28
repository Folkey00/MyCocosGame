import { _decorator, Component, Node, tween, Vec3 } from 'cc';
import { GameManager, GameState } from './GameManager';
const { ccclass, property } = _decorator;

@ccclass('TutorialEnemy')
export class TutorialEnemy extends Component {

    @property(Node) promptNode: Node = null!;
    @property speed: number = 200;
    @property triggerX: number = 200;
    @property playerX: number = 0;

    private _prompted: boolean = false;
    private _done: boolean = false;
    private _started: boolean = false;  // ждём пока игра начнётся

    protected start(): void {
        if (this.promptNode) this.promptNode.active = false;
    }

    protected update(dt: number): void {
        const gm = GameManager.instance;
        if (!gm || gm.state !== GameState.PLAYING) return;

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

            // Удаляем когда ушли за левый край
            if (nx < -800) {
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

        // Враг быстро уходит влево — update() сам удалит его
        this.speed = 500;
    }
}
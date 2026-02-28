import { _decorator, Component, Node, tween, Vec3, input, Input, EventTouch } from 'cc';
import { GameManager, GameState } from './GameManager';
const { ccclass, property } = _decorator;

/**
 * TapPrompt
 * Вешай на ноду StartScreen.
 * Анимирует пульсацию пальца и скрывает экран по тапу.
 */
@ccclass('TapPrompt')
export class TapPrompt extends Component {

    @property(Node) fingerNode: Node = null!;  // нода с PNG пальца

    protected onLoad(): void {
        input.on(Input.EventType.TOUCH_START, this._onTap, this);
    }

    protected onDestroy(): void {
        input.off(Input.EventType.TOUCH_START, this._onTap, this);
    }

    protected start(): void {
        this._startPulse();
    }

    private _startPulse(): void {
        if (!this.fingerNode) return;

        // Пульсация: увеличивается до 1.2 и обратно, бесконечно
        tween(this.fingerNode)
            .to(0.5, { scale: new Vec3(1.2, 1.2, 1) }, { easing: 'sineInOut' })
            .to(0.5, { scale: new Vec3(1.0, 1.0, 1) }, { easing: 'sineInOut' })
            .union()
            .repeatForever()
            .start();
    }

    private _onTap(): void {
        const gm = GameManager.instance;
        if (!gm || gm.state !== GameState.IDLE) return;
        gm.startGame();
    }
}
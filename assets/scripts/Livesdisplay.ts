import { _decorator, Component, Node, Sprite, Color, UIOpacity } from 'cc';
import { GameManager } from './GameManager';
const { ccclass, property } = _decorator;

@ccclass('LivesDisplay')
export class LivesDisplay extends Component {

    @property({ type: [Node] })
    hearts: Node[] = [];

    private _lastLives: number = -1;

    protected update(_dt: number): void {
        const gm = GameManager.instance;
        if (!gm) return;
        if (gm.lives === this._lastLives) return;
        this._lastLives = gm.lives;
        this._refresh();
    }

    private _refresh(): void {
        const lives = GameManager.instance?.lives ?? 3;
        this.hearts.forEach((h, i) => {
            let opacityComp = h.getComponent(UIOpacity);
            if (!opacityComp) {
                opacityComp = h.addComponent(UIOpacity);
            }
            if (i < lives) {
                opacityComp.opacity = 255;
            } else {
                opacityComp.opacity = 50;
            }
        });
    }
}
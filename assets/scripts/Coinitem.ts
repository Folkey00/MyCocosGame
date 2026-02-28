import {
    _decorator, Component, Collider2D, Contact2DType, IPhysics2DContact,
    tween, Vec3, UIOpacity
} from 'cc';
const { ccclass, property } = _decorator;

@ccclass('CoinItem')
export class CoinItem extends Component {

    private _baseY: number = 0;
    private _time: number = 0;

    protected start(): void {
        this._baseY = this.node.position.y;

        // Physics contact handled by PlayerController (tag 3)
        // Add a self-destruct after 12 seconds so they don't leak if off-screen
        this.scheduleOnce(() => {
            if (this.node.isValid) this.node.destroy();
        }, 12);
    }

    protected update(dt: number): void {
        this._time += dt;
        // Плавное движение вверх-вниз (амплитуда 12)
        const offset = Math.sin(this._time * Math.PI * 2) * 12;

        const pos = this.node.position;
        // Меняем только Y, оставляя X (который двигает ObstacleManager)
        this.node.setPosition(pos.x, this._baseY + offset, pos.z);
    }
}
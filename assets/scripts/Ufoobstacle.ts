import { _decorator, Component, Node, tween, Vec3 } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('UFOObstacle')
export class UFOObstacle extends Component {

    @property(Node) beamNode: Node = null!;    // the green beam sprite child

    protected start(): void {
        // Vertical hover bob
        tween(this.node)
            .by(0.8, { position: new Vec3(0, 20, 0) }, { easing: 'sineInOut' })
            .by(0.8, { position: new Vec3(0, -20, 0) }, { easing: 'sineInOut' })
            .union()
            .repeatForever()
            .start();

        // Beam pulse
        if (this.beamNode) {
            tween(this.beamNode)
                .to(0.5, { scale: new Vec3(1.2, 1, 1) }, { easing: 'sineInOut' })
                .to(0.5, { scale: new Vec3(0.8, 1, 1) }, { easing: 'sineInOut' })
                .union()
                .repeatForever()
                .start();
        }
    }
}
import { _decorator, Component, Node, UITransform } from 'cc';
import { GameManager, GameState } from './GameManager';
const { ccclass, property } = _decorator;

/**
 * GroundScroller — бесконечный скроллинг одного слоя.
 * 
 * Работает с ОДНИМ или ДВУМЯ тайлами.
 * 
 * Если у тебя один большой PNG фон:
 *   - Создай два одинаковых Sprite с этим PNG (tileA и tileB)
 *   - Поставь tileA x=0, tileB x=720 (ширина твоего PNG)
 *   - Укажи tileWidth = ширина твоего PNG
 * 
 * Если фон НЕ должен скроллиться — просто не вешай этот скрипт.
 */
@ccclass('GroundScroller')
export class GroundScroller extends Component {

    @property(Node) tileA: Node = null!;  // первый спрайт фона
    @property(Node) tileB: Node = null!;  // второй спрайт (копия первого)

    // Ширина одного тайла в пикселях — поставь равной ширине твоего PNG
    @property tileWidth: number = 720;

    // Насколько медленнее фон едет относительно препятствий (0 = стоит, 1 = с той же скоростью)
    // Для неба ставь 0.3, для земли ставь 1.0
    @property parallaxFactor: number = 1.0;

    protected start(): void {
        // Автоматически берем точную пиксельную ширину картинки из компонента UITransform,
        // чтобы избежать человеческой ошибки при вводе через редактор.
        if (this.tileA) {
            const trans = this.tileA.getComponent(UITransform);
            if (trans && trans.width > 0) {
                this.tileWidth = trans.width * Math.abs(this.tileA.scale.x);
            }
        }
    }

    protected update(dt: number): void {
        const gm = GameManager.instance;
        if (!gm || gm.state !== GameState.PLAYING || gm.paused) return;

        const spd = gm.speed * this.parallaxFactor;
        let nxA = this.tileA.position.x - spd * dt;
        let nxB = this.tileB.position.x - spd * dt;

        // Перемещаем ушедший тайл в конец
        if (nxA <= -this.tileWidth) {
            nxA = nxB + this.tileWidth - 2;
        } else if (nxB <= -this.tileWidth) {
            nxB = nxA + this.tileWidth - 2;
        }

        // ЖЁСТКО СИНХРОНИЗИРУЕМ ПРАВЫЙ ТАЙЛ К ЛЕВОМУ В КАЖДОМ КАДРЕ
        // (это исправляет кривую стартовую расстановку в редакторе и 1px зазоры)
        if (nxA < nxB) {
            nxB = nxA + this.tileWidth - 2;
        } else {
            nxA = nxB + this.tileWidth - 2;
        }

        this.tileA.setPosition(nxA, this.tileA.position.y, 0);
        this.tileB.setPosition(nxB, this.tileB.position.y, 0);
    }
}
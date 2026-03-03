import { _decorator, Component, Node, UITransform, view } from 'cc';
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
        if (this.tileA) {
            const trans = this.tileA.getComponent(UITransform);
            if (trans && trans.width > 0) {
                // Изначальная базовая ширина тайла
                this.tileWidth = trans.width * Math.abs(this.tileA.scale.x);

                // Получаем реальный размер экрана и дизайн-разрешение
                const visibleSize = view.getVisibleSize();
                const designSize = view.getDesignResolutionSize();

                // Высчитываем во сколько раз реальный экран шире дизайн-разрешения 
                // (актуально для ПК/альбомной ориентации, где мы используем FIXED_HEIGHT)
                let scaleRatio = 1.0;

                if (visibleSize.width > designSize.width) {
                    scaleRatio = visibleSize.width / designSize.width;
                }

                // Увеличиваем масштаб только по X (ширине), чтобы фон не "увеличивался" и не съезжал вниз
                if (scaleRatio > 1.0) {
                    this.tileA.setScale(this.tileA.scale.x * scaleRatio, this.tileA.scale.y, 1);
                    this.tileB.setScale(this.tileB.scale.x * scaleRatio, this.tileB.scale.y, 1);

                    // Пересчитываем ширину тайла после скейла!
                    this.tileWidth = trans.width * Math.abs(this.tileA.scale.x);
                }

                // Убеждаемся, что при старте тайлы стоят вплотную и закрывают левый край
                const startX = -visibleSize.width / 2; // Левый край экрана
                this.tileA.setPosition(startX, this.tileA.position.y, 0);
                this.tileB.setPosition(startX + this.tileWidth, this.tileB.position.y, 0);
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
            nxA += this.tileWidth * 2;
        }
        if (nxB <= -this.tileWidth) {
            nxB += this.tileWidth * 2;
        }

        // Мягко корректируем отклонения вместо жесткой привязки
        if (nxA < nxB && Math.abs((nxA + this.tileWidth) - nxB) > 5) {
            nxB = nxA + this.tileWidth;
        } else if (nxB < nxA && Math.abs((nxB + this.tileWidth) - nxA) > 5) {
            nxA = nxB + this.tileWidth;
        }

        this.tileA.setPosition(nxA, this.tileA.position.y, 0);
        this.tileB.setPosition(nxB, this.tileB.position.y, 0);
    }
}
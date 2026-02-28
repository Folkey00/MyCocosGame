import { _decorator, Component, Node, Prefab, instantiate, Vec3, RigidBody2D, BoxCollider2D, ERigidBody2DType, tween, Animation } from 'cc';
import { GameManager, GameState } from './GameManager';
const { ccclass, property } = _decorator;

// Вместо userData используем WeakMap — хранит доп. данные по ноде
const nodeData = new WeakMap<Node, { type: string; scored: boolean }>();

@ccclass('ObstacleManager')
export class ObstacleManager extends Component {

    // ── Prefabs ─────────────────────────────────────────
    @property(Prefab) conePrefab: Prefab = null!;   // дорожный конус
    @property(Prefab) enemyPrefab: Prefab = null!;   // мужик (tag=2)
    @property(Prefab) coinPrefab: Prefab = null!;   // деньги (tag=3)
    @property(Prefab) cardPrefab: Prefab = null!;   // карточки (tag=4)
    @property(Prefab) finishLinePrefab: Prefab = null!; // финишная линия (tag=5)

    // ── Spawn params (меняй в Inspector) ─────────────────
    @property spawnX: number = 700;    // где спавнить (правый край)
    @property groundY: number = -250;   // Y поверхности земли
    @property flyingY: number = -80;    // Y для тарелки
    @property despawnX: number = -750;   // где удалять (левый край)

    private _timer: number = 1.5;
    private _coinTimer: number = 2.0;
    private _active: Node[] = [];
    private _finishSpawned: boolean = false;

    protected start(): void {
        this.node.parent!.on('game-start', this._onStart, this);
    }

    private _onStart(): void {
        for (const n of this._active) {
            if (n && n.isValid) n.destroy();
        }
        this._active = [];
        this._timer = 1.5;
        this._coinTimer = 2.0;
        this._finishSpawned = false;
    }

    protected update(dt: number): void {
        const gm = GameManager.instance;
        if (!gm || gm.state !== GameState.PLAYING || gm.paused || gm.inTutorial) return;

        // Проверяем, наступило ли время победы
        if (gm.gameTime >= gm.WIN_TIME) {
            if (!this._finishSpawned) {
                this._finishSpawned = true;
                this._spawnFinishLine();
            }
        } else {
            // Спавн препятствий и монеток идет только ДО наступления времени финиша
            this._timer -= dt;
            if (this._timer <= 0) {
                this._spawnObstacle();
                const base = Math.max(1.5, 3.5 - gm.gameTime * 0.03);
                this._timer = base + (Math.random() * 0.6 - 0.3);
            }

            this._coinTimer -= dt;
            if (this._coinTimer <= 0) {
                this._spawnCoinRow();
                this._coinTimer = 3.0 + Math.random() * 2.0;
            }
        }

        const spd = gm.speed;
        for (let i = this._active.length - 1; i >= 0; i--) {
            const n = this._active[i];

            if (!n || !n.isValid) {
                this._active.splice(i, 1);
                continue;
            }

            const pos = n.position;
            const nx = pos.x - spd * dt;

            const data = nodeData.get(n);
            if (data && !data.scored && nx < -50 && pos.x >= -50) {
                data.scored = true;
                if (data.type === 'obstacle') {
                    gm.addScore(10);
                }
            }

            if (nx < this.despawnX) {
                n.destroy();
                this._active.splice(i, 1);
            } else {
                n.setPosition(nx, pos.y, pos.z);
            }
        }
    }

    private _spawnObstacle(): void {
        const roll = Math.random();
        let prefab: Prefab;
        let y = this.groundY;

        const isEnemy = roll >= 0.5;
        if (!isEnemy) {
            prefab = this.conePrefab;   // 50% конус
        } else {
            prefab = this.enemyPrefab;  // 50% мужик
        }

        const node = instantiate(prefab);
        nodeData.set(node, { type: 'obstacle', scored: false });

        // Удаляем скрипт TutorialEnemy, чтобы он не ломал параметры игры (не блокировал прыжки)
        const tut = node.getComponent('TutorialEnemy');
        if (tut) tut.destroy();

        // Добавляем коллайдер и физику всем препятствиям (врагам и конусам), 
        // чтобы движок 100% регистрировал коллизию даже если игрок просто бежит.
        let rb = node.getComponent(RigidBody2D);
        if (!rb) {
            rb = node.addComponent(RigidBody2D);
        }
        rb.type = ERigidBody2DType.Animated;

        let col = node.getComponent(BoxCollider2D);
        if (!col) {
            col = node.addComponent(BoxCollider2D);
        }
        col.tag = 2; // Урон
        col.sensor = true;

        // Разные хитбоксы для врага и конуса
        if (isEnemy) {
            col.size.set(60, 150);
            col.offset.set(0, 0);

            // Запускаем нативную анимацию, если она есть
            const anim = node.getComponent(Animation);
            if (anim && anim.clips.length > 0) {
                anim.play(anim.clips[0]?.name);
            }
        } else {
            // У конуса хитбокс пониже
            col.size.set(70, 80);
            col.offset.set(0, -35);
        }

        node.setPosition(this.spawnX, y, 0);
        this.node.addChild(node);
        this._active.push(node);
    }

    private _spawnFinishLine(): void {
        if (!this.finishLinePrefab) {
            console.warn("Finish Line Prefab is not assigned in ObstacleManager!");

            // Если префаба нет (пользователь забыл его задать), сразу вызываем победу для отказоустойчивости
            const gm = GameManager.instance;
            if (gm && typeof (gm as any).triggerGameWin === 'function') {
                (gm as any).triggerGameWin();
            }
            return;
        }

        const node = instantiate(this.finishLinePrefab);
        nodeData.set(node, { type: 'finish', scored: false });

        let rb = node.getComponent(RigidBody2D);
        if (!rb) rb = node.addComponent(RigidBody2D);
        rb.type = ERigidBody2DType.Animated;

        let col = node.getComponent(BoxCollider2D);
        if (!col) col = node.addComponent(BoxCollider2D);

        // Тег 5 означает "Финишная линия"
        col.tag = 5;
        col.sensor = true;
        // Даем финишной ленте большой хитбокс, чтобы игрок гарантированно её задел
        col.size.set(200, 1500);
        col.offset.set(0, 0);

        // Ставим финиш выше, чтобы он не был закопан в землю. (Например, на 300 пикселей выше земли)
        node.setPosition(this.spawnX, this.groundY + 300, 0);
        this.node.addChild(node);
        this._active.push(node);
    }

    private _spawnCoinRow(): void {
        const count = Math.floor(3 + Math.random() * 5); // 3-7 штук
        const gap = 120; // расстояние между предметами
        const isHigh = Math.random() < 0.3;
        const base_y = isHigh ? this.groundY + 220 : this.groundY + 60;

        const isCard = Math.random() < 0.3;
        // Если должна быть карточка, выбираем случайное место для нее в этом ряду
        const cardIndex = isCard ? Math.floor(Math.random() * count) : -1;

        const patternType = Math.floor(Math.random() * 3); // 0: ряд, 1: дуга, 2: волна

        for (let i = 0; i < count; i++) {
            const prefab = (i === cardIndex) ? this.cardPrefab : this.coinPrefab;

            const item = instantiate(prefab);
            nodeData.set(item, { type: 'coin', scored: false });

            // BoxCollider (сенсор) нужен для сбора.
            // Чтобы монетки двигались через setPosition, но при этом регистрировались физическим движком, 
            // тип должен быть Animated!
            const rb = item.getComponent(RigidBody2D);
            if (rb) rb.type = ERigidBody2DType.Animated;

            let yOffset = 0;
            if (patternType === 1) {
                // Дуга (парабола)
                const half = (count - 1) / 2;
                const dist = Math.abs(i - half);
                yOffset = (half * half - dist * dist) * 15;
            } else if (patternType === 2) {
                // Синусоида
                yOffset = Math.sin(i * 1.5) * 50;
            }

            item.setPosition(this.spawnX + i * gap, base_y + yOffset, 0);

            this.node.addChild(item);
            this._active.push(item);
        }
    }
}
import { _decorator, Component, Node, Label, director, sys, UIOpacity, tween, UITransform, Sprite, Color, Vec3, view, ResolutionPolicy, Button, Graphics } from 'cc';
const { ccclass, property } = _decorator;

export enum GameState {
    IDLE,
    PLAYING,
    DEAD,
    GAMEOVER,
}

@ccclass('GameManager')
export class GameManager extends Component {

    private static _instance: GameManager = null!;
    public static get instance(): GameManager { return GameManager._instance; }

    @property(Node) startScreen: Node = null!;
    @property(Node) gameoverScreen: Node = null!;
    @property(Node) gameWinScreen: Node = null!; // Экран победы (с картой и Install Now)
    @property(Node) gameWinEffect: Node = null!; // Пульсирующий крутящийся эффект на фоне экрана победы
    @property(Node) hudNode: Node = null!;

    @property(Label) scoreLbl: Label = null!;
    @property(Label) paypalLbl: Label = null!;   // ← Label поверх синей части
    @property(Label) gameoverScoreLbl: Label = null!;  // Label "$0.00" на GameOverScreen
    @property(Label) gameWinScoreLbl: Label = null!;   // Label "$0.00" на GameWinScreen поверх карты

    public state: GameState = GameState.IDLE;
    public score: number = 0;
    public coins: number = 0;
    public lives: number = 3;
    public speed: number = 300;
    public gameTime: number = 0;
    public combo: number = 0;
    public jumpBlocked: boolean = false;   // заблокирован ли прыжок (туториал)
    public inTutorial: boolean = true;    // идёт ли туториал
    public comboTimer: number = 0;
    public readonly WIN_TIME: number = 30; // 30 секунд для победы (можешь изменить)

    // Сумма в PayPal — накапливается за монеты
    private _paypal: number = 0;
    private _bestScore: number = 0;

    protected onLoad(): void {
        GameManager._instance = this;
        this._bestScore = sys.localStorage.getItem('bestScore')
            ? parseInt(sys.localStorage.getItem('bestScore')!) : 0;

        // Фикс черных полос в альбомной ориентации
        const frameSize = view.getFrameSize();
        if (frameSize.width > frameSize.height) {
            view.setDesignResolutionSize(720, 1280, ResolutionPolicy.FIXED_HEIGHT);
        } else {
            view.setDesignResolutionSize(720, 1280, ResolutionPolicy.FIXED_WIDTH);
        }

        // Скрываем HUD со старта
        if (this.startScreen) this.startScreen.active = true;
        if (this.gameoverScreen) this.gameoverScreen.active = false;
        if (this.gameWinScreen) this.gameWinScreen.active = false;
        if (this.hudNode) this.hudNode.active = false;
    }

    protected start(): void {
        this.showStart();
    }

    showStart(): void {
        this.state = GameState.IDLE;
        if (this.startScreen) this.startScreen.active = true;
        if (this.gameoverScreen) this.gameoverScreen.active = false;
        if (this.hudNode) this.hudNode.active = false;

        // Удаляем черные фоны от прошлого проигрыша, если они остались на сцене (с Canvas)
        const canvas = director.getScene()?.getChildByName('Canvas');
        if (canvas) {
            const oldBg1 = canvas.getChildByName('DarkBackground');
            if (oldBg1) oldBg1.destroy();
            const oldBg2 = canvas.getChildByName('DarkBackgroundWin');
            if (oldBg2) oldBg2.destroy();
        }

        // Удаляем фоны, прикрепленные напрямую к родителям экранов (как мы делаем это в коде Game Over)
        if (this.gameoverScreen && this.gameoverScreen.parent) {
            const oldGoBg = this.gameoverScreen.parent.getChildByName('DarkBackground');
            if (oldGoBg) oldGoBg.destroy();
        }
        if (this.gameWinScreen && this.gameWinScreen.parent) {
            const oldWinBg = this.gameWinScreen.parent.getChildByName('DarkBackgroundWin');
            if (oldWinBg) oldWinBg.destroy();
        }
    }

    startGame(): void {
        this.score = 0;
        this.coins = 0;
        this.lives = 3;
        this.speed = 600; // Увеличенная начальная скорость (было 450)
        this.gameTime = 0;
        this._paypal = 0;
        this.jumpBlocked = false;
        this.inTutorial = true;

        if (this.startScreen) this.startScreen.active = false;
        if (this.gameoverScreen) this.gameoverScreen.active = false;
        if (this.gameWinScreen) this.gameWinScreen.active = false;
        if (this.hudNode) this.hudNode.active = true;
        this.state = GameState.PLAYING;
        this._updateHUD();
        this.node.emit('game-start');
    }

    public paused: boolean = false;

    pauseGame(): void {
        this.paused = true;
    }

    resumeGame(): void {
        this.paused = false;
    }

    blockJump(): void {
        this.jumpBlocked = true;
    }

    endTutorial(): void {
        this.inTutorial = false;
        this.jumpBlocked = false; // разблокируем прыжок когда туториал ушел
        this.resumeGame();
    }

    restartGame(): void {
        director.loadScene(director.getScene()!.name);
    }

    addScore(pts: number): void {
        // Очки больше не начисляются, только деньги
    }

    addCoin(): void {
        this.coins++;
        this._paypal += 10;   // деньги = $10
    }

    addCard(): void {
        this.coins++;
        this._paypal += 50;   // карточка = $50
        this._updateHUD();
    }

    loseLife(): void {
        if (this.state !== GameState.PLAYING) return;
        this.lives = Math.max(0, this.lives - 1);
        this._updateHUD();
        if (this.lives <= 0) this._triggerGameOver();
    }

    public triggerGameWin(): void {
        this.state = GameState.GAMEOVER; // Останавливаем фоны и врагов
        if (this.hudNode) this.hudNode.active = false; // Прячем обычный интерфейс

        if (this.gameWinScreen) {
            this.gameWinScreen.active = true;

            // Избегаем серого квадрата при наведении на кнопку Install
            this.gameWinScreen.getComponentsInChildren(Button).forEach(btn => {
                btn.transition = Button.Transition.SCALE;
                btn.zoomScale = 0.95;
                if ((btn as any).hoverSprite) (btn as any).hoverSprite = null;
                btn.hoverColor = Color.WHITE;
                btn.normalColor = Color.WHITE;
            });

            // Если есть текст на карте для цифр
            if (this.gameWinScoreLbl) {
                this.gameWinScoreLbl.string = `${this._paypal.toFixed(2)}`;
            }

            // Добавляем анимацию свечения/лучей на фоне карты (gameWinEffect)
            if (this.gameWinEffect) {
                // Пульсация
                tween(this.gameWinEffect)
                    .to(1.5, { scale: new Vec3(1.15, 1.15, 1) }, { easing: 'sineInOut' })
                    .to(1.5, { scale: new Vec3(1.0, 1.0, 1) }, { easing: 'sineInOut' })
                    .union()
                    .repeatForever()
                    .start();

                // Вращение
                tween(this.gameWinEffect)
                    .by(10.0, { eulerAngles: new Vec3(0, 0, -360) })
                    .repeatForever()
                    .start();
            }

            // Плавное затемнение экрана (полупрозрачный черный фон)
            const darkBg = new Node('DarkBackgroundWin');
            const uiTrans = darkBg.addComponent(UITransform);
            uiTrans.setContentSize(3000, 3000);

            // Вместо Sprite используем Graphics, чтобы гарантированно закрасить фон черным
            const graphics = darkBg.addComponent(Graphics);
            graphics.fillColor = new Color(0, 0, 0, 255);
            graphics.fillRect(-1500, -1500, 3000, 3000);

            const uiOpacity = darkBg.addComponent(UIOpacity);
            uiOpacity.opacity = 0;

            if (this.gameWinScreen.parent) {
                this.gameWinScreen.parent.addChild(darkBg);
                darkBg.setSiblingIndex(this.gameWinScreen.getSiblingIndex());
            }

            // Затемняем фон до 180 (полупрозрачный), а не до 255
            tween(uiOpacity).to(0.5, { opacity: 180 }).start();

            // Анимация появления самой панели Победы (Bounce эффект)
            this.gameWinScreen.scale = new Vec3(0.5, 0.5, 1);
            tween(this.gameWinScreen)
                .to(0.6, { scale: new Vec3(1.0, 1.0, 1) }, { easing: 'backOut' })
                .start();

            let winOpacity = this.gameWinScreen.getComponent(UIOpacity);
            if (!winOpacity) winOpacity = this.gameWinScreen.addComponent(UIOpacity);
            winOpacity.opacity = 0;
            tween(winOpacity).to(0.3, { opacity: 255 }).start();
        }
    }

    private _triggerGameOver(): void {
        this.state = GameState.DEAD;
        if (this.score > this._bestScore) {
            this._bestScore = Math.floor(this.score);
            sys.localStorage.setItem('bestScore', String(this._bestScore));
        }

        this.scheduleOnce(() => {
            this.state = GameState.GAMEOVER;
            if (this.gameoverScreen) this.gameoverScreen.active = true;

            // Плавное затемнение экрана (создаем черный фон на лету)
            const darkBg = new Node('DarkBackground');
            const uiTrans = darkBg.addComponent(UITransform);
            uiTrans.setContentSize(3000, 3000); // С запасом на любые экраны

            // Вместо Sprite используем Graphics
            const graphics = darkBg.addComponent(Graphics);
            graphics.fillColor = new Color(0, 0, 0, 255); // Черный цвет
            graphics.fillRect(-1500, -1500, 3000, 3000);

            const uiOpacity = darkBg.addComponent(UIOpacity);
            uiOpacity.opacity = 0;

            // Добавляем этот фон на сцену (например, как ребенка экрана UI, но позади GameOver плашки)
            if (this.gameoverScreen && this.gameoverScreen.parent) {
                this.gameoverScreen.parent.addChild(darkBg);
                darkBg.setSiblingIndex(this.gameoverScreen.getSiblingIndex()); // Ставим ровно ПЕРЕД gameoverScreen
            }

            // Плавное появление затемнения (до 180 непрозрачности - полупрозрачный)
            tween(uiOpacity)
                .to(0.5, { opacity: 180 })
                .start();

            // Анимация появления панели Game Over (Bounce эффект)
            if (this.gameoverScreen) {
                this.gameoverScreen.scale = new Vec3(0.5, 0.5, 1);
                tween(this.gameoverScreen)
                    .to(0.6, { scale: new Vec3(1.0, 1.0, 1) }, { easing: 'backOut' })
                    .start();

                let goOpacity = this.gameoverScreen.getComponent(UIOpacity);
                if (!goOpacity) goOpacity = this.gameoverScreen.addComponent(UIOpacity);
                goOpacity.opacity = 0;
                tween(goOpacity).to(0.3, { opacity: 255 }).start();
            }

            if (this.gameoverScoreLbl) this.gameoverScoreLbl.string = `${this._paypal.toFixed(2)}`;
        }, 1.2);
    }

    protected update(dt: number): void {
        if (this.state !== GameState.PLAYING) return;

        // Таймер выживания
        this.gameTime += dt;

        // Условие появления финиша теперь обрабатывается в ObstacleManager
        // Ждём пока игрок добежит до физического объекта финишной черты

        this.speed = Math.min(600 + this.gameTime * 35, 1200); // Быстрее растет скорость, выше лимит
        // this.score += this.speed * dt * 0.02; // Очки больше не растут со временем

        this._updateHUD();
    }
    private _updateHUD(): void {
        if (this.scoreLbl && this.scoreLbl.node) this.scoreLbl.node.active = false; // Скрываем лейбл со счётом
        // PayPal label — показываем сумму в долларах
        if (this.paypalLbl) {
            this.paypalLbl.node.active = true;
            this.paypalLbl.string = `${this._paypal.toFixed(2)}`;
        }
    }
}
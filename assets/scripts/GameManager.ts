import { _decorator, Component, Node, Label, director, sys, UIOpacity, tween, UITransform, Sprite, Color, Vec3 } from 'cc';
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
    @property(Label) comboLbl: Label = null!;

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

        // Скрываем HUD со старта
        this.startScreen.active = true;
        this.gameoverScreen.active = false;
        if (this.gameWinScreen) this.gameWinScreen.active = false;
        if (this.hudNode) this.hudNode.active = false;
    }

    protected start(): void {
        this.showStart();
    }

    showStart(): void {
        this.state = GameState.IDLE;
        this.startScreen.active = true;
        this.gameoverScreen.active = false;
        this.hudNode.active = false;
    }

    startGame(): void {
        this.score = 0;
        this.coins = 0;
        this.lives = 3;
        this.speed = 450;
        this.gameTime = 0;
        this._paypal = 0;
        this.jumpBlocked = false;
        this.inTutorial = true;

        this.startScreen.active = false;
        this.gameoverScreen.active = false;
        if (this.gameWinScreen) this.gameWinScreen.active = false;
        this.hudNode.active = true;
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
        if (this.comboLbl) this.comboLbl.node.active = false;
        this._updateHUD();
        if (this.lives <= 0) this._triggerGameOver();
    }

    public triggerGameWin(): void {
        this.state = GameState.GAMEOVER; // Останавливаем фоны и врагов
        if (this.hudNode) this.hudNode.active = false; // Прячем обычный интерфейс

        if (this.gameWinScreen) {
            this.gameWinScreen.active = true;

            // Если есть текст на карте для цифр
            if (this.gameWinScoreLbl) {
                this.gameWinScoreLbl.string = `$${this._paypal.toFixed(2)}`;
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

            // Плавное затемнение экрана (создаем черный фон на лету, как при GameOver)
            const darkBg = new Node('DarkBackgroundWin');
            const uiTrans = darkBg.addComponent(UITransform);
            uiTrans.setContentSize(3000, 3000);

            const sprite = darkBg.addComponent(Sprite);
            sprite.color = new Color(0, 0, 0, 255);

            const uiOpacity = darkBg.addComponent(UIOpacity);
            uiOpacity.opacity = 0;

            if (this.gameWinScreen.parent) {
                this.gameWinScreen.parent.addChild(darkBg);
                darkBg.setSiblingIndex(this.gameWinScreen.getSiblingIndex());
            }

            tween(uiOpacity).to(0.5, { opacity: 200 }).start();

            let winOpacity = this.gameWinScreen.getComponent(UIOpacity);
            if (!winOpacity) winOpacity = this.gameWinScreen.addComponent(UIOpacity);
            winOpacity.opacity = 0;
            tween(winOpacity).to(0.5, { opacity: 255 }).start();
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
            this.gameoverScreen.active = true;

            // Плавное затемнение экрана (создаем черный фон на лету)
            const darkBg = new Node('DarkBackground');
            const uiTrans = darkBg.addComponent(UITransform);
            uiTrans.setContentSize(3000, 3000); // С запасом на любые экраны

            const sprite = darkBg.addComponent(Sprite);
            sprite.color = new Color(0, 0, 0, 255); // Черный цвет

            const uiOpacity = darkBg.addComponent(UIOpacity);
            uiOpacity.opacity = 0;

            // Добавляем этот фон на сцену (например, как ребенка экрана UI, но позади GameOver плашки)
            if (this.gameoverScreen && this.gameoverScreen.parent) {
                this.gameoverScreen.parent.addChild(darkBg);
                darkBg.setSiblingIndex(this.gameoverScreen.getSiblingIndex()); // Ставим ровно ПЕРЕД gameoverScreen
            }

            // Плавное появление затемнения (до ~80% непрозрачности)
            tween(uiOpacity)
                .to(0.5, { opacity: 200 })
                .start();

            // Плавно показываем сам экран Game Over, если на нем есть UIOpacity
            let goOpacity = this.gameoverScreen.getComponent(UIOpacity);
            if (!goOpacity) goOpacity = this.gameoverScreen.addComponent(UIOpacity);
            goOpacity.opacity = 0;
            tween(goOpacity).to(0.5, { opacity: 255 }).start();

            if (this.gameoverScoreLbl) this.gameoverScoreLbl.string = `$${this._paypal.toFixed(2)}`;
        }, 1.2);
    }

    protected update(dt: number): void {
        if (this.state !== GameState.PLAYING) return;

        // Таймер выживания
        this.gameTime += dt;

        // Условие появления финиша теперь обрабатывается в ObstacleManager
        // Ждём пока игрок добежит до физического объекта финишной черты

        this.speed = Math.min(450 + this.gameTime * 25, 900);
        // this.score += this.speed * dt * 0.02; // Очки больше не растут со временем

        this._updateHUD();
    }
    private _updateHUD(): void {
        if (this.scoreLbl) this.scoreLbl.node.active = false; // Скрываем лейбл со счётом
        // PayPal label — показываем сумму в долларах
        if (this.paypalLbl) {
            this.paypalLbl.node.active = true;
            this.paypalLbl.string = `$${this._paypal.toFixed(2)}`;
        }
    }
}
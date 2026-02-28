import {
    _decorator, Component, RigidBody2D, input, Input, EventTouch,
    KeyCode, EventKeyboard, Vec2, Animation, AnimationState, Collider2D,
    Contact2DType, IPhysics2DContact, UIOpacity, Node, tween, Vec3
} from 'cc';
import { GameManager, GameState } from './GameManager';
const { ccclass, property } = _decorator;

const JUMP_VELOCITY = 650;
const INVINCIBLE_TIME = 1.5;

@ccclass('PlayerController')
export class PlayerController extends Component {

    @property(RigidBody2D) rb: RigidBody2D = null!;
    @property(Animation) anim: Animation = null!;

    private _onGround: boolean = true;
    private _invincible: number = 0;
    private _dead: boolean = false;
    private _jumping: boolean = false;  // true пока летим вверх

    protected onLoad(): void {
        input.on(Input.EventType.TOUCH_START, this._onTap, this);
        input.on(Input.EventType.KEY_DOWN, this._onKey, this);
        const col = this.getComponent(Collider2D)!;
        col.on(Contact2DType.BEGIN_CONTACT, this._onContactBegin, this);

        if (this.rb) {
            this.rb.enabledContactListener = true;
        }
    }

    protected onDestroy(): void {
        input.off(Input.EventType.TOUCH_START, this._onTap, this);
        input.off(Input.EventType.KEY_DOWN, this._onKey, this);
    }

    protected start(): void {
        this.node.parent!.on('game-start', this._onGameStart, this);

        if (this.anim) {
            this.anim.on(Animation.EventType.FINISHED, (_t: string, state: AnimationState) => {
                if (state.name === 'jump' && !this._dead) this._playRun();
            }, this);
        }
    }

    private _onGameStart(): void {
        this._dead = false;
        this._invincible = 0;
        this._onGround = true;
        this._jumping = false;
        this._playRun();
    }

    private _onTap(_e: EventTouch): void { this._jump(); }
    private _onKey(e: EventKeyboard): void {
        if (e.keyCode === KeyCode.SPACE || e.keyCode === KeyCode.ARROW_UP) this._jump();
    }

    private _jump(): void {
        const gm = GameManager.instance;
        if (!gm || gm.state !== GameState.PLAYING || this._dead) return;

        // Если идет туториал
        if (gm.inTutorial) {
            // Если игра еще не на паузе (подсказка не появилась) - прыгать нельзя
            if (!gm.paused) return;

            // Если игра на паузе (появилась подсказка JUMP)
            if (this._onGround) {
                this._doJump();
                const enemyNode = this.node.scene.getChildByName('Canvas')?.getChildByName('TutorialEnemy');
                (enemyNode?.getComponent('TutorialEnemy') as any)?.onPlayerJumped?.();
            }
            return;
        }

        // Обычная игра (не туториал)
        if (gm.paused || !this._onGround || gm.jumpBlocked) return;
        this._doJump();
    }

    private _doJump(): void {
        this._onGround = false;
        this._jumping = true;
        this.rb.linearVelocity = new Vec2(0, JUMP_VELOCITY);
        this._playJump();
    }

    private _onContactBegin(_self: Collider2D, other: Collider2D, _c: IPhysics2DContact): void {
        if (other.tag === 1) {
            this._land();
        }
        if (other.tag === 2) this._handleHit();
        if (other.tag === 3) {
            this._flyItemToHUD(other.node, 'coin');
        }
        if (other.tag === 4) {
            this._flyItemToHUD(other.node, 'card');
        }
        if (other.tag === 5) {
            // Коллизия с финишной линией
            const gm = GameManager.instance;
            if (gm && typeof (gm as any).triggerGameWin === 'function') {
                (gm as any).triggerGameWin();
            }
        }
    }

    private _flyItemToHUD(itemNode: Node, type: 'coin' | 'card'): void {
        const gm = GameManager.instance;
        if (!gm || !itemNode || !itemNode.isValid) return;

        // Выключаем коллайдер, чтобы он больше не триггерил коллизии
        const col = itemNode.getComponent(Collider2D);
        if (col) col.enabled = false;

        // Флаг для ObstacleManager, чтобы он отстал от этого предмета и не двигал его
        (itemNode as any)._isCollected = true;

        // Полет в самый правый верхний угол (где находится UI баланса)
        const targetPos = new Vec3(650, 750, 0);

        tween(itemNode)
            .to(0.4, { position: targetPos, scale: new Vec3(0, 0, 0) }, { easing: 'backIn' })
            .call(() => {
                if (type === 'coin') gm.addCoin();
                else if (type === 'card') gm.addCard();

                if (itemNode.isValid) itemNode.destroy();
            })
            .start();
    }

    private _land(): void {
        this._onGround = true;
        this._jumping = false;
        GameManager.instance.jumpBlocked = false; // сброс блокировки прыжка
        if (!this._dead) this._playRun();
    }

    private _handleHit(): void {
        const gm = GameManager.instance;
        if (!gm || this._invincible > 0 || this._dead) return;
        gm.loseLife();
        if (gm.lives <= 0) {
            this._dead = true;
            this._playDead();
        } else {
            this._invincible = INVINCIBLE_TIME;
            this._flashInvincible();
        }
    }

    protected update(dt: number): void {
        const gm = GameManager.instance;

        if (gm?.paused) {
            this.anim?.pause();
        } else {
            this.anim?.resume();
        }

        if (this._invincible > 0) this._invincible -= dt;
        if (gm?.paused) return;

        const vy = this.rb.linearVelocity.y;

        // Когда начали падать — сбрасываем _jumping
        if (this._jumping && vy < 0) this._jumping = false;

        // Запасной план: если мы падаем или стоим, и Y опустился до уровня земли (-240..-250),
        // но onContactBegin земли почему-то не отработал (глюк физики Cocos)
        if (!this._onGround && vy <= 0 && this.node.position.y <= -235) {
            this._land();
        }

        // Страховка от вечной блокировки прыжка (если туториал давно кончился)
        if (this._onGround && !gm.inTutorial && gm.jumpBlocked) {
            gm.jumpBlocked = false;
        }
    }

    private _playRun(): void { this.anim?.play('run'); }
    private _playJump(): void { this.anim?.play('jump'); }
    private _playDead(): void { this.anim?.stop(); }

    private _flashInvincible(): void {
        const opacity = this.getComponent(UIOpacity) ?? this.addComponent(UIOpacity);
        let count = 0;
        this.schedule(function (this: PlayerController) {
            opacity.opacity = opacity.opacity < 128 ? 255 : 80;
            count++;
            if (count > 18) opacity.opacity = 255;
        }, 0.1, 18);
    }
}

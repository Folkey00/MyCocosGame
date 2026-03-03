import { _decorator, Component, UITransform, view } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('ResponsiveFooter')
export class ResponsiveFooter extends Component {

    @property({ tooltip: 'Высота футера в вертикальном (Portrait) режиме' })
    portraitHeight: number = 150;

    @property({ tooltip: 'Высота футера в горизонтальном (Landscape) режиме' })
    landscapeHeight: number = 250;

    private _uiTrans: UITransform = null!;

    protected onLoad(): void {
        this._uiTrans = this.getComponent(UITransform)!;
        this.updateHeight();

        // Обновляем высоту каждый раз, когда меняется размер окна браузера
        view.setResizeCallback(() => this.updateHeight());
    }

    private updateHeight(): void {
        if (!this._uiTrans) return;

        const frameSize = view.getFrameSize();
        // Если ширина больше высоты — это горизонтальный режим (ПК / перевернутый телефон)
        if (frameSize.width > frameSize.height) {
            this._uiTrans.height = this.landscapeHeight;
        } else {
            // Вертикальный режим (обычный телефон)
            this._uiTrans.height = this.portraitHeight;
        }
    }
}

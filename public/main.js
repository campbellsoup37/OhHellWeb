// Connection
var baseUrl;
var socket;

/*
 * vars
 */
var frame, ctx;
var cachedWidth, cachedHeight;
var ClientState, state;
var GameState, gameState;
var loadingCanvas, stateCanvas, mainMenuCanvas, modeSelectCanvas, canvas;
var stateDivs;
var mpButton;
var lmUsername, lmConnect;
var igName, igChangeName, igKibitzer, igRobots, igDoubleDeck, igTeams, igStart, igBack;
var igLeftDiv, igRightDiv, igScoreSheetContainer, igRightSpacerDiv;
var igHotdogContainer;

var username;
var autojoinId;

// variables
var games;
var players, myPlayer;
var teams;
var options;
var mode;
var multiplayer;
var rounds, roundNumber;
var trump;
var dealer, leader, turn;
var canPlay;
var cardJustPlayed;
var takenTimer, trickTaken;
var message;
var showMessageButtons;
var preselected;
var showOneCard;
var robotDelay;
var pass;

// constants
var cardSeparation;
var handYOffset;
var preselectedCardYOffset;
var rowCodeInv;
var animationTime;
var bidStayTime;
var trickStayTime;
var messageTime;
var takenXSeparation;
var takenYSeparation;
var lastTrickSeparation;
var smallCardScale;
var scoreMargin;
var minChatHeight, maxChatHeight;
var pokeTime;

var scoreWidth;

var deckImg, deckImgSmall;
var cardWidth, cardHeight, cardWidthSmall, cardHeightSmall;
var maxWid;

var pokeSound;

/*
 * GraphicsTools
 */
var font, fontBold, fontSmall, fontLarge, fontTitle;
var colors;

// this function is very expensive -- memo as often as possible
function getStringDimensions(text, fnt) {
    let span = document.createElement('span');
    document.body.appendChild(span);

    span.style.font = fnt;
    span.style.width = 'auto';
    span.style.height = 'auto';
    span.style.position = 'absolute';
    span.style.whiteSpace = 'no-wrap';
    span.innerHTML = text;

    let width = span.clientWidth;
    let height = span.clientHeight;

    document.body.removeChild(span);

    return [width, height];
}

function drawText(ctx, text, x, y, posx, posy, fnt, style, maxWidth) {
    if (arguments.length < 7) {
        fnt = font;
    }
    if (arguments.length < 8) {
        style = 'black';
    }

    ctx.font = fnt;
    ctx.fillStyle = style;
    switch (posx) {
        case 0:
            ctx.textAlign = 'left';
            break;
        case 1:
            ctx.textAlign = 'center';
            break;
        case 2:
            ctx.textAlign = 'right';
            break;
    }
    switch (posy) {
        case 0:
            ctx.textBaseline = 'bottom';
            break;
        case 1:
            ctx.textBaseline = 'middle';
            break;
        case 2:
            ctx.textBaseline = 'top';
            break;
    }

    ctx.fillText(text, x, y + 1, maxWidth);
}

function drawBox(ctx, x, y, width, height, roundness, thickBorderColor, noBorder) {
	ctx.beginPath();
	ctx.moveTo(x + roundness, y);
	ctx.lineTo(x + width - roundness, y);
	ctx.quadraticCurveTo(x + width, y, x + width, y + roundness);
	ctx.lineTo(x + width, y + height - roundness);
	ctx.quadraticCurveTo(x + width, y + height, x + width - roundness, y + height);
	ctx.lineTo(x + roundness, y + height);
	ctx.quadraticCurveTo(x, y + height, x, y + height - roundness);
	ctx.lineTo(x, y + roundness);
	ctx.quadraticCurveTo(x, y, x + roundness, y);
	ctx.closePath();
	ctx.fill();

	if (!noBorder) {
        color = ctx.strokeStyle;
    	ctx.strokeStyle = thickBorderColor === undefined ? 'black' : thickBorderColor;
        ctx.lineWidth = thickBorderColor === undefined ? 1 : 2;

    	ctx.beginPath();
    	ctx.moveTo(x + roundness, y);
    	ctx.lineTo(x + width - roundness, y);
    	ctx.quadraticCurveTo(x + width, y, x + width, y + roundness);
    	ctx.lineTo(x + width, y + height - roundness);
    	ctx.quadraticCurveTo(x + width, y + height, x + width - roundness, y + height);
    	ctx.lineTo(x + roundness, y + height);
    	ctx.quadraticCurveTo(x, y + height, x, y + height - roundness);
    	ctx.lineTo(x, y + roundness);
    	ctx.quadraticCurveTo(x, y, x + roundness, y);
    	ctx.closePath();
    	ctx.stroke();

    	ctx.strokeStyle = color;
        ctx.lineWidth = 1;
    }
}

function drawOval(ctx, x, y, width, height, fill) {
    if (arguments.length < 6) {
        fill = true;
    }

    ctx.beginPath();
    ctx.ellipse(x + width / 2, y + height / 2, width / 2, height / 2, 0, 0, 2 * Math.PI);
    if (fill) {
        ctx.fill();
    } else {
        ctx.stroke();
    }
}

function drawCard(ctx, card, x, y, scale, small, dark, maxY, thickBorderColor) {
    let cardNumber = card.isEmpty() ? 52 : (card.num - 1) % 13 + 13 * rowCodeInv[card.suit];
    let col = cardNumber % 9;
    let row = (cardNumber - col) / 9;

    let img = deckImg;
    if (small) {
        img = deckImgSmall;
    }

    let cw1 = small ? cardWidthSmall : cardWidth;
    let ch1 = small ? cardHeightSmall : cardHeight;

    if (maxY < 0) {
        maxY = y + ch1 * scale / 2;
    }
    maxY = Math.min(maxY, y + ch1 * scale / 2);
    let diff = maxY - (y - ch1 * scale / 2);

    let x0 = x - cw1 * scale / 2;
    let y0 = y - ch1 * scale / 2;
    let x1 = x + cw1 * scale / 2;
    let y1 = maxY;

    ctx.drawImage(
        img,
        col * cw1, row * ch1, cw1, diff / scale,
        x0, y0, cw1 * scale, diff
    );

    if (dark) {
        ctx.fillStyle = 'rgba(127, 127, 127, 0.3)'
        drawBox(ctx, x0, y0, cw1 * scale, diff, 15, undefined, true);
    }

    // TODO border color
}

function drawLine(ctx, x1, y1, x2, y2) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
}

// abstract interactables
class CanvasInteractable {
    constructor() {
        this.moused = false;
        this.pressed = false;
        this.draggable = false;
        this.interactables = [];
    }

    isEnabled() {
        return true;
    }

    isShown() {
        return true;
    }

    setMoused(moused) {
        this.moused = moused;
    }

    isMoused() {
        return this.moused;
    }

    setPressed(pressed) {
        this.pressed = pressed;
    }

    isPressed() {
        return this.pressed;
    }

    wheel() {}

    cursor() {
        return 'default';
    }

    updateMoused(x, y) {
        this.setMoused(
    			this.isShown()
    			&& this.isEnabled()
    			&& x >= this.x()
    			&& x <= this.x() + this.width()
    			&& y >= this.y()
    			&& y <= this.y() + this.height());

        this.interactableMoused = undefined;
        if (this.isMoused()) {
            this.interactableMoused = this;
            for (const inter of this.interactables) {
                if (!inter.isShown()) {
                    continue;
                }

                let ans1 = inter.updateMoused(x, y);
                if (ans1 !== undefined) {
                    this.interactableMoused = ans1;
                }
            }
        }

        if (this.interactableMoused === this) {
            document.body.style.cursor = this.cursor();
        }

    	return this.interactableMoused;
    }
}

class Panel {
    constructor(container, canvas) {
        this.container = container;
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");

        this.cachedContainerWidth = 0;
        this.cachedContainerHeight = 0;

        this.cachedX = 0;
        this.cachedY = 0;
        this.cachedWidth = 0;
        this.cachedHeight = 0;
    }

    fillContainer(callback) {
        if (this.cachedContainerWidth == this.container.clientWidth
            && this.cachedContainerHeight == this.container.clientHeight) {
            return;
        }

        this.cachedContainerWidth = this.container.clientWidth;
        this.cachedContainerHeight = this.container.clientHeight;

        this.canvas.width = this.container.clientWidth;
        this.canvas.height = this.container.clientHeight;

        let box = this.canvas.getBoundingClientRect();
        this.cachedX = box.left;
        this.cachedY = box.top;
        this.cachedWidth = this.canvas.width;
        this.cachedHeight = this.canvas.height;

        if (callback !== undefined) {
            callback();
        }
    }
}

class WrappedDOMElement extends CanvasInteractable {
    constructor(element, auto) {
        super();
        this.element = element;
        this.auto = auto;
        if (!auto) {
            this.element.style.position = 'absolute';
        } else {
            this.x = () => this.element.getBoundingClientRect().left;
            this.y = () => this.element.getBoundingClientRect().top;
            this.width = () => this.element.clientWidth;
            this.height = () => this.element.clientHeight;
        }
    }

    dispose() {
        if (this.element.parentElement) {
            this.element.parentElement.removeChild(this.element);
        }
    }

    paint() {
        let container = this.container();
        if (this.element.parentElement !== container) {
            this.dispose();
            if (container) {
                container.appendChild(this.element);
            }
        }

        if (!this.element.parentElement) {
            return;
        }

        if (this.isShown() != (this.element.style.display != 'none')) {
            this.element.style.display = this.isShown() ? 'inline' : 'none';
        }

        if (this.isShown()) {
            if (!this.auto) {
                this.element.style.left = this.x() + 'px';
                this.element.style.top = this.y() + 'px';
                this.element.style.width = this.width() + 'px';
                this.element.style.height = this.height() + 'px';
            }

            if (this.element.nodeName.toLowerCase() == 'button') {
                let enabled = this.isEnabled();
                if (enabled && this.element.disabled) {
                    enableButton(this.element);
                } else if (!enabled && !this.element.disabled) {
                    disableButton(this.element);
                }
            }
        }
    }
}

class PanelInteractable extends WrappedDOMElement {
    constructor(container, canvas, auto) {
        super(container, auto);

        this.container = () => container.parentElement;
        this.panel = new Panel(container, canvas);
        this.ctx = this.panel.ctx;
    }

    fillContainer(force) {
        this.panel.fillContainer(force);
    }

    clear() {
        this.ctx.clearRect(0, 0, this.panel.canvas.width, this.panel.canvas.height);
    }

    paint() {
        super.paint();
        this.clear();
        this.fillContainer();
    }
}

// homemade button and text field
class CanvasButton extends CanvasInteractable {
    constructor(text) {
        super();
        this.text = text;
    }

    paint() {
        if (this.isShown()) {
    		if (!this.isEnabled()) {
    			ctx.fillStyle = "#606060";
    		} else {
    			if (this.isMoused()) {
    				ctx.fillStyle = "#C0C0C0";
    			} else {
    				ctx.fillStyle = "white";
    			}
    		}
    		drawBox(ctx, this.x(), this.y(), this.width(), this.height(), 10, undefined);
            drawText(ctx, this.text, this.x() + this.width() / 2, this.y() + this.height() / 2, 1, 1, fontBold, 'black');
    	}
    }
}

class TextField extends CanvasInteractable {
    constructor(defaultText) {
        super();
        this.defaultText = defaultText;
        this.text = '';
        this.cursor = 0;
        this.left = 0;
        this.right = 0;
    }

    setText(text) {
        this.text = text;
        this.cursor = text.length;
        this.left = 0;
        this.right = text.length;
        this.shrinkLeft();
    }

    getText() {
        return this.text;
    }

    key(e) {
        if (e.keyCode >= 32 && e.keyCode <= 126 && e.key.length == 1) {
            this.text = this.text.substring(0, this.cursor) + e.key + this.text.substring(this.cursor);
            this.cursor++;
            this.right++;

            if (this.cursor == this.right) {
                this.shrinkLeft();
            } else {
                this.shrinkRight();
            }
        } else if (e.keyCode == 8 && this.cursor > 0) {
            this.text = this.text.substring(0, this.cursor - 1) + this.text.substring(this.cursor);
            this.cursor--;

            if (this.right > this.text.length) {
                this.right--;
                this.expandLeft();
            } else {
                this.expandRight();
            }
        } else if (e.keyCode == 46 && this.cursor < this.text.length) {
            this.text = this.text.substring(0, this.cursor) + this.text.substring(this.cursor + 1);

            if (this.right > this.text.length) {
                this.right--;
                this.expandLeft();
            } else {
                this.expandRight();
            }
        } else if (e.keyCode == 37 && this.cursor > 0) {
            this.cursor--;

            if (this.left > this.cursor) {
                this.left--;
                this.shrinkRight();
            }
        } else if (e.keyCode == 39 && this.cursor < this.text.length) {
            this.cursor++;

            if (this.right < this.cursor) {
                this.right++;
                this.shrinkLeft();
            }
        }
    }

    getDisplayedText() {
        return this.text.substring(this.left, this.cursor) + '|' + this.text.substring(this.cursor, this.right);
    }

    shrinkLeft() {
        while (getStringDimensions(this.getDisplayedText())[0] > this.width() - 2 && this.left < this.cursor) {
            this.left++;
        }
    }

    expandLeft() {
        while (getStringDimensions(this.getDisplayedText())[0] < this.width() - 2 && this.left > 0) {
            this.left--;
        }
    }

    shrinkRight() {
        while (getStringDimensions(this.getDisplayedText())[0] > this.width() - 2 && this.right > this.cursor) {
            this.right--;
        }
    }

    expandRight() {
        while (getStringDimensions(this.getDisplayedText())[0] < this.width() - 2 && this.right < this.text.length) {
            this.right++;
        }
    }

    paint() {
        if (this.isShown()) {
            ctx.fillStyle = 'white';
    		drawBox(ctx, this.x(), this.y(), this.width(), this.height(), 10, undefined);
            drawText(ctx, this.getDisplayedText(), this.x() + 5, this.y() + this.height() / 2, 0, 1, font, 'black');
    	}
    }
}

/*
 * PlayerNamePlate
 */
class PlayerNamePlate extends CanvasInteractable {
    constructor(player) {
        super();
        this.player = player;
        this.pokeable = false;
    }

    x() {
        return (this.player.getX() - this.player.getJust() * this.width() / 2);
    }

    y() {
        return this.player.getY() - 10;
    }

    width() {
        return maxWid;
    }

    height() {
        return 20;
    }

    paint() {
        if (gameState == GameState.POSTGAME) {
            return;
        }

        let preOrPost = gameState == GameState.PREGAME || gameState == GameState.POSTGAME;

        // glow
        if (this.player.pokeTime != 0 && new Date().getTime() >= this.player.pokeTime && !preOrPost) {
            ctx.fillStyle = 'rgba(255, 255, 0, 0.1)'
            for (let i = 0; i < 10; i++) {
                drawBox(ctx, this.x() - 2 * i, this.y() - i, this.width() + 4 * i, this.height() + 2 * i, 25, 'rgba(255, 255, 255, 0)');
            }
            this.pokeable = true;
        } else {
            this.pokeable = false;
        }

        // plate
        if (preOrPost && this.player.isHost() || !preOrPost && turn == this.player.getIndex() || gameState == GameState.PASSING && !this.player.passed) {
            ctx.fillStyle = "yellow";
        } else if (!this.player.human) {
            ctx.fillStyle = 'rgb(210, 255, 255)';
        } else {
            ctx.fillStyle = "white";
        }
        drawBox(ctx, this.x(), this.y(), this.width(), this.height(), 12, options.teams ? colors[this.player.team] : undefined);

        // name
        drawText(ctx,
            this.player.getName(),
            this.x() + this.width() / 2,
            this.y() + this.height() / 2,
            1, 1, font,
            this.player.isDisconnected() ? 'red' : 'black',
            this.width() - 40
        );

        if (preOrPost) {
            return;
        }

        // bid chip
        if (this.player.hasBid()) {
            let iRelToMe = this.player.getIndex() - myPlayer.getIndex();
            let startX = (cachedWidth - scoreWidth) / 2 - 100 * Math.sin(2 * Math.PI * iRelToMe / players.length);
            let startY = cachedHeight / 2 - 50 + 100 * Math.cos(2 * Math.PI * iRelToMe / players.length);
            let endX = this.x() + 10;
            let endY = this.y() + this.height() / 2;
            let bidX = startX * (1 - this.player.getBidTimer()) + endX * this.player.getBidTimer();
            let bidY = startY * (1 - this.player.getBidTimer()) + endY * this.player.getBidTimer();
            let radius = 50 * (1 - this.player.getBidTimer()) + 16 * this.player.getBidTimer();

            let h = this.player.hand.length + (this.player.trick.isEmpty() ? 0 : 1);
            let want = this.player.bid - this.player.taken;
            if (options.teams) {
                let team = teams[this.player.team];
                want = team.bid() - team.taken();
            }
            if (this.player.getBidTimer() < 1) {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
            } else if (gameState == GameState.BIDDING || want > 0 && want <= h) {
                ctx.fillStyle = 'rgba(175, 175, 175, 0.7)';
            } else if (want == 0) {
                ctx.fillStyle = 'rgb(125, 255, 125)';
            } else {
                ctx.fillStyle = 'rgb(255, 175, 175)';
            }
            drawOval(ctx, bidX - radius / 2, bidY - radius / 2, radius, radius);
            if (this.player.getBidTimer() == 0) {
                ctx.strokeStyle = options.teams ? colors[this.player.team] : 'black';
                ctx.lineWidth = options.teams ? 2 : 1;
                drawOval(ctx, bidX - radius / 2, bidY - radius / 2, radius, radius, false);
                ctx.lineWidth = 1;
                drawText(ctx, this.player.getBid(), bidX, bidY + 1, 1, 1, fontLarge, 'black');
            } else {
                drawText(ctx, this.player.getBid(), bidX, bidY, 1, 1, font, 'black');
            }
        }

        // dealer chip
        if (dealer == this.player.getIndex()) {
            ctx.fillStyle = 'cyan';
            drawOval(ctx, this.x() + this.width() - 19, this.y() + this.height() / 2 - 8, 16, 16);
            drawText(ctx, 'D', this.x() + this.width() - 11, this.y() + this.height() / 2, 1, 1, font, 'black')
        }
    }

    click() {
        if (this.pokeable) {
            poke(this.player.getIndex());
        }
    }
}

/*
 * CanvasCard
 */
class CanvasCard extends CanvasInteractable {
    constructor(card, scale, small) {
        super();
        this.card = card;
        this.scale = scale;
        this.small = small;
    }

    getCard() {
        return this.card;
    }

    x() {
        return this.xCenter() - this.width() / 2;
    }

    y() {
        return this.yCenter() - this.height() / 2;
    }

    xPaintOffset() {
        return 0;
    }

    yPaintOffset() {
        return 0;
    }

    width() {
        return this.scale * (this.small ? cardWidthSmall : cardWidth);
    }

    height() {
        return this.scale * (this.small ? cardHeightSmall : cardHeight);
    }

    isShown() {
        return true;
    }

    hidden() {
        return false;
    }

    dark() {
        return this.isMoused();
    }

    paint() {
        if (this.isShown()) {
            drawCard(ctx,
                this.hidden() ? new Card() : this.card,
                this.xCenter() + this.xPaintOffset(),
                this.yCenter() + this.yPaintOffset(),
                this.scale, this.small, this.dark(),
                -1, undefined
            );
        }
    }
}

// scoresheet
class ScoreSheet extends WrappedDOMElement {
    constructor(prefix) {
        super(document.getElementById(`${prefix}ScoreSheetContainer`));
        this.margin = 5;
        this.scoreVSpacing = 20;
        this.lineV = 4;
        this.sortByHeight = 30;
        this.bidInfoHeight = 20;
        this.buttonWidth = 60;
        this.dealerHWidth = 10;

        let parent = this;

        this.scoreSheetHeader = new PanelInteractable(
            document.getElementById(`${prefix}ScoreSheetHeaderContainer`),
            document.getElementById(`${prefix}ScoreSheetHeaderCanvas`),
            true
        );
        this.scoreSheetHeader.paint = function () {
            this.panel.container.style.height = parent.headerHeight() + 'px';
            this.fillContainer();
            this.clear();
            parent.paintHeader(this.ctx);
        };

        this.scoreSheetScroll = new PanelInteractable(
            document.getElementById(`${prefix}ScoreSheetScrollContainer`),
            document.getElementById(`${prefix}ScoreSheetScrollCanvas`),
            true
        );
        this.scoreSheetScroll.paint = function () {
            this.panel.container.style.height = parent.scrollHeight() + 'px';
            this.fillContainer(() => {
                this.panel.canvas.height = parent.scrollCanvasHeight();
            });
            this.clear();
            parent.paintScroll(this.ctx);
        };

        this.interactables = [
            this.scoreSheetHeader,
            this.scoreSheetScroll
        ];

        this.buttons = [
            document.getElementById(`${prefix}SortBySeat`),
            document.getElementById(`${prefix}SortByScore`)
        ];
        for (let i = 0; i < this.buttons.length; i++) {
            this.buttons[i].addEventListener('click', () => {
                if (this.sortBy != i) {
                    toggleButton(this.buttons[this.sortBy]);
                    this.sortBy = i;
                    toggleButton(this.buttons[this.sortBy]);
                }
            });
        }
        this.sortBy = 0;
        toggleButton(this.buttons[0]);
    }

    height() {
        let height = this.scoreVSpacing * this.getRounds().length
                        + this.headerHeight()
                        + this.footerHeight() + 2;
        let m = 12;
        return Math.min(
            height,
            cachedHeight - 7 * m - 1 - minChatHeight
        );
    }

    headerHeight() {
        let numRows = this.options && this.options.teams ? 2 : 1;
        return this.margin + this.scoreVSpacing * numRows  + this.lineV / 2;
    }

    footerHeight() {
        return this.sortByHeight + 2 * this.margin;
    }

    scrollHeight() {
        return this.height() - this.headerHeight() - this.footerHeight();
    }

    scrollCanvasHeight() {
        return this.scoreVSpacing * this.rounds.length + this.lineV / 2;
    }

    paintHeader(ctx) {
        let N = this.players.length;
        let wid = (this.width() - 4 * this.margin - 2 * this.dealerHWidth) / N;
        let currentX = 3 * this.margin + 2 * this.dealerHWidth;

        let height = this.headerHeight();

        // horizontal line
        ctx.fillStyle = 'black';
        drawLine(ctx,
            currentX,
            height,
            this.width() - this.margin,
            height
        );

        let indices = [];
        if (this.options.teams) {
            let teamX = currentX;
            for (const team of this.teams) {
                if (team.members.length == 0) {
                    continue;
                }

                let teamWid = wid * team.members.length;
                ctx.fillStyle = 'white';
                drawBox(ctx,
                    teamX + 1, this.margin, teamWid - 2, this.scoreVSpacing,
                    10, colors[team.number]
                );
                drawText(ctx,
                    team.name.substring(0, 15),
                    teamX + teamWid / 2,
                    this.margin + this.scoreVSpacing / 2,
                    1, 1,
                    fontBold,
                    colors[team.number],
                    teamWid - 6
                );
                indices = indices.concat(team.members.map(p => p.index));
                teamX += teamWid;
            }
        } else {
            indices = [...Array(this.players.length).keys()];
        }

        for (let j = 0; j < N; j++) {
            let i = indices[j];
            let player = this.players[i];

            // name
            drawText(ctx,
                player.name.substring(0, 15),
                currentX + wid / 2,
                height - this.scoreVSpacing / 2 - this.lineV / 2,
                1, 1,
                myPlayer && player.id == myPlayer.id ? fontBold : font,
                'black',
                wid - 6
            );

            if (j > 0) {
                drawLine(ctx,
                    currentX,
                    height - this.scoreVSpacing - this.lineV / 2,
                    currentX,
                    height
                );
            }

            currentX += wid;
        }
    }

    paintScroll(ctx) {
        let N = this.players.length;
        let wid = (this.width() - 4 * this.margin - 2 * this.dealerHWidth) / N;

        let height = this.scrollCanvasHeight();

        // dealers and hand sizes
        for (let i = 0; i < this.rounds.length; i++) {
            let round = this.rounds[i];

            let info = '';
            if (mode == 'Oh Hell') {
                info = round.handSize;
            } else if (mode == 'Oregon Hearts') {
                if (round.pass == 0) {
                    info = 'K';
                } else if (round.pass > 0) {
                    info = 'L';
                    if (round.pass > 1) {
                        info += round.pass;
                    }
                } else if (round.pass < 0) {
                    info = 'R';
                    if (round.pass < -1) {
                        info += (-round.pass);
                    }
                }
            }

            drawText(ctx,
                info,
                this.margin + this.dealerHWidth / 2,
                this.scoreVSpacing * (i + 0.5),
                1, 1,
                font, 'black'
            );
            drawText(ctx,
                this.playersUnsorted[round.dealer].name.substring(0, 1),
                2 * this.margin + 1.5 * this.dealerHWidth,
                this.scoreVSpacing * (i + 0.5),
                1, 1,
                font, 'black'
            );
        }

        // rest
        let currentX = 3 * this.margin + 2 * this.dealerHWidth;

        let colCount = this.options.teams ? this.teams.length : this.players.length;
        for (let i = 0; i < colCount; i++) {
            let members = this.options.teams ? this.teams[i].members : [this.players[i]];
            let scoresList = members[0].scores;
            let fullWid = wid * members.length;

            if (i > 0) {
                drawLine(ctx, currentX, 0, currentX, height);
            }

            for (let j = 0; j < this.rounds.length; j++) {
                let score = j < scoresList.length ? scoresList[j] : '';

                let k = members.length;
                let fnt = font;
                let b = 0;

                if (mode == 'Oh Hell') {
                    // bid chips
                    b = (fnt == font ? 13 : 9) + 3;
                    let chipStart = j < scoresList.length ? 0 : this.margin + b - wid;
                    let chipSpacing = j < scoresList.length ? this.margin + b : wid;
                    for (const p of members) {
                        if (j < p.bids.length) {
                            ctx.fillStyle = 'rgba(200, 200, 200, 0.7)';
                            drawOval(ctx,
                                currentX + 1 + fullWid - chipSpacing * k - chipStart,
                                this.scoreVSpacing * (j + 0.5) - b / 2,
                                b, b
                            );
                            drawText(ctx,
                                p.bids[j],
                                currentX + 1 + fullWid - chipSpacing * k - chipStart + b / 2,
                                this.scoreVSpacing * (j + 0.5),
                                1, 1,
                                fnt, 'black'
                            );
                        }
                        k--;
                    }
                }

                // scores
                k = members.length;
                drawText(ctx,
                    score,
                    currentX + 1 + fullWid / 2 - this.margin * k / 2 - b * k / 2,
                    this.scoreVSpacing * (j + 0.5),
                    1, 1,
                    fnt, 'black'
                );
            }

            currentX += fullWid;
        }
    }

    paint() {
        if (!gameState || !this.isShown()) {
            return;
        }
        super.paint();

        this.options = this.getOptions();
        this.playersUnsorted = this.getPlayers();
        this.players = this.playersUnsorted.map(p => p);
        if (this.options.teams) {
            this.teams = this.getTeams().map(t => t).filter(t => t.members.length > 0);
        }
        this.rounds = this.getRounds();

        if (!this.players.length) {
            return;
        }

        if (this.sortBy == 1) {
            let sign = mode == 'Oregon Hearts' ? -1 : 1;
            if (this.options.teams) {
                this.teams.sort((t1, t2) => sign * Math.sign(t2.members[0].score - t1.members[0].score));
            } else {
                this.players.sort((p1, p2) => sign * Math.sign(p2.score - p1.score));
            }
        }

        for (const inter of this.interactables) {
            inter.paint();
        }
    }
}

// postgame
class PostGamePage extends WrappedDOMElement {
    constructor() {
        super(document.getElementById('igPgTabDiv'), true);

        this.scoreTab = new PostGamePlotTab(this, 0);
        this.winTab = new PostGamePlotTab(this, 1);
        this.summaryTab = new PostGameSummaryTab(this, 2);
        this.bidsTab = new PostGameBidsTab(this, 3);
        this.playsTab = new PostGamePlaysTab(this, 4);

        this.tabs = [
            this.scoreTab,
            this.winTab,
            this.summaryTab,
            this.bidsTab,
            this.playsTab
        ];
        this.interactables = this.tabs;

        this.buttons = [
            document.getElementById("igScores"),
            document.getElementById("igWinP"),
            document.getElementById("igSummary"),
            document.getElementById("igBids"),
            document.getElementById("igPlays"),
        ];
        for (let i = 0; i < this.buttons.length; i++) {
            this.buttons[i].addEventListener('click', () => {this.changeTab(i)});
        }
        this.tabSelected = 0;
        toggleButton(this.buttons[0]);
    }

    paint() {
        if (gameState != GameState.POSTGAME) {
            return;
        }

        this.tabs[this.tabSelected].paint();
    }

    setData(data) {
        let sortedScores = undefined;
        if (data.options.teams) {
            sortedScores = data.teams.filter(t => t.members.length > 0).map(function (t) {
                let p = t.members[0];
                return {
                    name: t.name,
                    index: t.number,
                    score: p.scores.length == 0 ? 0 : p.scores[p.scores.length - 1]
                };
            });
        } else {
            sortedScores = data.players.map(function (p) {return {
                name: p.name,
                index: p.index,
                score: p.scores.length == 0 ? 0 : p.scores[p.scores.length - 1]
            };});
        }
        let sign = mode == 'Oh Hell' ? 1 : -1;
        sortedScores.sort((p1, p2) => sign * Math.sign(p2.score - p1.score));
        this.scoreTab.scoreBoard.sortedScores = sortedScores;
        this.winTab.scoreBoard.sortedScores = sortedScores;

        let plotDatas = undefined;
        if (data.options.teams) {
            plotDatas = data.teams.filter(t => t.members.length > 0).map(function (t) {
                let p = t.members[0];
                return {
                    name: t.name,
                    index: t.number,
                    scores: [0].concat(p.scores),
                    wbProbs: [100 / data.players.length].concat(p.wbProbs.map(x => 100 * x))
                };
            });
        } else {
            plotDatas = data.players.map(function (p) {
                return {
                    name: p.name,
                    index: p.index,
                    scores: [0].concat(p.scores),
                    wbProbs: [100 / data.players.length].concat(p.wbProbs.map(x => 100 * x))
                };
            });
        }
        let ticks = [''].concat(data.rounds.map(r => r.handSize));
        for (const data of plotDatas) {
            this.scoreTab.scorePlot.addData(data.scores, data.index, data.name);
            this.winTab.scorePlot.addData(data.wbProbs, data.index, data.name);
        }
        this.scoreTab.scorePlot.addTicks(ticks);
        this.winTab.scorePlot.addTicks(ticks);

        this.summaryTab.addData(data);
        this.bidsTab.addData(data);
        this.playsTab.addData(data);
    }

    changeTab(tab) {
        this.tabs[this.tabSelected].hide();
        toggleButton(this.buttons[this.tabSelected]);
        this.tabSelected = tab;
        this.tabs[this.tabSelected].show();
        toggleButton(this.buttons[this.tabSelected]);
    }

    clearData() {
        this.scoreTab.scorePlot.initialize();
        this.winTab.scorePlot.initialize();
    }
}

class PostGameTab extends CanvasInteractable {
    constructor(page, index) {
        super();
        this.page = page;
        this.index = index;
    }

    x() {return this.page.x();}
    y() {return this.page.y();}
    width() {return this.page.width();}
    height() {return this.page.height();}

    isShown() {
        return this.page.tabSelected == this.index;
    }

    hide() {
        for (const element of this.elements) {
            element.style.display = 'none';
        }
    }

    show() {
        for (const element of this.elements) {
            element.style.display = 'inline';
        }
    }
}

class Plot extends CanvasInteractable {
    constructor(ctx, offsetX, offsetY) {
        super();
        this.ctx = ctx;
        this.offsetX = offsetX;
        this.offsetY = offsetY;
        this.mouseX = 0;
        this.mouseY = 0;
        this.axes = true;
        this.paddingX = 0.05;
        this.paddingY = 0.1;
        this.initialize();
    }

    initialize() {
        this.datas = [];

        this.minX = 0;
        this.maxX = 0;
        this.minY = 0;
        this.maxY = 0;
    }

    addData(data, color, name) {
        this.maxX = Math.max(this.maxX, data.length - 1);
        for (const y of data) {
            this.minY = Math.min(this.minY, y);
            this.maxY = Math.max(this.maxY, y);
        }
        this.datas.push({data: data, color: colors[color], name: name});
    }

    setMinY(y) {
        this.minY = y;
    }

    setMaxY(y) {
        this.maxY = y;
    }

    addTicks(ticks) {
        this.ticks = ticks;
    }

    x0() {
        return this.x() - this.offsetX();
    }

    y0() {
        return this.y() - this.offsetY();
    }

    paint() {
        let nearestX = 0;
        if (this.isMoused()) {
            nearestX = Math.min(this.maxX, Math.max(this.minX, Math.round(this.mouseX)));
            this.highlight(nearestX);
        }

        if (this.axes) {
            this.ctx.strokeStyle = 'black';
            this.drawLine(0, this.minY, 0, this.maxY);
            if (this.minY <= 0 && 0 <= this.maxY) {
                this.drawLine(this.minX, 0, this.maxX, 0);
            }
        }

        if (this.ticks === undefined || this.ticks.length > 0) {
            for (let x = this.minX; x <= this.maxX; x++) {
                drawText(this.ctx,
                    this.ticks === undefined ? x : this.ticks[x],
                    this.x0() + this.canvasX(x), this.y0() + this.height() - 10, 1, 1, fontSmall, 'black');
            }
        }

        for (const data of this.datas) {
            this.ctx.strokeStyle = data.color;
            this.ctx.fillStyle = data.color;
            let x = 0;
            let y = 0;
            for (const newY of data.data) {
                this.drawPoint(x, newY);
                if (x > 0) {
                    this.drawLine(x - 1, y, x, newY);
                }
                x++;
                y = newY;
            }
        }

        if (this.isMoused()) {
            let ttW = 150;
            let ttH = 20 + 16 * this.datas.length;
            let ttY = this.height() / 2 - ttH / 2;
            let ttX = this.canvasX(nearestX + 0.5);
            if (ttX + ttW > this.width()) {
                ttX = this.canvasX(nearestX - (nearestX == this.minX ? 0.1 : 0.5)) - ttW;
            }

            this.ctx.fillStyle = 'white';
            drawBox(this.ctx, this.x0() + ttX, this.y0() + ttY, ttW, ttH, 10);

            // should I maybe not sort this every frame? doesn't really hurt my framerate
            let perm = [...Array(this.datas.length).keys()].sort((i, j) =>
                Math.sign(this.datas[j].data[nearestX] - this.datas[i].data[nearestX]));

            for (let i = 0; i < this.datas.length; i++) {
                this.ctx.fillStyle = this.datas[perm[i]].color;
                let y = this.height() / 2 + 16 * (i + 1 - this.datas.length / 2);
                drawOval(this.ctx, this.x0() + ttX + 8, this.y0() + y - 2, 4, 4, true);
                drawText(this.ctx, this.datas[perm[i]].name.substring(0, 10), this.x0() + ttX + 20, this.y0() + y, 0, 1, font, 'black');
                drawText(this.ctx, this.datas[perm[i]].data[nearestX].toFixed(2), this.x0() + ttX + ttW - 15, this.y0() + y, 2, 1, font, 'black');
            }
        }
    }

    updateMoused(x, y) {
        let ans = super.updateMoused(x, y);
        if (this.isMoused()) {
            this.mouseX = this.plotX(x - this.x());
            this.mouseY = this.plotY(y - this.y());
        }
        return ans;
    }

    canvasX(x) {
        return this.width() * this.paddingX + (x - this.minX) * (1 - 2 * this.paddingX) * this.width() / (this.maxX - this.minX);
    }

    canvasY(y) {
        return this.height() * (1 - this.paddingY) - (y - this.minY) * (1 - 2 * this.paddingY) * this.height() / (this.maxY - this.minY);
    }

    plotX(x) {
        return this.minX + (x - this.width() * this.paddingX) * (this.maxX - this.minX) / ((1 - 2 * this.paddingX) * this.width());
    }

    plotY(y) {
        return this.minY - (y - this.height() * (1 - this.paddingY)) * (this.maxY - this.minY) / ((1 - 2 * this.paddingY) * this.height());
    }

    drawLine(x1, y1, x2, y2) {
        drawLine(this.ctx, this.x0() + this.canvasX(x1), this.y0() + this.canvasY(y1), this.x0() + this.canvasX(x2), this.y0() + this.canvasY(y2));
    }

    drawPoint(x, y) {
        drawOval(this.ctx, this.x0() + this.canvasX(x) - 2, this.y0() + this.canvasY(y) - 2, 4, 4, true);
    }

    highlight(x) {
        this.ctx.fillStyle = 'rgb(192, 192, 192)';
        let x1 = x == this.minX ? this.canvasX(x - 0.1) : this.canvasX(x - 0.5);
        let y1 = this.canvasY(this.maxY);
        let x2 = x == this.maxX ? this.canvasX(x + 0.1) : this.canvasX(x + 0.5);
        let y2 = this.canvasY(this.minY);
        drawBox(this.ctx, this.x0() + x1, this.y0() + y1, x2 - x1, y2 - y1, 10, 'rgb(192, 192, 192)');
    }
}

class PostGamePlotTab extends PostGameTab {
    constructor(page, index) {
        super(page, index);

        this.elements = [
            document.getElementById("igScoreBoardContainer"),
            document.getElementById("igScorePlotContainer")
        ];

        this.scoreBoard = new PanelInteractable(
            document.getElementById("igScoreBoardContainer"),
            document.getElementById("igScoreBoardCanvas"),
            true
        );
        this.scoreBoard.sortedScores = [];
        this.scoreBoard.paint = function () {
            this.clear();
            this.fillContainer();

            drawText(this.ctx, 'Final scores', this.width() / 2, 25, 1, 1, fontBold, 'black');

            let place = 0;
            let current = 999999999;
            let i = 0;
            for (const score of this.sortedScores) {
                if (score.score != current) {
                    place = i + 1;
                    current = score.score;
                }
                this.ctx.fillStyle = colors[score.index];
                drawOval(this.ctx, 8, 50 + 16 * i - 2, 4, 4, true);
                drawText(this.ctx, place + '. ' + score.name, 20, 50 + 16 * i, 0, 1, font, 'black');
                drawText(this.ctx, score.score, this.width() - 15, 50 + 16 * i, 2, 1, font, 'black');
                i++;
            }
        };

        this.scorePlotPanel = new PanelInteractable(
            document.getElementById("igScorePlotContainer"),
            document.getElementById("igScorePlotCanvas"),
            true
        );
        let panel = this.scorePlotPanel;
        this.scorePlot = new Plot(panel.ctx, () => panel.x(), () => panel.y());
        this.scorePlot.x = function () {return panel.x();};
        this.scorePlot.y = function () {return panel.y();};
        this.scorePlot.width = function () {return panel.width();};
        this.scorePlot.height = function () {return panel.height();};
        this.scorePlotPanel.interactables = [this.scorePlot];
        this.scorePlotPanel.paint = () => {
            panel.clear();
            panel.fillContainer();
            this.scorePlot.paint();
        };

        this.interactables = [this.scoreBoard, this.scorePlotPanel];
    }

    paint() {
        this.scoreBoard.paint();
        this.scorePlotPanel.paint();
    }
}

class PostGameSummaryTab extends PostGameTab {
    constructor(page, index) {
        super(page, index);

        this.elements = [
            document.getElementById("igSummaryTabContainer")
        ];

        this.headerHeight = 35;
        this.margin = 4;
        this.columnXs = [
            7/32, 13/32, 19/32, 22/32, 25/32, 28/32
        ];

        let parent = this;
        class SummaryPanel extends PanelInteractable {
            constructor() {
                super(
                    document.getElementById("igSummaryContainer"),
                    document.getElementById("igSummaryCanvas"),
                    true
                );
            }

            addData(data) {
                this.plots = [];
                this.interactables = [];

                for (const player of parent.players) {
                    let plot = new Plot(this.ctx, () => this.x(), () => this.y());
                    plot.x = () => this.x() + this.width() * 9 / 32;
                    plot.y = () => this.y() + parent.headerHeight + player.index * (this.height() - parent.headerHeight - 2) / parent.players.length;
                    plot.width = () => this.width() / 4;
                    plot.height = () => (this.height() - parent.headerHeight - 2) / parent.players.length;

                    let bins = new Array(9).fill(0);
                    for (let i = 0; i < player.bids.length; i++) {
                        let delta = Math.max(-4, Math.min(4, player.takens[i] - player.bids[i]));
                        bins[delta + 4]++;
                    }

                    plot.addData(bins, 0, 'overtricks');
                    plot.setMinY(-0.4 * player.takens.length);
                    plot.setMaxY(Math.max(player.takens.length, 1));
                    plot.addTicks(['<-3', '-3', '-2', '-1', '0', '1', '2', '3', '>3']);
                    plot.axes = false;
                    this.interactables.push(plot);
                    this.plots.push(plot);
                }
            }

            paint() {
                super.paint();
                parent.paintHeader(this.ctx, this.width());
                parent.paintBody(this.ctx, this.width(), this.height());
                for (const plot of this.plots) {
                    plot.paint();
                }
            }
        }
        this.panel = new SummaryPanel();
        this.interactables = [this.panel];
    }

    addData(data) {
        this.options = data.options;
        this.players = data.players;
        this.lucks = data.players.map(p => p.lucks.reduce((a, b) => a + b, 0));
        this.diffs = data.players.map(p => p.diffs.reduce((a, b) => a + b, 0));
        this.bidScores = data.players.map(p => 10 * Math.exp(-p.hypoPointsLost.reduce((a, b) => a + b, 0) / 57));
        this.playScores = data.players.map(p => 10 * Math.exp(-p.mistakes.reduce((a, b) => a + b, 0) / 5));

        this.panel.addData(data);
    }

    paintHeader(ctx, width) {
        drawText(ctx, 'score', width * this.columnXs[0], this.headerHeight / 2, 1, 1, fontSmall, 'black');
        drawText(ctx, 'overtricks', width * this.columnXs[1], this.headerHeight / 2, 1, 1, fontSmall, 'black');
        drawText(ctx, 'bid performance', width * this.columnXs[2], this.headerHeight / 2, 1, 1, fontSmall, 'black');
        drawText(ctx, 'play performance', width * this.columnXs[3], this.headerHeight / 2, 1, 1, fontSmall, 'black');
        drawText(ctx, 'luck', width * this.columnXs[4], this.headerHeight / 2, 1, 1, fontSmall, 'black');
        drawText(ctx, 'difficulty', width * this.columnXs[5], this.headerHeight / 2, 1, 1, fontSmall, 'black');
    }

    paintBody(ctx, width, height) {
        let h = (height - this.headerHeight - 2) / this.players.length;
        for (let i = 0; i <= this.players.length; i++) {
            ctx.strokeStyle = '#C0C0C0';
            drawLine(ctx, this.margin, this.headerHeight + i * h, width - this.margin, this.headerHeight + i * h);

            if (i == this.players.length) {
                break;
            }

            let player = this.players[i];
            let h0 = this.headerHeight + player.index * h + h / 2;

            // columns
            drawText(ctx, player.name, 2 * this.margin, h0, 0, 1, font, this.options.teams ? colors[player.team] : 'black');
            drawText(ctx, player.score, width * this.columnXs[0], h0, 1, 1, font, 'black');
            let bidScore = this.bidScores[i];
            drawText(ctx, !player.human && bidScore > 9.99 ? '--' : bidScore.toFixed(1), width * this.columnXs[2], h0, 1, 1, font, 'black');
            let playScore = this.playScores[i];
            drawText(ctx, !player.human && playScore > 9.99 ? '--' : playScore.toFixed(1), width * this.columnXs[3], h0, 1, 1, font, 'black');
            drawText(ctx, this.lucks[i].toFixed(1), width * this.columnXs[4], h0, 1, 1, font, 'black');
            drawText(ctx, this.diffs[i].toFixed(1), width * this.columnXs[5], h0, 1, 1, font, 'black');
        }
    }

    paint() {
        this.panel.paint();
    }
}

class PostGameBidsTab extends PostGameTab {
    constructor(page, index) {
        super(page, index);

        this.elements = [
            document.getElementById("igBidsTabContainer")
        ];

        this.headerHeight = 35;
        this.margin = 4;
        this.columnXs = [
            3/16, 3/8, 5/8, 25/32, 26.75/32, 28.5/32, 30.5/32
        ];

        let parent = this;
        class BidsPanel extends PanelInteractable {
            constructor() {
                super(
                    document.getElementById("igBidsContainer"),
                    document.getElementById("igBidsCanvas"),
                    true
                );
            }

            addData(data) {
                this.plots = [];
                this.interactables = [];
                for (let i = 0; i < parent.numRounds; i++) {
                    let roundPlots = [];
                    for (const player of parent.players) {
                        let plot = new Plot(this.ctx, () => this.x(), () => this.y());
                        plot.x = () => this.x() + this.width() / 2;
                        plot.y = () => this.y() + parent.headerHeight + player.index * (this.height() - parent.headerHeight - 2) / parent.players.length;
                        plot.width = () => this.width() / 4;
                        plot.height = () => (this.height() - parent.headerHeight - 2) / parent.players.length;
                        plot.isShown = () => i == parent.selected;
                        plot.wheel = this.wheel;
                        if (i < player.bidQs.length) {
                            plot.addData(player.bidQs[i], 0, 'Prob (%)');
                        }
                        plot.setMinY(-40);
                        plot.setMaxY(100);
                        plot.axes = false;
                        this.interactables.push(plot);
                        roundPlots.push(plot);
                    }
                    this.plots.push(roundPlots);
                }
            }

            wheel(y) {
                parent.deltaRound(Math.sign(y));
            }

            paint() {
                super.paint();
                parent.paintHeader(this.ctx, this.width());
                parent.paintBody(this.ctx, this.width(), this.height());
                for (const plot of this.plots[parent.selected]) {
                    plot.paint();
                }
            }
        }
        this.panel = new BidsPanel();
        this.interactables = [this.panel];
    }

    addData(data) {
        this.options = data.options;
        this.numRounds = data.players[0].hands.length;
        let rounds = data.rounds.map(r => r.handSize);
        this.dealers = data.rounds.map(r => r.dealer);

        let div = document.getElementById('igBidsButtonContainer');
        while (div.firstChild) {
            div.removeChild(div.firstChild);
        }
        this.buttons = new Array(this.numRounds);
        for (let i = 0; i < this.numRounds; i++) {
            let button = document.createElement('button');
            button.classList.add(
                'bg-white', 'rounded-lg', 'border', 'border-black', 'w-5', 'h-5',
                'font-bold', 'text-sm', 'select-none', 'hover:bg-gray-300'
            );
            button.innerHTML = rounds[i];
            button.addEventListener('click', () => {this.selectRound(i);});
            div.appendChild(button);
            this.buttons[i] = button;
        }

        this.selected = undefined;
        this.selectRound(0);

        this.players = data.players;
        this.trumps = data.trumps;

        this.panel.addData(data);
    }

    wheel(y) {
        this.deltaRound(Math.sign(y));
    }

    deltaRound(e) {
        let i = Math.max(0, Math.min(this.buttons.length - 1, this.selected + e));
        this.selectRound(i);
    }

    selectRound(i) {
        if (this.selected !== undefined) {
            toggleButton(this.buttons[this.selected]);
        }
        this.selected = i;
        toggleButton(this.buttons[this.selected]);
    }

    paintHeader(ctx, width) {
        drawText(ctx, 'trump', width * this.columnXs[0], this.headerHeight / 2, 1, 1, fontSmall, 'black');
        drawText(ctx, 'hand', width * this.columnXs[1], this.headerHeight / 2, 1, 1, fontSmall, 'black');
        drawText(ctx, 'distribution', width * this.columnXs[2], this.headerHeight / 2, 1, 1, fontSmall, 'black');
        drawText(ctx, 'bid', width * this.columnXs[3], this.headerHeight / 2, 1, 1, fontSmall, 'black');
        drawText(ctx, 'took', width * this.columnXs[4], this.headerHeight / 2, 1, 1, fontSmall, 'black');
        drawText(ctx, 'AI bid', width * this.columnXs[5], this.headerHeight / 2, 1, 1, fontSmall, 'black');
        drawText(ctx, 'difficulty', width* this.columnXs[6], this.headerHeight / 2, 1, 1, fontSmall, 'black');
    }

    paintBody(ctx, width, height) {
        let h = (height - this.headerHeight - 2) / this.players.length;
        for (let i = 0; i <= this.players.length; i++) {
            ctx.strokeStyle = '#C0C0C0';
            drawLine(ctx, this.margin, this.headerHeight + i * h, width - this.margin, this.headerHeight + i * h);

            if (i == this.players.length) {
                break;
            }

            let player = this.players[i];
            let h0 = this.headerHeight + player.index * h + h / 2;

            // name
            drawText(ctx, player.name, 2 * this.margin, h0, 0, 1, font, this.options.teams ? colors[player.team] : 'black');

            // trump
            if (player.index == this.dealers[this.selected]) {
                drawCard(ctx, new Card(), width * this.columnXs[0] - 4, h0 + 30 - 4, smallCardScale, true, false, h0 + h / 2, undefined);
                drawCard(ctx, new Card(), width * this.columnXs[0] - 2, h0 + 30 - 2, smallCardScale, true, false, h0 + h / 2, undefined);
                drawCard(ctx, this.trumps[this.selected], width * this.columnXs[0], h0 + 30, smallCardScale, true, false, h0 + h / 2, undefined);
            }

            // hand
            let hand = player.hands[this.selected];
            for (let j = 0; j < hand.length; j++) {
                drawCard(ctx, hand[j], width * this.columnXs[1] + 10 * (j - (hand.length - 1) / 2), h0 + 30, smallCardScale, true, false, h0 + h / 2, undefined)
            }

            // distribution


            // bid, took, ai bid, difficulty
            drawText(ctx,
                this.selected < player.bids.length ? player.bids[this.selected] : '--',
                width * this.columnXs[3], h0, 1, 1, font, 'black');
            let madeColor = 'black';
            if (this.selected < player.takens.length) {
                player.takens[this.selected] == player.bids[this.selected] ? 'green' : 'red';
            }
            drawText(ctx,
                this.selected < player.takens.length ? player.takens[this.selected] : '--',
                width * this.columnXs[4], h0, 1, 1, font,
                madeColor);
            drawText(ctx,
                this.selected < player.aiBids.length ? player.aiBids[this.selected] : '--',
                width * this.columnXs[5], h0, 1, 1, font, 'black');
            let dScale = 255 * (player.diffs[this.selected] - 1) / 9;
            drawText(ctx,
                this.selected < player.diffs.length ? player.diffs[this.selected].toFixed(1) : '--',
                width * this.columnXs[6], h0, 1, 1, font, `rgb(${dScale}, ${0.75 * (255 - dScale)}, 0)`);
        }
    }

    paint() {
        this.panel.paint();
    }
}

class PostGamePlaysTab extends PostGameTab {
    constructor(page, index) {
        super(page, index);

        this.elements = [
            document.getElementById("igPlaysTabContainer")
        ];

        this.headerHeight = 35;
        this.margin = 4;
        this.columnXs = [
            3/16, 5.5/16, 5/8, 7/8
        ];

        let parent = this;
        class PlaysPanel extends PanelInteractable {
            constructor() {
                super(
                    document.getElementById("igPlaysContainer"),
                    document.getElementById("igPlaysCanvas"),
                    true
                );
            }

            wheel(y) {
                parent.deltaRound(Math.sign(y));
            }

            paint() {
                super.paint();
                parent.paintHeader(this.ctx, this.width());
                parent.paintBody(this.ctx, this.width(), this.height());
            }
        }
        this.panel = new PlaysPanel();
        this.interactables = [this.panel];
    }

    addData(data) {
        this.options = data.options;
        this.numRounds = data.players[0].hands.length;
        this.numTricks = new Array(this.numRounds);

        this.rounds = data.rounds.map(r => r.handSize);
        this.dealers = data.rounds.map(r => r.dealer);
        this.claims = data.claims;

        let div = document.getElementById('igPlaysRoundsButtonContainer');
        while (div.firstChild) {
            div.removeChild(div.firstChild);
        }
        this.buttons0 = new Array(this.numRounds);
        for (let i = 0; i < this.numRounds; i++) {
            let button = document.createElement('button');
            button.classList.add(
                'bg-white', 'rounded-lg', 'border', 'border-black', 'w-5', 'h-5',
                'font-bold', 'text-sm', 'select-none', 'hover:bg-gray-300'
            );
            button.innerHTML = this.rounds[i];
            button.addEventListener('click', () => {
                this.selectRound(i);
                this.selectTrick(0);
            });
            div.appendChild(button);
            this.buttons0[i] = button;

            let min = Math.min(...data.players.map(p => p.plays[i].length));
            let max = Math.max(...data.players.map(p => p.plays[i].length));

            this.numTricks[i] = max;
            if (max == 0 || (min == max && max < this.rounds[i] && this.claims[i] != -1)) {
                this.numTricks[i]++;
            }
        }

        this.selected0 = undefined;
        this.selected1 = undefined;
        this.selectRound(0);
        this.selectTrick(0);

        this.players = data.players;
        this.trumps = data.trumps;
        this.leaders = data.leaders;
        this.winners = data.winners;

        // should I put this mess server-side?
        this.hands = new Array(this.players.length);
        this.playIndices = new Array(this.players.length);
        this.wants = new Array(this.players.length);
        for (let i = 0; i < this.players.length; i++) {
            let player = this.players[i];
            this.hands[i] = new Array(this.numRounds);
            this.playIndices[i] = new Array(this.numRounds);
            this.wants[i] = new Array(this.numRounds);
            for (let j = 0; j < this.numRounds; j++) {
                this.hands[i][j] = new Array(this.numTricks[j]);
                this.playIndices[i][j] = new Array(this.numTricks[j]);
                this.wants[i][j] = new Array(this.numTricks[j]);

                let hand = player.hands[j];
                let want = player.bids[j];
                for (let k = 0; k < this.numTricks[j]; k++) {
                    this.hands[i][j][k] = hand;
                    hand = hand.map(c => c);
                    if (player.plays[j][k] !== undefined) {
                        for (let l = 0; l < hand.length; l++) {
                            if (hand[l].matches(player.plays[j][k])) {
                                this.playIndices[i][j][k] = l;
                                hand.splice(l, 1);
                                break;
                            }
                        }
                    } else if (k >= this.leaders[j].length) {
                        if (k == 0) {
                            this.leaders[j][k] = (this.dealers[j] + 1) % this.players.length;
                        } else {
                            this.leaders[j][k] = this.winners[j][k - 1];
                        }
                    }
                    this.wants[i][j][k] = want;
                    if (i == this.winners[j][k]) {
                        want--;
                    }
                }
            }
        }
    }

    wheel(y) {
        this.deltaRound(Math.sign(y));
    }

    deltaRound(e) {
        if (e == -1) {
            if (this.selected1 == 0 && this.selected0 > 0) {
                this.selectRound(this.selected0 - 1);
                this.selectTrick(this.buttons1.length - 1);
            } else if (this.selected1 > 0) {
                this.selectTrick(this.selected1 - 1);
            }
        } else {
            if (this.selected1 == this.buttons1.length - 1 && this.selected0 < this.buttons0.length - 1) {
                this.selectRound(this.selected0 + 1);
                this.selectTrick(0);
            } else if (this.selected1 < this.buttons1.length - 1) {
                this.selectTrick(this.selected1 + 1);
            }
        }
    }

    selectRound(i) {
        if (i == this.selected0) {
            return;
        }

        if (this.selected0 !== undefined) {
            toggleButton(this.buttons0[this.selected0]);
        }
        this.selected0 = i;
        toggleButton(this.buttons0[this.selected0]);

        let div = document.getElementById('igPlaysTricksButtonContainer');
        while (div.firstChild) {
            div.removeChild(div.firstChild);
        }
        this.buttons1 = new Array(this.numTricks[i]);
        for (let j = 1; j <= this.numTricks[i]; j++) {
            let button = document.createElement('button');
            button.classList.add(
                'bg-white', 'rounded-lg', 'border', 'border-black', 'w-5', 'h-5',
                'font-bold', 'text-sm', 'select-none', 'hover:bg-gray-300'
            );
            button.innerHTML = j;
            button.addEventListener('click', () => {
                this.selectTrick(j - 1);
            });
            div.appendChild(button);
            this.buttons1[j - 1] = button;
        }
        this.selected1 = undefined;
    }

    selectTrick(j) {
        if (j == this.selected1) {
            return;
        }

        if (this.selected1 !== undefined) {
            toggleButton(this.buttons1[this.selected1]);
        }
        this.selected1 = j;
        toggleButton(this.buttons1[this.selected1]);
    }

    paintHeader(ctx, width) {
        drawText(ctx, 'trump', width * this.columnXs[0], this.headerHeight / 2, 1, 1, fontSmall, 'black');
        drawText(ctx, 'led/won', width * this.columnXs[1], this.headerHeight / 2, 1, 1, fontSmall, 'black');
        drawText(ctx, 'hand', width * this.columnXs[2], this.headerHeight / 2, 1, 1, fontSmall, 'black');
        drawText(ctx, 'tricks wanted', width * this.columnXs[3], this.headerHeight / 2, 1, 1, fontSmall, 'black');
    }

    paintBody(ctx, width, height) {
        let h = (height - this.headerHeight - 2) / this.players.length;
        for (let i = 0; i <= this.players.length; i++) {
            ctx.strokeStyle = '#C0C0C0';
            drawLine(ctx, this.margin, this.headerHeight + i * h, width - this.margin, this.headerHeight + i * h);

            if (i == this.players.length) {
                break;
            }

            let player = this.players[i];
            let h0 = this.headerHeight + player.index * h + h / 2;

            // name
            drawText(ctx, player.name, 2 * this.margin, h0, 0, 1, font, this.options.teams ? colors[player.team] : 'black');

            // trump
            if (player.index == this.dealers[this.selected0]) {
                drawCard(ctx, new Card(), width * this.columnXs[0] - 4, h0 + 30 - 4, smallCardScale, true, false, h0 + h / 2, undefined);
                drawCard(ctx, new Card(), width * this.columnXs[0] - 2, h0 + 30 - 2, smallCardScale, true, false, h0 + h / 2, undefined);
                drawCard(ctx, this.trumps[this.selected0], width * this.columnXs[0], h0 + 30, smallCardScale, true, false, h0 + h / 2, undefined);
            }

            // leader/winner/claim
            let leader = player.index == this.leaders[this.selected0][this.selected1];
            let winner = player.index == this.winners[this.selected0][this.selected1];
            let claimer = player.index == this.claims[this.selected0] && this.selected1 == this.numTricks[this.selected0] - 1;
            if (leader) {
                ctx.fillStyle = 'rgb(200, 200, 200)';
                drawOval(ctx, width * this.columnXs[1] - 8 - (winner ? 10 : 0) - (claimer ? 30 : 0), h0 - 8, 16, 16);
                drawText(ctx, '>', width * this.columnXs[1] - (winner ? 10 : 0) - (claimer ? 30 : 0), h0, 1, 1, font, 'black');
            }
            if (winner) {
                ctx.fillStyle = 'rgb(175, 175, 0)';
                drawOval(ctx, width * this.columnXs[1] - 8 + (leader ? 10 : 0), h0 - 8, 16, 16);
                drawText(ctx, 'w', width * this.columnXs[1] + (leader ? 10 : 0), h0, 1, 1, font, 'black');
            }
            if (claimer) {
                ctx.fillStyle = 'rgb(225, 175, 225)';
                drawOval(ctx, width * this.columnXs[1] - 25 + (leader ? 10 : 0), h0 - 12, 50, 24);
                drawText(ctx, 'claim', width * this.columnXs[1] + (leader ? 10 : 0), h0, 1, 1, font, 'black');
            }

            // hand
            let hand = this.hands[i][this.selected0][this.selected1];
            for (let j = 0; j < hand.length; j++) {
                drawCard(ctx,
                    hand[j],
                    width * this.columnXs[2] + 30 * (j - (hand.length - 1) / 2),
                    h0 + h / 2 + 15 - (j == this.playIndices[i][this.selected0][this.selected1] ? 15 : 0),
                    smallCardScale, true, false, h0 + h / 2, undefined);
            }
            for (let j = 0; j < hand.length; j++) {
                let x = width * this.columnXs[2] + 30 * (j - (hand.length - 1) / 2);
                let prob = this.selected1 < player.makingProbs[this.selected0].length ? player.makingProbs[this.selected0][this.selected1][j][1] : -1;
                if (prob != -1) {
                    ctx.fillStyle = 'white';
                    drawOval(ctx, x - 12, h0 - h / 2 + 15 - 8, 24, 16, true);
                    ctx.strokeStyle = 'black';
                    drawOval(ctx, x - 12, h0 - h / 2 + 15 - 8, 24, 16, false);
                }
                drawText(ctx,
                    prob == -1 ? '' : (100 * prob).toFixed(0) + '%',
                    x, h0 - h / 2 + 15,
                    1, 1, fontSmall, `rgb(${255 * (1 - prob)}, ${0.75 * 255 * prob}, 0)`
                );
            }

            // wants
            let want = this.wants[i][this.selected0][this.selected1] !== undefined ? this.wants[i][this.selected0][this.selected1] : '--';
            drawText(ctx, want, width * this.columnXs[3], h0, 1, 1, font, 'black');
        }
    }

    paint() {
        this.panel.paint();
    }
}

/*
 * OhcCanvas
 */
class OhcCanvas {
    constructor() {
        this.interactableMoused = undefined;
    	this.interactablePressed = undefined;
        this.timerQueue = new TimerQueue();
    	if (this.initialize !== undefined) {
    		this.initialize();
    	}
    }

    setBackground(image) {
        this.background = image;
    }

    backgroundCenterX() {
    	return cachedWidth / 2;
    };

    backgroundCenterY() {
    	return cachedHeight / 2;
    };

    isShown() {
    	return true;
    };

    pushTimerEntry(entry, front) {
        this.timerQueue.push(entry, front);
    }

    mouseMoved(x, y) {
        if (this.interactables === undefined) {
    		return;
    	}

    	if (this.interactablePressed !== undefined && this.interactablePressed.draggable) {
            this.interactablePressed.dragTo(x, y);
        } else {
            let anyMoused = false;

        	for (let i = 0; i < this.interactables.length; i++) {
                for (let j = 0; j < this.interactables[i].length; j++) {
                    let inter = this.interactables[i][j];
                    let moused = inter.updateMoused(x, y);
                    if (moused !== undefined) {
                        if (this.interactableMoused !== undefined && this.interactableMoused !== moused) {
                        	this.interactableMoused.setMoused(false);
                        	this.interactableMoused.setPressed(false);
                        }
                        this.interactableMoused = moused;
                        anyMoused = true;
                    }
                }
            }

            if (this.interactableMoused !== undefined && !anyMoused) {
            	this.interactableMoused.setMoused(false);
            	this.interactableMoused.setPressed(false);
            	this.interactableMoused = undefined;
            }
        }

        if (!this.interactableMoused) {
            document.body.style.cursor = 'default';
        }
    }

    mousePressed(x, y, button) {
        if (button == 0) {
            this.mouseMoved(x, y);
            if (this.interactableMoused !== undefined) {
            	this.interactableMoused.setPressed(true);
            	this.interactablePressed = this.interactableMoused;
            }
        } else if (button == 2 && this.rightClick != undefined) {
        	this.rightClick(x, y);
        }
    }

    mouseReleased(x, y, button) {
        if (button == 0) {
            if (this.interactableMoused !== undefined && this.interactableMoused == this.interactablePressed) {
                let relay = this.interactableMoused;
                this.interactableMoused = undefined;
                this.interactablePressed = undefined;
                if (relay.click !== undefined) {
                	relay.click();
                    return;
                }
            }
            this.mouseMoved(x, y);
        }

        // nothing was clicked
        if (this.clickOnNothing !== undefined) {
            this.clickOnNothing();
        }
    }

    wheel(y) {
        if (this.interactableMoused !== undefined) {
            this.interactableMoused.wheel(y);
        }
    }

    keyPressed(code) {}

    paint() {
        if (!this.isShown()) {
    		return;
    	}

    	if (this.background !== undefined) {
    		let ratios = [
    	        this.backgroundCenterX() * 2 / this.background.width,
    	        (cachedWidth - this.backgroundCenterX()) * 2 / this.background.width,
    	        this.backgroundCenterY() * 2 / this.background.height,
    	        (cachedHeight - this.backgroundCenterY()) * 2 / this.background.height
    		];
    		let scale = 1;
    		for (let i = 0; i < 4; i++) {
    		    scale = Math.max(scale, ratios[i]);
    		}

    		ctx.drawImage(this.background,
    				this.backgroundCenterX() - scale * this.background.width / 2,
    				this.backgroundCenterY() - scale * this.background.height / 2,
    				scale * this.background.width,
    				scale * this.background.height
    		);
    	}

    	if (this.customPaintFirst !== undefined) {
    		this.customPaintFirst();
    	}

        this.timerQueue.tick();

    	if (this.interactables !== undefined) {
    		for (let i = 0; i < this.interactables.length; i++) {
    			for (let j = 0; j < this.interactables[i].length; j++) {
    				this.interactables[i][j].paint();
    			}
    		}
    	}

        if (this.customPaintLast !== undefined) {
    		this.customPaintLast();
    	}
    }
}

class PlainCanvas extends OhcCanvas {
    constructor() {
        super();
    }

    initialize() {
        this.setBackground(document.getElementById('background'));
    }
}

/*
 * MainMenuCanvas
 */
class MainMenuCanvas extends OhcCanvas {
    constructor() {
        super();
    }

    initialize() {
        this.setBackground(document.getElementById('background'));

        let joinGameButton = document.getElementById('mmJoinMp');
        joinGameButton.addEventListener('click', () => {reloadWithId(this.gameSelected());});

        document.getElementById('mmHostMp').addEventListener('click', () => goToModeSelect(true));
        document.getElementById('mmSinglePlayer').addEventListener('click', () => goToModeSelect(false));

        document.getElementById('mmSavedGame').addEventListener('click', () => openFile());
        document.getElementById('mmLogout').addEventListener('click', logout);

        class GameListEntry extends CanvasInteractable {
            constructor(i) {
                super();
                this.index = i;
            }
        }
        class GameList extends PanelInteractable {
            constructor() {
                super(
                    document.getElementById('mmGameListContainer'),
                    document.getElementById('mmGameListCanvas'),
                    true
                );
                this.size = 0;
                this.headerHeight = 20;
                this.lineV = 10;

                this.columnXs = [1/10, 3/10, 5/10, 7/10, 9/10];

                this.selected = -1;
            }

            paint() {
                super.paint();

                if (games.length != this.size) {
                    this.makeGameInteractables();
                }

                if (this.selected == -1) {
                    disableButton(joinGameButton);
                } else {
                    enableButton(joinGameButton);
                }

                drawText(this.ctx, 'id', this.width() * this.columnXs[0], this.headerHeight / 2, 1, 1, fontBold, 'black');
                drawText(this.ctx, 'host', this.width() * this.columnXs[1], this.headerHeight / 2, 1, 1, fontBold, 'black');
                drawText(this.ctx, 'game', this.width() * this.columnXs[2], this.headerHeight / 2, 1, 1, fontBold, 'black');
                drawText(this.ctx, '# players', this.width() * this.columnXs[3], this.headerHeight / 2, 1, 1, fontBold, 'black');
                drawText(this.ctx, 'status', this.width() * this.columnXs[4], this.headerHeight / 2, 1, 1, fontBold, 'black');
                drawLine(this.ctx, 2, this.headerHeight + this.lineV / 2, this.width() - 2, this.headerHeight + this.lineV / 2);

                for (const inter of this.interactables) {
                    inter.paint();
                }
            }

            makeGameInteractables() {
                this.interactables.length = 0;

                for (let i = 0; i < games.length; i++) {
                    let entry = new GameListEntry(i);
                    entry.x = () => {return this.x();};
                    entry.offset = this.headerHeight + this.lineV + 20 * i;
                    entry.y = () => {return this.y() + entry.offset;};
                    entry.width = () => {return this.width();};
                    entry.height = () => {return 20;};
                    entry.paint = () => {
                        let fnt = font;

                        if (i == this.selected) {
                            let fnt = fontBold;
                            this.ctx.fillStyle = 'rgb(230, 230, 230)';
                            drawBox(this.ctx, 2, entry.offset, entry.width() - 4, entry.height(), 10);
                        }
                        let inGame = games[i].state == 'In game';

                        let modeColor = 'black';
                        switch (games[i].mode) {
                            case 'Oh Hell':
                                modeColor = 'green';
                                break;
                            case 'Oregon Hearts':
                                modeColor = 'rgb(255, 100, 100)';
                                break;
                        }

                        drawText(this.ctx, games[i].id, entry.width() * this.columnXs[0], entry.offset + entry.height() / 2, 1, 1, fnt, 'black');
                        drawText(this.ctx, games[i].host.substring(0, 15), entry.width() * this.columnXs[1], entry.offset + entry.height() / 2, 1, 1, fnt, 'black');
                        drawText(this.ctx, games[i].mode, entry.width() * this.columnXs[2], entry.offset + entry.height() / 2, 1, 1, fnt, modeColor);
                        drawText(this.ctx, games[i].players, entry.width() * this.columnXs[3], entry.offset + entry.height() / 2, 1, 1, fnt, 'black');
                        drawText(this.ctx, games[i].state, entry.width() * this.columnXs[4], entry.offset + entry.height() / 2, 1, 1, fnt, inGame ? 'orange' : 'green');
                    };
                    entry.click = () => {this.selected = i;};
                    this.interactables.push(entry);
                }

                if (games.length && this.selected < 0) {
                    this.selected = 0;
                } else if (this.selected >= games.length) {
                    this.selected = games.length - 1;
                }

                this.size = games.length;
            }
        }
        this.gameList = new GameList();

        this.interactables = [[this.gameList]];
    }

    gameSelected() {
        if (this.gameList.selected < 0 || this.gameList.selected >= games.length) {
            return undefined;
        } else {
            return games[this.gameList.selected].id;
        }
    }

    refreshGames() {
        let te = new TimerEntry(500);
        te.onFirstAction = () => {requestGameList()};
        te.onLastAction = () => {this.refreshGames()};
        this.pushTimerEntry(te);
    }
}

/*
 * InGameCanvas
 */
class InGameCanvas extends OhcCanvas {
    constructor() {
        super();
    }

    initialize() {
        this.setBackground(document.getElementById('background'));
        let thisCanvas = this;

        // filled out statically
        class TeamsPanel extends PanelInteractable {
            constructor() {
                super(
                    document.getElementById('igTeamsContainer'),
                    document.getElementById('igTeamsCanvas'),
                    true
                );

                let parent = this;

                class PlayerButton extends CanvasInteractable {
                    constructor(player) {
                        super();
                        this.player = player;
                        this.y0 = 1;
                    }

                    x() {return parent.x() + 5;}
                    y() {return parent.y() + this.y0 - 9;}
                    width() {return parent.width() - 10;}
                    height() {return 19;}

                    isEnabled() {
                        return myPlayer.host;
                    }

                    paint() {
                        let x = this.x() - parent.x();
                        let y = this.y() - parent.y();

                        if (this.isEnabled()) {
                            if (this.isMoused()) {
                                parent.ctx.fillStyle = '#C0C0C0';
                                drawBox(parent.ctx, x, y, this.width(), this.height(), 10, undefined, true);
                            }
                            if (parent.playerSelected === this.player) {
                                parent.ctx.fillStyle = '#C0C0C0';
                                drawBox(parent.ctx, x, y, this.width(), this.height(), 10, undefined, false);
                            }
                        }

                        drawText(parent.ctx, this.player.name, x + this.width() / 2, y + 10, 1, 1, font, 'black');
                    }

                    click() {
                        if (parent.playerSelected === this.player) {
                            parent.playerSelected = undefined;
                        } else {
                            parent.playerSelected = this.player;
                        }
                    }
                }
                this.PlayerButton = PlayerButton;

                class TeamButton extends CanvasInteractable {
                    constructor(number) {
                        super();
                        this.number = number;
                        this.members = [];
                        this.y0 = 1;
                    }

                    x() {return parent.x() + 1;}
                    y() {return parent.y() + this.y0;}
                    width() {return parent.width() - 2;}
                    height() {return this.members.length * 20 + 25;}

                    isShown() {return this.members.length > 0;}

                    paint() {
                        this.members = teams[this.number].members;

                        this.interactables = this.members.map(p => parent.playerButtons[p.id]);

                        if (!this.isShown()) {
                            return;
                        }

                        let x = this.x() - parent.x();
                        let y = this.y() - parent.y();

                        parent.ctx.fillStyle = this.isMoused() && this.interactableMoused === this ? '#C0C0C0' : 'white';
                        drawBox(parent.ctx, x, y, this.width(), this.height(), 10, colors[this.number]);

                        drawText(parent.ctx, teams[this.number].name, x + this.width() / 2, y + 10, 1, 1, fontBold, colors[this.number]);
                        for (let i = 0; i < this.members.length; i++) {
                            this.interactables[i].y0 = y + 10 + 20 * (i + 1);
                            this.interactables[i].paint();
                        }
                    }

                    click() {
                        if (parent.playerSelected !== undefined) {
                            reteam(parent.playerSelected.index, this.number);
                            parent.playerSelected = undefined;
                        } else {
                            reteam(myPlayer.index, this.number);
                        }
                    }
                }

                this.playerButtons = {};
                this.playerSelected = undefined;

                this.teamButtons = [];
                for (const team of teams) {
                    this.teamButtons.push(new TeamButton(team.number));
                }
                this.interactables = this.teamButtons;
            }

            paint() {
                super.paint();

                for (const player of players) {
                    if (this.playerButtons[player.id] === undefined) {
                        this.playerButtons[player.id] = new this.PlayerButton(player);
                    }
                }

                let y = 1;
                for (const button of this.teamButtons) {
                    button.y0 = y;
                    button.paint();
                    if (button.isShown()) {
                        y += button.height() + 5;
                    }
                }

                this.element.style.height = y + 'px';
                document.getElementById('teamsDiv').style.height =
                    y + 40
                    + document.getElementById('igNewTeam').clientHeight
                    + document.getElementById('igRandomizeTeams').clientHeight
                    + 'px';
            }
        }
        this.teamsPanel = new TeamsPanel();
        document.getElementById("igNewTeam").addEventListener('click', () => {
            if (this.teamsPanel.playerSelected !== undefined) {
                reteam(this.teamsPanel.playerSelected.index);
                this.teamsPanel.playerSelected = undefined;
            } else {
                reteam(myPlayer.index)
            }
        });
        document.getElementById("igRandomizeTeams").addEventListener('click', () => scrambleTeams());

        this.scoreSheet = new ScoreSheet('ig');
        this.scoreSheet.x = function () {return cachedWidth - (scoreWidth - scoreMargin);};
        this.scoreSheet.y = function () {return scoreMargin;};
        this.scoreSheet.width = function () {return scoreWidth - 2 * scoreMargin;};
        this.scoreSheet.getPlayers = () => this.scoreSheetPlayers();
        this.scoreSheet.getTeams = () => this.scoreSheetTeams();
        this.scoreSheet.getRounds = () => this.scoreSheetRounds();
        this.scoreSheet.getOptions = () => this.scoreSheetOptions();
        this.scoreSheet.container = () => gameState == GameState.POSTGAME ? document.getElementById('postGameDiv') : document.getElementById('inGameDiv');
        this.scoreSheet.isShown = () => gameState != GameState.PREGAME;

        class Hotdog extends PanelInteractable {
            constructor() {
                super(
                    document.getElementById('igHotdogContainer'),
                    document.getElementById('igHotdogCanvas'),
                    false
                );
            }

            x() {return thisCanvas.scoreSheet.x();}
            y() {return thisCanvas.scoreSheet.y() + thisCanvas.scoreSheet.height() + 5;}
            width() {return thisCanvas.scoreSheet.width();}
            height() {return 24;}
            container() {return document.getElementById('inGameDiv');}

            paint() {
                super.paint();
                if (!gameState || gameState == GameState.PREGAME || gameState == GameState.POSTGAME || roundNumber >= rounds.length) {
                    return;
                }

                this.clear();
                this.fillContainer();

                let handSize = rounds[roundNumber].handSize;
                let totalBid = 0;
                let totalMaxBidTaken = 0;
                if (options.teams) {
                    totalBid = teams.map(t => t.bid()).reduce((a, b) => a + b, 0);
                    totalMaxBidTaken = teams.map(t => Math.max(t.bid(), t.taken())).reduce((a, b) => a + b, 0);
                } else {
                    totalBid = players.map(p => p.hasBid() ? p.getBid() : 0).reduce((a, b) => a + b, 0);
                    totalMaxBidTaken = players.map(p => p.hasBid() ? Math.max(p.getBid(), p.getTaken()) : 0).reduce((a, b) => a + b, 0);
                }

                let leftMessage = totalBid <= handSize ?
                    'Underbid by: ' + (handSize - totalBid) :
                    'Overbid by: ' + (totalBid - handSize);
                let rightMessage = totalMaxBidTaken <= handSize ?
                    'Unwanted tricks: ' + (handSize - totalMaxBidTaken) :
                    'Excess tricks wanted: ' + (totalMaxBidTaken - handSize);

                let leftColor = totalBid <= handSize ? 'rgb(0, 0, 120)' : 'rgb(120, 0, 0)';
                let rightColor = totalMaxBidTaken <= handSize ? 'rgb(0, 0, 120)' : 'rgb(120, 0, 0)';
                if (totalMaxBidTaken == handSize) {
                    rightColor = 'rgb(0, 120, 0)';
                }

                drawText(this.ctx, leftMessage, this.width() / 4, this.height() / 2, 1, 1, fontBold, leftColor);
                drawText(this.ctx, rightMessage, 3 * this.width() / 4, this.height() / 2, 1, 1, fontBold, rightColor);
            }
        }
        this.hotdog = new Hotdog();

        class TeamInfo extends PanelInteractable {
            constructor() {
                super(
                    document.getElementById('igTeamInfoContainer'),
                    document.getElementById('igTeamInfoCanvas'),
                    false
                );
            }

            x() {return thisCanvas.scoreSheet.x();}
            y() {return thisCanvas.scoreSheet.y() + thisCanvas.scoreSheet.height() + 5 + thisCanvas.hotdog.height() + 5;}
            width() {return thisCanvas.scoreSheet.width();}
            height() {return 24;}
            container() {return document.getElementById('inGameDiv');}

            paint() {
                super.paint();
                if (!gameState || gameState == GameState.PREGAME || gameState == GameState.POSTGAME || roundNumber >= rounds.length || myPlayer.kibitzer || !options.teams) {
                    return;
                }

                this.clear();
                this.fillContainer();

                let bid = teams[myPlayer.team].members.reduce((b, p) => b + p.bid, 0);
                let taken = teams[myPlayer.team].members.reduce((t, p) => t + p.taken, 0);

                let leftMessage = 'Team bid: ' + bid;
                let rightMessage = 'Team taken: ' + taken;

                let handSize = myPlayer.hand.length;
                if (!myPlayer.trick.isEmpty()) {
                    handSize++;
                }
                let leftColor = bid - taken > handSize ? 'rgb(120, 0, 0)' : 'rgb(0, 0, 120)';
                let rightColor = bid >= taken ? 'rgb(0, 0, 120)' : 'rgb(120, 0, 0)';
                if (bid == taken) {
                    rightColor = 'rgb(0, 120, 0)';
                }

                drawText(this.ctx, leftMessage, this.width() / 4, this.height() / 2, 1, 1, fontBold, leftColor);
                drawText(this.ctx, rightMessage, 3 * this.width() / 4, this.height() / 2, 1, 1, fontBold, rightColor);
            }
        }
        this.teamInfo = new TeamInfo();

        class LastTrick extends CanvasCard {
            paint() {
                super.paint();
                if (this.isMoused()) {
                    for (let k = 0; k < players.length; k++) {
                        let x0 = Math.min(this.xCenter() + 50, cachedWidth - scoreWidth - lastTrickSeparation * (players.length - 1) - cardWidth / 2 - 10);
                        let y0 = Math.max(this.yCenter(), cardHeight / 2 + 10);
                        drawCard(ctx, players[k].getLastTrick(), x0 + lastTrickSeparation * k, y0, 1, true, false, -1, undefined);
                    }
                }
            }
        }
        this.lastTrick = new LastTrick(new Card(), smallCardScale, true);
        this.lastTrick.player = function () {return players[leader];};
        this.lastTrick.xCenter = function () {return this.player().getTakenX() + takenXSeparation * (this.player().getTaken() - 1);};
        this.lastTrick.yCenter = function () {return this.player().getTakenY() + takenYSeparation * (this.player().getTaken() - 1);};
        this.lastTrick.isShown = function () {
            return trickTaken
                && takenTimer == 1
                && gameState == GameState.PLAYING;
        };
        this.lastTrick.isEnabled = function () {return gameState == GameState.PLAYING;};
        let oldPaint = this.lastTrick.paint;

        let showCardButton = document.createElement('button');
        showCardButton.innerHTML = 'Show card';
        showCardButton.classList.add(
            'bg-white', 'rounded-lg', 'border', 'border-black', 'w-5', 'h-5',
            'font-bold', 'text-sm', 'select-none', 'hover:bg-gray-300'
        );
        showCardButton.addEventListener('click', () => showOneCard = true);
        this.showCard = new WrappedDOMElement(showCardButton);
        this.showCard.x = () => (cachedWidth - scoreWidth) / 2 - 40;
        this.showCard.y = () => cachedHeight - handYOffset - this.showCard.height() / 2;
        this.showCard.width = () => 80;
        this.showCard.height = () => 30;
        this.showCard.container = () => document.getElementById('inGameDiv');
        this.showCard.isShown = () =>
                thisCanvas.cardInteractables !== undefined
                && thisCanvas.cardInteractables.length > 0
                && thisCanvas.cardInteractables[0].hidden()
                && gameState == GameState.BIDDING;

        let acceptButton = document.createElement('button');
        acceptButton.classList.add(
            'bg-white', 'rounded-lg', 'border', 'border-black', 'w-5', 'h-5',
            'font-bold', 'text-sm', 'select-none', 'hover:bg-gray-300'
        );
        this.messageAccept = new WrappedDOMElement(acceptButton);
        this.messageAccept.x = () => (cachedWidth - scoreWidth) / 2 - 100;
        this.messageAccept.y = () => cachedHeight / 2 + 50;
        this.messageAccept.width = () => 80;
        this.messageAccept.height = () => 30;
        this.messageAccept.container = () => document.getElementById('inGameDiv');
        this.messageAccept.isShown = () => showMessageButtons;

        let declineButton = document.createElement('button');
        declineButton.classList.add(
            'bg-white', 'rounded-lg', 'border', 'border-black', 'w-5', 'h-5',
            'font-bold', 'text-sm', 'select-none', 'hover:bg-gray-300'
        );
        this.messageDecline = new WrappedDOMElement(declineButton);
        this.messageDecline.x = () => (cachedWidth - scoreWidth) / 2 + 20;
        this.messageDecline.y = () => cachedHeight / 2 + 50;
        this.messageDecline.width = () => 80;
        this.messageDecline.height = () => 30;
        this.messageDecline.container = () => document.getElementById('inGameDiv');
        this.messageDecline.isShown = () => showMessageButtons;

        let leaveB = document.createElement('button');
        leaveB.innerHTML = 'Leave table';
        leaveB.classList.add(
            'bg-white', 'rounded-lg', 'border', 'border-black', 'w-5', 'h-5',
            'font-bold', 'text-md', 'select-none', 'hover:bg-gray-300'
        );
        leaveB.addEventListener('click', () => leaveGame());
        this.leaveButton = new WrappedDOMElement(leaveB);
        this.leaveButton.x = () => 10;
        this.leaveButton.y = () => cachedHeight - (this.leaveButton.height() + 10);
        this.leaveButton.width = () => 105;
        this.leaveButton.height = () => 32;
        this.leaveButton.container = () => document.getElementById('inGameDiv');
        this.leaveButton.isShown = () => gameState == GameState.BIDDING || gameState == GameState.PLAYING || gameState == GameState.PASSING;

        let endB = document.createElement('button');
        endB.innerHTML = 'End game';
        endB.classList.add(
            'bg-white', 'rounded-lg', 'border', 'border-black', 'w-5', 'h-5',
            'font-bold', 'text-md', 'select-none', 'hover:bg-gray-300'
        );
        endB.addEventListener('click', () => requestEndGame());
        this.endButton = new WrappedDOMElement(endB);
        this.endButton.x = () => 10;
        this.endButton.y = () => cachedHeight - 2 * (this.leaveButton.height() + 10);
        this.endButton.width = () => 105;
        this.endButton.height = () => 32;
        this.endButton.container = () => document.getElementById('inGameDiv');
        this.endButton.isEnabled = () => myPlayer !== undefined && myPlayer.isHost();
        this.endButton.isShown = () => gameState == GameState.BIDDING || gameState == GameState.PLAYING || gameState == GameState.PASSING;

        let claimB = document.createElement('button');
        claimB.innerHTML = 'Claim';
        claimB.classList.add(
            'bg-white', 'rounded-lg', 'border', 'border-black', 'w-5', 'h-5',
            'font-bold', 'text-md', 'select-none', 'hover:bg-gray-300'
        );
        claimB.addEventListener('click', () => makeClaim());
        this.claimButton = new WrappedDOMElement(claimB);
        this.claimButton.x = () => 10;
        this.claimButton.y = () => cachedHeight - 3 * (this.leaveButton.height() + 10);
        this.claimButton.width = () => 105;
        this.claimButton.height = () => 32;
        this.claimButton.container = () => document.getElementById('inGameDiv');
        this.claimButton.isShown = () => gameState == GameState.BIDDING || gameState == GameState.PLAYING || gameState == GameState.PASSING;

        let chatF = document.createElement('input');
        chatF.type = 'text';
        chatF.autocomplete = 'off';
        chatF.classList.add(
            'bg-white', 'rounded-lg', 'border', 'border-black', 'text-sm', 'p-2'
        );
        chatF.addEventListener('keydown', e => {
            if (e.keyCode == 13) {
                sendChat(chatF.value);
                chatF.value = '';
            }
        });
        this.chatField = new WrappedDOMElement(chatF);
        this.chatField.x = () => cachedWidth - this.chatField.width() - 10;
        this.chatField.y = () => cachedHeight - this.chatField.height() - 10;
        this.chatField.width = () => {
            if (gameState == GameState.PREGAME) {
                return 430;
            } else {
                return scoreWidth - 20;
            }
        };
        this.chatField.height = () => 32;
        this.chatField.container = () => stateDivs[state][gameState];

        let chatA = document.createElement('textarea');
        chatA.readOnly = true;
        chatA.style.resize = 'none';
        chatA.style.overflowY = 'auto';
        chatA.classList.add(
            'bg-white', 'rounded-lg', 'border', 'border-black', 'text-sm', 'p-2'
        );
        this.chatArea = new WrappedDOMElement(chatA);
        this.chatArea.x = () => cachedWidth - this.chatArea.width() - 10;
        this.chatArea.y = () => Math.max(
            cachedHeight - this.chatField.height() - 15 - maxChatHeight,
            (options.teams ? this.teamInfo.y() + this.teamInfo.height() : this.hotdog.y() + this.hotdog.height()) + 10
        );
        this.chatArea.width = () => {
            if (gameState == GameState.PREGAME) {
                return 430;
            } else {
                return scoreWidth - 20;
            }
        };
        this.chatArea.height = () => cachedHeight - this.chatArea.y() - this.chatField.height() - 15;
        this.chatArea.container = () => stateDivs[state][gameState];

        this.divider = new CanvasInteractable();
        this.divider.draggable = true;
        this.divider.x = () => cachedWidth - scoreWidth - 2;
        this.divider.y = () => 0;
        this.divider.width = () => 4;
        this.divider.height = () => cachedHeight;
        this.divider.cursor = () => 'w-resize';
        this.divider.dragTo = (x, y) => {
            scoreWidth = Math.max(400, Math.min(cachedWidth / 2, cachedWidth - x));
        };
        this.divider.paint = () => {
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
            drawLine(ctx,
                this.divider.x() + this.divider.width() / 2,
                this.divider.y(),
                this.divider.x() + this.divider.width() / 2,
                this.divider.y() + this.divider.height());
        }

        this.miscInteractables = [
            this.showCard,
            this.messageAccept,
            this.messageDecline,
            this.leaveButton,
            this.endButton,
            this.claimButton,
            this.chatField,
            this.chatArea,
            this.divider
        ];

        let passB = document.createElement('button');
        passB.innerHTML = 'Pass';
        passB.classList.add(
            'bg-white', 'rounded-lg', 'border', 'border-black', 'w-5', 'h-5',
            'font-bold', 'text-md', 'select-none', 'hover:bg-gray-300'
        );
        passB.addEventListener('click', () => makePass(pass.list));
        this.passButton = new WrappedDOMElement(passB);
        this.passButton.x = () => (cachedWidth - scoreWidth) / 2 - 100;
        this.passButton.y = () => cachedHeight - 310;
        this.passButton.width = () => 90;
        this.passButton.height = () => 30;
        this.passButton.container = () => document.getElementById('inGameDiv');
        this.passButton.isShown = () => gameState == GameState.PASSING && !myPlayer.passed && !myPlayer.isKibitzer();
        this.passButton.isEnabled = () => pass.list.length == pass.toPass;
        this.passButton.click = () => {}; // so cards don't deselect

        let abstainB = document.createElement('button');
        abstainB.innerHTML = 'Abstain';
        abstainB.classList.add(
            'bg-white', 'rounded-lg', 'border', 'border-black', 'w-5', 'h-5',
            'font-bold', 'text-md', 'select-none', 'hover:bg-gray-300'
        );
        abstainB.addEventListener('click', () => makePass([]));
        this.abstainButton = new WrappedDOMElement(abstainB);
        this.abstainButton.x = () => (cachedWidth - scoreWidth) / 2 + 10;
        this.abstainButton.y = () => cachedHeight - 310;
        this.abstainButton.width = () => 90;
        this.abstainButton.height = () => 30;
        this.abstainButton.container = () => document.getElementById('inGameDiv');
        this.abstainButton.isShown = () => gameState == GameState.PASSING && !myPlayer.passed && !myPlayer.isKibitzer();
        this.abstainButton.click = () => {}; // so cards don't deselect

        this.postGamePage = new PostGamePage();

        // filled out dynamically
        this.namePlates = [];
        this.robotButtons = [];
        this.cardInteractables = [];
        this.bidButtons = [];

        this.interactables = [
            [this.teamsPanel],
            [this.scoreSheet, this.hotdog, this.teamInfo],
            this.bidButtons,
            [this.passButton, this.abstainButton],
            this.cardInteractables,
            this.namePlates,
            [this.lastTrick],
            this.miscInteractables,
            this.robotButtons,
            [this.postGamePage]
        ];
    }

    cleanup() {
        this.namePlates.length = 0;
        this.cardInteractables.length = 0;
        this.bidButtons.length = 0;
        this.timerQueue.clear();
    }

    backgroundCenterX() {
        return (cachedWidth - scoreWidth) / 2;
    }

    scoreSheetPlayers() {
        if (gameState != GameState.POSTGAME) {
            return players;
        } else {
            return this.pgPlayers;
        }
    }

    scoreSheetTeams() {
        if (gameState != GameState.POSTGAME) {
            return teams;
        } else {
            return this.pgTeams;
        }
    }

    scoreSheetRounds() {
        if (gameState != GameState.POSTGAME) {
            return rounds;
        } else {
            return this.pgRounds;
        }
    }

    scoreSheetOptions() {
        if (gameState != GameState.POSTGAME) {
            return options;
        } else {
            return this.pgOptions;
        }
    }

    clickOnNothing() {
        if (gameState == GameState.PASSING && !myPlayer.passed) {
            pass.clear();
        } else {
            clearPreselected(0);
        }
    }

    customPaintFirst() {
        if (gameState) {
            this.adjustDivSizes();
            this.paintTrump();
            this.paintPlayers();
            this.paintTaken();
        }
    }

    customPaintLast() {
        if (gameState) {
            this.paintTrick();
            this.paintPreselected();
            if (message != '') {
                this.paintMessage();
            }
        }

        this.paintFrameRate();
    }

    adjustDivSizes() {
        if (gameState == GameState.BIDDING || gameState == GameState.PLAYING || gameState == GameState.PASSING) {
            if (scoreWidth == 0) {
                scoreWidth = 450;
            }
            scoreWidth = Math.max(400, Math.min(cachedWidth / 2, scoreWidth));
        } else if (gameState == GameState.POSTGAME) {
            let leftWidth = cachedWidth - scoreWidth;
            igPgLeft.style.width = leftWidth + 'px';
            igPgRight.style.width = scoreWidth + 'px';
        }
    }

    paintTrump() {
        if (gameState == GameState.PREGAME || gameState == GameState.POSTGAME || trump.isEmpty()) {
            return;
        }

        let x = 50;
        let y = 66;

        drawCard(ctx, new Card(), x - 4, y - 4, 1, true, false, -1, undefined);
        drawCard(ctx, new Card(), x - 2, y - 2, 1, true, false, -1, undefined);
        drawCard(ctx, trump, x, y, 1, true, false, -1, undefined);
    }

    paintPlayers() {
        if (gameState == GameState.PREGAME || gameState == GameState.POSTGAME) {
            return;
        }

        for (const player of players) {
            let x = player.getX();
            let y = player.getY();
            let pos = player.getJust();

            let separation = 10;

            if (player !== myPlayer) {
                let h = player.getHand().length;
                let yOffset = 40;
                for (let i = 0; i < h; i++) {
                    drawCard(ctx,
                        player.getHand()[i],
                        x + i * separation - (h - 1) * separation / 2 - (pos - 1) * maxWid / 2,
                        y - yOffset,
                        smallCardScale, true, false, -1, undefined
                    );
                }
            }

            if (gameState == GameState.PASSING) {
                if (player.passed) {
                    let startX = player.getPassX();
                    let startY = player.getPassY();

                    let passedTo = player.index;
                    if (player.passedTo != -1) {
                        passedTo = player.passedTo;
                    }

                    let endX = players[passedTo].getPassX();
                    let endY = players[passedTo].getPassY();

                    let x = player.getBidTimer() * endX + (1 - player.getBidTimer()) * startX;
                    let y = player.getBidTimer() * endY + (1 - player.getBidTimer()) * startY;

                    for (let i = 0; i < player.pass.length; i++) {
                        drawCard(ctx,
                            player.pass[i],
                            x + (i - (player.pass.length - 1) / 2) * separation,
                            y,
                            smallCardScale, true, false, -1, undefined
                        );
                    }
                }
            }
        }
    }

    paintTrick() {
        if (gameState == GameState.PREGAME || gameState == GameState.POSTGAME) {
            return;
        }

        let N = players.length;
        for (let i = 0; i < players.length; i++) {
            let iRelToLeader = (leader + i) % N;
            let iRelToMe = (iRelToLeader - myPlayer.getIndex() + N) % N;
            let player = players[iRelToLeader];
            if (!player.getTrick().isEmpty()) {
                if (player.getTrickRad() == -1) {
                    let baseTrickRad = N >= 8 ? 110 : 70;
                    player.setTrickRad(baseTrickRad + 10 * Math.random());
                }

                let startX = player.getX();
                let startY = player.getY();

                if (player === myPlayer && cardJustPlayed !== undefined) {
                    startX = (cachedWidth - scoreWidth) / 2 + cardJustPlayed * cardSeparation
                                - (myPlayer.getHand().length) * cardSeparation / 2;
                    startY = cachedHeight - handYOffset;
                }

                let endX = (cachedWidth - scoreWidth) / 2
                            - player.getTrickRad() * Math.sin(2 * Math.PI * iRelToMe / players.length);
                let endY = cachedHeight / 2 - 50
                            + player.getTrickRad() * Math.cos(2 * Math.PI * iRelToMe / players.length);

                let x = player.getTrickTimer() * endX + (1 - player.getTrickTimer()) * startX;
                let y = player.getTrickTimer() * endY + (1 - player.getTrickTimer()) * startY;
                if (player.getTrickTimer() > 0) {
                    drawCard(ctx, player.getTrick(), x, y, 1, true, false, -1, undefined);
                }
            }
        }
    }

    paintPreselected() {
        if (gameState == GameState.PREGAME || gameState == GameState.POSTGAME) {
            return;
        }

        for (const inter of preselected) {
            drawText(ctx,
                inter.preselection + 1,
                inter.x() + 20,
                inter.y() - 20,
                1, 1, fontBold, 'blue'
            );
        }
    }

    paintTaken() {
        if (gameState == GameState.PREGAME || gameState == GameState.POSTGAME) {
            return;
        }

        for (const player of players) {
            for (let j = 0; j < player.getTaken(); j++) {
                let takenX = player.getTakenX();
                let takenY = player.getTakenY();

                let isLastTrick = player.getIndex() == leader && j == player.getTaken() - 1;

                let x = takenX + takenXSeparation * j;
                let y = takenY + takenYSeparation * j;
                if (isLastTrick && takenTimer < 1) {
                    x = takenTimer * x + (1 - takenTimer) * (cachedWidth - scoreWidth) / 2;
                    y = takenTimer * y + (1 - takenTimer) * cachedHeight / 2;
                }

                if (!isLastTrick || !this.lastTrick.isShown()) {
                    drawCard(ctx, new Card(), x, y, smallCardScale, true, false, -1, undefined);
                }
            }
        }
    }

    paintMessage() {
        let x = (cachedWidth - scoreWidth) / 2;
        let y = cachedHeight / 2;
        let dims = getStringDimensions(message, font);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        drawBox(ctx,
            x - dims[0] / 2 - 20,
            y - dims[1] / 3 - 12,
            dims[0] + 40,
            dims[1] + 20,
            15
        );
        drawText(ctx, message, x, y, 1, 1, font, 'black');
    }

    paintFrameRate() {
        if (this.frameTimes === undefined) {
            this.frameTimes = [];
            this.framePointer = 0;
        }
        let time = new Date().getTime();
        if (this.frameTimes.length == 100) {
            let total = time - this.frameTimes[this.framePointer];
            this.frameTimes[this.framePointer] = time;

            let fps = (1000 * 100 / total).toFixed(2);
            drawText(ctx, 'FPS: ' + fps, cachedWidth - scoreWidth - 20, 20, 2, 1, font, 'red');
        } else {
            this.frameTimes.push(time);
        }
        this.framePointer = (this.framePointer + 1) % 100;
    }

    newGameReset() {
        this.postGamePage.clearData();
    }

    resetNamePlatesAndRobotButtons() {
        this.namePlates.length = 0;
        for (const button of this.robotButtons) {
            button.dispose();
        }
        this.robotButtons.length = 0;

        for (const player of players) {
            this.namePlates.push(new PlayerNamePlate(player));

            let button = document.createElement('button');
            button.innerHTML = 'Robot';
            button.classList.add(
                'bg-white', 'rounded-lg', 'border', 'border-black', 'w-5', 'h-5',
                'font-bold', 'text-sm', 'select-none', 'hover:bg-gray-300'
            );
            button.addEventListener('click', () => replaceWithRobot(player.index));

            let inter = new WrappedDOMElement(button);
            inter.x = () => player.getX() + maxWid * (1 - player.getJust()) / 2 - 30;
            inter.y = () => player.getY() - 55;
            inter.width = () => 60;
            inter.height = () => 30;
            inter.isShown = () => player.disconnected && myPlayer.isHost() && !player.replacedByRobot;
            inter.container = () => document.getElementById('inGameDiv')

            this.robotButtons.push(inter);
        }
    }

    makeHandInteractables() {
        this.cardInteractables.length = 0;
        for (let i = 0; i < myPlayer.getHand().length; i++) {
            let card = new CanvasCard(myPlayer.getHand()[i], 1, false);
            card.index = function () {return myPlayer.getHand().indexOf(this.getCard());};
            card.xCenter = function () {
                return (cachedWidth - scoreWidth) / 2 + this.index() * cardSeparation
                        - (myPlayer.getHand().length - 1) * cardSeparation / 2;
            };
            card.yCenter = function () {
                return cachedHeight - handYOffset - (this.preselection != -1 || pass && pass.isSelected(this.getCard()) ? preselectedCardYOffset : 0);
            };
            card.yPaintOffset = function () {
                return (card.isMoused() ? -10 : 0) + (pass && pass.isSelected(this.getCard()) ? -10 : 0);
            };
            card.isEnabled = function () {
                if (gameState == GameState.BIDDING) {
                    return myPlayer.hasBid();
                } else {
                    if (turn == myPlayer.getIndex() && myPlayer.getTrick().isEmpty()) {
                        return canPlayThis(this.getCard());
                    } else {
                        return true;
                    }
                }
            };
            card.hidden = function () {return !showOneCard;};
            card.dark = function () {
                return card.isMoused() || preselected.length > 0 && this.preselection == -1;
            }
            card.preselection = -1;
            card.cursor = () => 'pointer';
            card.click = function () {
                if (turn == myPlayer.getIndex() && gameState == GameState.PLAYING && myPlayer.getTrick().isEmpty()) {
                    if (preselected.length == 0) {
                        playCard(this);
                    } else {
                        return;
                    }
                } else if (gameState == GameState.PASSING && !myPlayer.passed) {
                    if (pass.isSelected(this.getCard())) {
                        pass.deselect(this.getCard());
                    } else {
                        pass.select(this.getCard());
                    }
                } else {
                    if (this.preselection == -1) {
                        this.preselection = preselected.length;
                        preselected.push(this);
                    } else {
                        clearPreselected(this.preselection);
                    }
                }
            }

            this.cardInteractables.push(card);
        }
    }

    removeHandInteractables() {
        this.cardInteractables.length = 0;
    }

    makeBidInteractables() {
        this.bidButtons.length = 0;
        for (let i = 0; i <= myPlayer.getHand().length; i++) {
            let button = new CanvasButton(i);
            button.x = function () {
                return (cachedWidth - scoreWidth) / 2 + i * 40 - myPlayer.getHand().length * 40 / 2 - 15;
            };
            button.y = function () {
                return cachedHeight - 210 - 15;
            };
            button.width = function () {return 30;};
            button.height = function () {return 30;};
            button.isEnabled = function () {
                if (myPlayer.getIndex() != dealer) {
                    return true;
                }
                let sum = i;
                for (const player of players) {
                    if (player.hasBid() && player !== myPlayer) {
                        sum += player.getBid();
                    }
                }
                return sum != myPlayer.getHand().length;
            };
            button.cursor = () => 'pointer';
            button.click = function () {makeBid(i);};
            this.bidButtons.push(button);
        }
    }

    removeBidInteractables() {
        this.bidButtons.length = 0;
    }

    loadPostGame(data) {
        data.trumps = data.trumps.map(c => new Card(c.num, c.suit));
        for (const player of data.players) {
            player.bidQs = player.bidQs.map(r => r.map(pr => 100 * pr))
            player.hands = player.hands.map(h => h.map(c => new Card(c.num, c.suit)));
            player.plays = player.plays.map(h => h.map(c => new Card(c.num, c.suit)));
            player.makingProbs = player.makingProbs.map(r => r.map(t => t.map(pair => [new Card(pair[0].num, pair[0].suit), pair[1]])));
        }

        data.teams.forEach(t => t.members = t.members.map(i => data.players[i]));

        this.pgPlayers = data.players;
        this.pgTeams = data.teams;
        this.pgRounds = data.rounds;
        this.pgOptions = data.options;

        this.postGamePage.setData(data);
    }

    chat(data) {
        this.chatArea.element.innerHTML += data.sender + ': ' + data.text + '&#10;';
        this.chatArea.element.scrollTop = this.chatArea.element.scrollHeight;
    }
}

function canPlayThis(card) {
    return canPlay.filter(c => c.matches(card)).length > 0;
    /*if (turn == leader) {
        return true;
    } else {
        let followIndex = mode == 'Oregon Hearts' ? (myPlayer.index + players.length - 1) % players.length : leader;
        let led = players[followIndex].getTrick().suit;
        return card.suit == led || myPlayer.getHand().filter(c => c.suit == led).length == 0;
    }*/
}

function clearPreselected(index) {
    for (let i = index; i < preselected.length; i++) {
        preselected[i].preselection = -1;
    }
    preselected.splice(index, preselected.length - index);
}

function shiftPreselected(index) {
    preselected.shift();
    for (const inter of preselected) {
        inter.preselection--;
    }
}

/*
 * TimerQueue and TimerEntry
 */
class TimerQueue {
    constructor() {
        this.entries = [];
    }

    push(entry, toFront) {
        if (arguments.length < 2) {
            toFront = false;
        }

        if (toFront) {
            if (this.entries.length == 0 || this.entries.firstAction) {
                this.entries.unshift(entry);
            } else {
                this.entries.splice(1, 0, entry);
            }
        } else {
            this.entries.push(entry);
        }
    }

    tick() {
        if (!this.entries.length) {
            return;
        }

        if (this.entries[0].tick()) {
            this.entries.shift();
        }
    }

    clear() {
        this.entries = [];
    }
}

class TimerEntry {
    constructor(endTime) {
        this.endTime = endTime;
        this.firstAction = true;
        this.elapsedTime = 0;
    }

    tick() {
        if (this.firstAction) {
            this.onFirstAction();
            this.startTime = new Date().getTime();
            this.firstAction = false;
        }

        this.elapsedTime = new Date().getTime() - this.startTime;

        this.onAction();

        if (this.elapsedTime >= this.endTime) {
            this.onLastAction();
            return true;
        }
        return false;
    }

    onFirstAction() {}
    onAction() {}
    onLastAction() {}
}

function pushBasicTimer(func, delay) {
    let te = new TimerEntry(delay ? delay : 0);
    te.onLastAction = func;
    canvas.pushTimerEntry(te);
}

function animateBids() {
    let animateTe = new TimerEntry(animationTime);
    animateTe.onAction = function () {
        let t = Math.min(this.elapsedTime / animationTime, 1);
        for (const player of players) {
            player.setBidTimer(t);
        }
    }
    canvas.pushTimerEntry(animateTe, true);

    let stayTe = new TimerEntry(bidStayTime);
    canvas.pushTimerEntry(stayTe, true);

    let bufferTe = new TimerEntry(0);
    canvas.pushTimerEntry(bufferTe, true);
}

function animatePlay(index) {
    let animateTe = new TimerEntry(animationTime);
    animateTe.onAction = function () {
        let t = Math.min(this.elapsedTime / animationTime, 1);
        players[index].setTrickTimer(t);
    }
    canvas.pushTimerEntry(animateTe);
}

function animatePass() {
    let stayTe1 = new TimerEntry(bidStayTime);
    canvas.pushTimerEntry(stayTe1);

    let animateTe = new TimerEntry(animationTime);
    animateTe.onAction = function () {
        let t = Math.min(this.elapsedTime / animationTime, 1);
        for (const player of players) {
            player.setBidTimer(t);
        }
    }
    canvas.pushTimerEntry(animateTe);

    let stayTe2 = new TimerEntry(bidStayTime);
    canvas.pushTimerEntry(stayTe2);
}

function animateTrickTake(index) {
    let stayTe = new TimerEntry(trickStayTime);
    stayTe.onLastAction = function () {
        for (const player of players) {
            player.newTrickReset();
        }
        leader = index;
    }
    canvas.pushTimerEntry(stayTe);

    let animateTe = new TimerEntry(animationTime);
    animateTe.onFirstAction = function () {
        players[index].incTaken();
        takenTimer = 0;
        trickTaken = true;
    }
    animateTe.onAction = function () {
        takenTimer = Math.min(this.elapsedTime / animationTime, 1);
    }
    canvas.pushTimerEntry(animateTe);
}

function showResultMessage() {
    let te = new TimerEntry(messageTime);
    te.onFirstAction = function () {
        let pronoun = options.teams ? 'Your team' : 'You';

        let bid = options.teams ? teams[myPlayer.team].members.reduce((b, p) => b + p.bid, 0) : myPlayer.getBid();
        let taken = options.teams ? teams[myPlayer.team].members.reduce((t, p) => t + p.taken, 0) : myPlayer.getTaken();

        if (bid == taken) {
            message = pronoun + ' made it!';
        } else {
            message = pronoun + ' went down by ' + Math.abs(bid - taken) + '.';
        }
    };
    te.onLastAction = function () {
        message = '';
    }
    canvas.pushTimerEntry(te);
}

function processEndGame(data) {
    let te = new TimerEntry(messageTime);
    te.onFirstAction = function () {
        message = players[data.index].getName() + ' is ending the game.';
    };
    te.onLastAction = function () {
        canvas.removeBidInteractables();
        canvas.removeHandInteractables();
        message = '';
    }
    canvas.pushTimerEntry(te);
}

function showClaimMessage(data) {
    let te = new TimerEntry(messageTime);
    te.onFirstAction = function () {
        if (data.accepted) {
            players[data.claimer].taken += data.remaining;
            canvas.removeHandInteractables();
            for (const player of players) {
                player.setHand([]);
                player.trick = new Card();
            }
        } else if (data.claimer != myPlayer.getIndex()) {
            players[data.claimer].setHand(players[data.claimer].getHand().map(c => new Card()));
        }

        message = 'Claim ' + (data.accepted ? 'accepted.' : 'rejected.');
    };
    te.onLastAction = function () {
        message = '';
    }
    canvas.pushTimerEntry(te);
}

// Card
class Card {
    constructor(num, suit) {
        if (!arguments.length) {
            this.num = 0;
            this.suit = 0;
        } else {
            this.num = num;
            this.suit = suit;
        }
    }

    toDict() {
        return {num: this.num, suit: this.suit};
    }

    isEmpty() {
        return this.num == 0;
    }

    toString() {
        if (this.isEmpty()) {
            return '0';
        }

        let ans = '';
        if (this.num < 10) {
            ans += this.num;
        } else if (this.num == 10) {
            ans += 'T';
        } else if (this.num == 11) {
            ans += 'J';
        } else if (this.num == 12) {
            ans += 'Q';
        } else if (this.num == 13) {
            ans += 'K';
        } else if (this.num == 14) {
            ans += 'A';
        }
        if (this.suit == 0) {
            ans += 'C';
        } else if (this.suit == 1) {
            ans += 'D';
        } else if (this.suit == 2) {
            ans += 'S';
        } else if (this.suit == 3) {
            ans += 'H';
        }

        return ans;
    }

    gtSort(card) {
        if (this.suit == card.suit && this.num == card.num) {
            return 0;
        } else if (this.suit > card.suit || (this.suit == card.suit && this.num > card.num)) {
            return 1;
        } else {
            return -1;
        }
    }

    matches(card) {
        return this.num == card.num && this.suit == card.suit;
    }
}

/*
 * states
 */
var ClientStateEnum = function() {
    this.LOADING = 0;
	this.LOGIN_MENU = 1;
    this.MAIN_MENU = 2;
    this.MODE_SELECT = 3;
    this.IN_MULTIPLAYER_GAME = 4;
    this.MULTIPLAYER_POST_GAME = 5;
    this.FILE_VIEWER = 6;
};
var GameStateEnum = function() {
    this.PREGAME = 0;
    this.BIDDING = 1;
    this.PLAYING = 2;
    this.POSTGAME = 3;
    this.PASSING = 4;
};

/*
 * options
 */
class Options {
    constructor() {
        this.robots = 0;
        this.D = 1;
        this.teams = false;
    }

    toDict() {
        return {
            robots: this.robots,
            D: this.D,
            teams: this.teams
        };
    }

    update(options) {
        this.robots = options.robots;
        this.D = options.D;
        this.teams = options.teams;
    }
}

/*
 * ClientPlayer
 */
class ClientPlayer {
    constructor(data) {
        this.update(data);
    }

    update(data) {
        this.name = data.name;
        this.id = data.id;
        this.human = data.human;
        this.host = data.host;
        this.disconnected = data.disconnected;
        this.kibitzer = data.kibitzer;
        this.replacedByRobot = data.replacedByRobot;
        this.index = data.index;
        this.team = data.team;
        this.bid = data.bid;
        this.bidded = data.bidded;
        this.taken = data.taken;
        this.score = data.score;
        this.trick = data.trick === undefined ? undefined : new Card(data.trick.num, data.trick.suit);
        this.lastTrick = data.lastTrick === undefined ? undefined : new Card(data.lastTrick.num, data.lastTrick.suit);

        this.trickRad = -1;
        this.pokeTime = 0;
    }

    updateExtra(hand, bids, takens, scores) {
        this.hand = hand.map(c => new Card(c.num, c.suit));
        this.bids = bids;
        this.scores = scores;
    }

    setName(name) {
        this.name = name;
    }
    getName() {
        return this.name;
    }
    setId(id) {
        this.id = id;
    }
    getId() {
        return this.id;
    }
    setHost(host) {
        this.host = host;
    }
    isHost() {
        return this.host;
    }
    isDisconnected() {
        return this.disconnected;
    }
    setKibitzer(kib) {
        this.kibitzer = kib;
    }
    isKibitzer() {
        return this.kibitzer;
    }
    setIndex(index) {
        this.index = index;
    }
    getIndex() {
        return this.index;
    }
    setHand(hand) {
        this.hand = hand;
    }
    getHand(hand) {
        return this.hand;
    }
    setBid(bid) {
        this.bid = bid;
    }
    getBid() {
        return this.bid;
    }
    hasBid() {
        return this.bidded;
    }

    addBid(bid) {
        this.bid = bid;
        this.bidded = true;
        this.bids.push(bid);
    }

    addPass(cards) {
        this.pass = cards;
        this.passed = true;

        if (this == myPlayer) {
            pass.clear();
            for (const card of cards) {
                for (let i = 0; i < this.hand.length; i++) {
                    if (this.hand[i].matches(card)) {
                        this.hand.splice(i, 1);
                    }
                }

                for (let i = 0; i < canvas.cardInteractables.length; i++) {
                    if (canvas.cardInteractables[i].getCard().matches(card)) {
                        canvas.cardInteractables.splice(i, 1);
                    }
                }
            }
        } else {
            for (const card of cards) {
                let remove = -1;
                for (let i = 0; i < this.hand.length; i++) {
                    if (this.hand[i].matches(card)) {
                        remove = i;
                    }
                }
                if (remove == -1) {
                    remove = 0;
                }
                this.hand.splice(remove, 1);
            }
        }
    }

    addScore(score) {
        this.score = score;
        this.scores.push(score);
    }

    setBidTimer(t) {
        this.bidTimer = t;
    }
    getBidTimer() {
        return this.bidTimer;
    }
    getTrick() {
        return this.trick;
    }
    getLastTrick() {
        return this.lastTrick;
    }
    setTrickTimer(t) {
        this.trickTimer = t;
    }
    getTrickTimer() {
        return this.trickTimer;
    }
    setTrickRad(r) {
        this.trickRad = r;
    }
    getTrickRad() {
        return this.trickRad;
    }
    getTaken() {
        return this.taken;
    }
    incTaken() {
        this.taken++;
    }

    getScore() {
        if (this.scores === undefined || this.scores.length == 0) {
            return 0;
        } else {
            return this.scores[this.scores.length - 1];
        }
    }

    getScores() {
        return this.scores;
    }
    getBids() {
        return this.bids;
    }

    addPlay(card) {
        this.trick = card;
        this.trickTimer = 0;

        if (this == myPlayer) {
            let justPlayed = canvas.cardInteractables[cardJustPlayed].getCard();

            let toRemove = undefined;
            if (card.matches(justPlayed)) {
                toRemove = justPlayed;
            }

            for (let i = 0; i < this.hand.length; i++) {
                if (!toRemove && this.hand[i].matches(card)
                        || this.hand[i] === toRemove) {
                    this.hand.splice(i, 1);
                }
            }

            if (toRemove) {
                canvas.cardInteractables.splice(cardJustPlayed, 1);
            } else {
                for (let i = 0; i < canvas.cardInteractables.length; i++) {
                    if (canvas.cardInteractables[i].getCard().matches(card)) {
                        canvas.cardInteractables.splice(i, 1);
                    }
                }
            }
        } else {
            let remove = -1;
            for (let i = 0; i < this.hand.length; i++) {
                if (this.hand[i].matches(card)) {
                    remove = i;
                }
            }
            if (remove == -1) {
                remove = 0;
            }
            this.hand.splice(remove, 1);
        }
    }

    newGameReset() {
        this.score = 0;
        this.trick = new Card();
        this.lastTrick = new Card();
        this.bids = [];
        this.scores = [];
    }

    newRoundReset() {
        this.bid = 0;
        this.taken = 0;
        this.bidded = false;
        this.trick = new Card();
        this.lastTrick = new Card();
        this.pass = [];
        this.passed = false;
        this.passedTo = -1;

        this.bidTimer = 0;
        this.trickTimer = 0;
        this.trickRad = -1;
        this.pokeTime = 0;
    }

    newTrickReset() {
        this.lastTrick = this.trick;
        this.trick = new Card();

        this.trickTimer = 0;
        this.trickRad = -1;
        this.pokeTime = 0;
    }

    startPokeTime() {
        this.pokeTime = new Date().getTime() + pokeTime;
    }

    stopPokeTime() {
        this.pokeTime = 0;
    }
}

class ClientTeam {
    constructor(number) {
        this.number = number;
        this.name = '';
        this.members = [];
    }

    bid() {
        return this.members.filter(p => p.bidded).map(p => p.bid).reduce((a, b) => a + b, 0);
    }

    taken() {
        return this.members.map(p => p.taken).reduce((a, b) => a + b, 0);
    }
}

function updatePlayersOnCanvas() {
    setPlayerPositions();
    if (stateCanvas === canvas) {
        canvas.resetNamePlatesAndRobotButtons();
    }

    igKibitzer.checked = myPlayer !== undefined && myPlayer.isKibitzer();

    if (!myPlayer.isHost()) {
        igRobots.disabled = true;
        igDoubleDeck.disabled = true;
        igTeams.disabled = true;
        disableButton(igStart);
        disableButton(document.getElementById('igRandomizeTeams'));
    } else {
        igRobots.disabled = false;
        igDoubleDeck.disabled = false;
        igTeams.disabled = false;
        enableButton(igStart);
        enableButton(document.getElementById('igRandomizeTeams'));
    }
}

function setPlayerPositions() {
    let N = players.length;
    let cut1 = Math.floor((N - 1) / 3);
    let cut2 = 2 * cut1;
    if ((N - 1) % 3 != 0) {
        cut2++;
    }
    if ((N - 1) % 3 == 2) {
        cut1++;
    }

    for (const player of players) {
        let index = (player.getIndex() - myPlayer.getIndex() + N - 1) % N;
        if (index < cut1) {
            player.getX = function () {return 10;};
            player.getY = function () {return cachedHeight * (cut1 - index) / (cut1 + 1);};
            player.getJust = function () {return 0;};
            player.getTakenX = function () {return player.getX() + 20;};
            player.getTakenY = function () {return player.getY() + 50;};
            player.getPassX = () => player.getX() + 250;
            player.getPassY = () => player.getY();
        } else if (index < cut2) {
            player.getX = function () {return (cachedWidth - scoreWidth) * (index - cut1 + 1) / (cut2 - cut1 + 1);};
            player.getY = function () {return 85;};
            player.getJust = function () {return 1;};
            player.getTakenX = function () {return player.getX() + 110;};
            player.getTakenY = function () {return player.getY() - 35;};
            player.getPassX = () => player.getX();
            player.getPassY = () => player.getY() + 100;
        } else if (index < N - 1) {
            player.getX = function () {return cachedWidth - scoreWidth - 10;};
            player.getY = function () {return cachedHeight * (index - cut2 + 1) / (N - 1 - cut2 + 1);};
            player.getJust = function () {return 2;};
            player.getTakenX = function () {return player.getX() - 90;};
            player.getTakenY = function () {return player.getY() + 50;};
            player.getPassX = () => player.getX() - 250;
            player.getPassY = () => player.getY();
        } else {
            player.getX = function () {return (cachedWidth - scoreWidth) / 2;};
            player.getY = function () {return cachedHeight - 20;};
            player.getJust = function () {return 1;};
            player.getTakenX = function () {return player.getX() + 260;};
            player.getTakenY = function () {return player.getY() - 50;};
            player.getPassX = () => player.getX();
            player.getPassY = () => player.getY() - 300;
        }
    }
}

class Pass {
    constructor() {
        this.clear();
        this.toPass = [0, 0, 0, 4, 3, 2, 2, 2, 1][players.length];
    }

    clear() {
        this.list = [];
        this.set = new Set();
    }

    deselect(card) {
        this.list = this.list.filter(c => c !== card);
        this.set.delete(card);
    }

    select(card) {
        while (this.list.length >= this.toPass) {
            this.deselect(this.list[0]);
        }
        this.list.push(card);
        this.set.add(card);
    }

    isSelected(card) {
        return this.set.has(card);
    }
}

/*
 * manipulation of html elements
 */
function enableButton(button) {
    button.classList.remove('bg-gray-500');
    button.classList.add('bg-white');
    button.classList.add('hover:bg-gray-300');
    button.disabled = false;
}

function disableButton(button) {
    button.classList.add('bg-gray-500');
    button.classList.remove('bg-white');
    button.classList.remove('hover:bg-gray-300');
    button.disabled = true;
}

function toggleButton(button) {
    if (button.classList.contains('bg-gray-400')) {
        button.classList.add('white');
        button.classList.remove('bg-gray-400');
        button.classList.add('hover:bg-gray-300');
        button.classList.remove('hover:bg-gray-600');
    } else if (button.classList.contains('bg-white')) {
        button.classList.remove('white');
        button.classList.add('bg-gray-400');
        button.classList.remove('hover:bg-gray-300');
        button.classList.add('hover:bg-gray-600');
    }
}

/*
 * callbacks
 */
window.addEventListener('load', execute);
window.addEventListener('mousemove', function (e) {
	if (stateCanvas !== undefined) {
        stateCanvas.mouseMoved(e.clientX, e.clientY);
    }
});
window.addEventListener('mousedown', function (e) {
    if (stateCanvas !== undefined) {
	   stateCanvas.mousePressed(e.clientX, e.clientY, e.button);
    }
});
window.addEventListener('mouseup', function (e) {
    if (stateCanvas !== undefined) {
	    stateCanvas.mouseReleased(e.clientX, e.clientY, e.button);
    }
});
window.addEventListener('wheel', function (e) {
    if (stateCanvas !== undefined) {
	    stateCanvas.wheel(e.deltaY);
    }
});

function execute() {
    let rawUrl = window.location.href
    if (rawUrl.includes('http://')) {
        rawUrl = rawUrl.split('http://')[1];
    }
    baseUrl = `http://${rawUrl.split('/')[0]}`;
    socket = io.connect(baseUrl);

    frame = document.getElementById("canvas");
    ctx = frame.getContext("2d");

    stateDivs = [
        [document.getElementById('loadingDiv')],
        [document.getElementById("loginMenuDiv")],
        [document.getElementById("mainMenuDiv")],
        [document.getElementById("modeSelectDiv")],
        [
            document.getElementById("preGameDiv"),
            document.getElementById("inGameDiv"),
            document.getElementById("inGameDiv"),
            document.getElementById("postGameDiv"),
            document.getElementById("inGameDiv")
        ]
    ];

    ClientState = new ClientStateEnum();

    loadingCanvas = new PlainCanvas();
    changeState(ClientState.LOADING);

    const urlParams = new URLSearchParams(window.location.search);
    autojoinId = urlParams.get('gameid');
    if (autojoinId) {
        autojoinId = parseInt(autojoinId);
    }

    //setCookie('username', 'soup' + Math.random().toFixed(3), 1);
    username = getCookie('username');

    setSocketCallbacks();
    loadVars();
    addEventListeners();

    GameState = new GameStateEnum();

    loginMenuCanvas = new PlainCanvas();
	mainMenuCanvas = new MainMenuCanvas();
    modeSelectCanvas = new PlainCanvas();
	canvas = new InGameCanvas();

    debugExecute();

    if (username && autojoinId) {
        autojoin(username, autojoinId);
        debugJoined();
    } else if (username) {
        connect(username);
        debugConnected();
    } else {
        changeState(ClientState.LOGIN_MENU);
    }

	paint();
}

function addEventListeners() {
    // login
    lmUsername = document.getElementById("lmUsername");
    lmUsername.addEventListener('keydown', e => {
        if (e.keyCode == 13) {
            connect(lmUsername.value);
        }
    });

    lmConnect = document.getElementById("lmConnect");
    lmConnect.addEventListener('click', () => {connect(lmUsername.value);});

    // mode select
    document.getElementById("msOhHell").addEventListener('click', () => {
        createGame('Oh Hell');
    });
    document.getElementById("msOregonHearts").addEventListener('click', () => {
        createGame('Oregon Hearts');
    });
    document.getElementById("msBack").addEventListener('click', () => {
        changeState(ClientState.MAIN_MENU);
    });

    // in game
    igName = document.getElementById("igName");
    igName.addEventListener('keydown', e => {
        if (e.keyCode == 13) {
            myPlayer.setName(igName.value);
            sendPlayerUpdate();
        }
    });

    igChangeName = document.getElementById("igChangeName");
    igChangeName.addEventListener('click', () => {
        myPlayer.setName(igName.value);
        sendPlayerUpdate();
    });

    igKibitzer = document.getElementById("igKibitzer");
    igKibitzer.addEventListener('change', () => {
        myPlayer.setKibitzer(igKibitzer.checked);
        sendPlayerUpdate();
    });

    igRobots = document.getElementById("igRobots");
    igRobots.addEventListener('change', () => {
        options.robots = igRobots.value;
        sendOptionsUpdate();
    });

    igDoubleDeck = document.getElementById("igDoubleDeck");
    igDoubleDeck.addEventListener('change', () => {
        options.D = igDoubleDeck.checked ? 2 : 1;
        sendOptionsUpdate();
    });

    igTeams = document.getElementById("igTeams");
    igTeams.addEventListener('change', () => {
        options.teams = igTeams.checked;
        sendOptionsUpdate();
    });

    igStart = document.getElementById("igStart");
    igStart.addEventListener('click', () => {startGame();});

    igBack = document.getElementById("igBack");
    igBack.addEventListener('click', () => {leaveGame();});

    document.getElementById("igBack3").addEventListener('click', () => {
        if (autojoinId) {
            leaveGame();
        } else {
            // viewing a saved game
            document.location = baseUrl;
        }
    });
    document.getElementById("igDownload").addEventListener('click', () => download());

    igLobby.addEventListener('click', () => {
        changeGameState(GameState.PREGAME);
    });
}

function loadVars() {
    games = [];

    players = [];
    teams = [];
    for (let i = 0; i < 10; i++) {
        teams.push(new ClientTeam(i));
    }
    options = new Options();
    rounds = [];
    takenTimer = 1;
    trickTaken = false;
    message = '';
    showMessageButtons = false;
    preselected = [];
    showOneCard = false;

    cardSeparation = 40;
    handYOffset = 105;
    preselectedCardYOffset = 50;
    rowCodeInv = [3, 1, 2, 0];
    animationTime = 150;
    bidStayTime = 1500;
    trickStayTime = 1500;
    messageTime = 2000;
    robotDelay = 500;
    pokeTime = 25000;
    takenXSeparation = 10;
    takenYSeparation = 5;
    lastTrickSeparation = 20;
    smallCardScale = 2 / 3;
    scoreMargin = 10;

    scoreWidth = 450;
    minChatHeight = 70;
    maxChatHeight = 200;

    font = "13px Arial";
    fontBold = "bold 13px Arial";
    fontSmall = "bold 9px Arial";
    fontLarge = "bold 40px Arial";
    fontTitle = "bold 52px Arial";

    colors = [
        'blue', 'red', 'green', 'magenta', 'cyan',
        'orange', 'pink', 'yellow', 'gray', 'black'
    ];

    deckImg = document.getElementById('deckimg');
    deckImgSmall = document.getElementById('deckimgsmall');
    cardWidth = deckImg.width / 9;
    cardHeight = deckImg.height / 6;
    cardWidthSmall = deckImgSmall.width / 9;
    cardHeightSmall = deckImgSmall.height / 6;
    maxWid = 9 * 10 + cardWidthSmall;

    pokeSound = new Audio('./resources/shortpoke.wav');
}

function getCookie(cname) {
    let name = cname + "=";
    let decodedCookie = decodeURIComponent(document.cookie);
    let ca = decodedCookie.split(';');
    for (let c of ca) {
        while (c.charAt(0) == ' ') {
            c = c.substring(1);
        }
        if (c.indexOf(name) == 0) {
            return c.substring(name.length, c.length);
        }
    }
    return "";
}

function setCookie(cname, cvalue, exdays) {
    const d = new Date();
    d.setTime(d.getTime() + (exdays * 24 * 60 * 60 * 1000));
    let expires = "expires=" + d.toUTCString();
    document.cookie = cname + "=" + cvalue + ";" + expires + ";path=/";
}

function changeState(newState) {
    if (stateCanvas) {
        stateCanvas.timerQueue.clear();
    }

    let defaultDiv = undefined;
    switch (newState) {
    case ClientState.LOADING:
        stateCanvas = loadingCanvas;
        defaultDiv = stateDivs[newState][0];
        break;
	case ClientState.LOGIN_MENU:
        stateCanvas = loginMenuCanvas;
        defaultDiv = stateDivs[newState][0];
        break;
    case ClientState.MAIN_MENU:
        stateCanvas = mainMenuCanvas;
        defaultDiv = stateDivs[newState][0];
        stateCanvas.refreshGames();
        break;
    case ClientState.MODE_SELECT:
        stateCanvas = modeSelectCanvas;
        defaultDiv = stateDivs[newState][0];
        break;
	case ClientState.IN_MULTIPLAYER_GAME:
        igName.value = username;
		stateCanvas = canvas;
		break;
	default:
		break;
	}
    if (state !== undefined) {
        for (const div of stateDivs[state]) {
            div.style.display = 'none';
        }
    }
	state = newState;
    if (defaultDiv) {
        defaultDiv.style.display = 'flex';
    }
}

function changeGameState(newState) {
    switch (newState) {
	case GameState.PREGAME:
        igKibitzer.checked = myPlayer !== undefined && myPlayer.isKibitzer();
        igRobots.value = options.robots;
        igDoubleDeck.checked = options.D == 2;
        igTeams.checked = options.teams;

        scoreWidth = 0;
		break;
    case GameState.BIDDING:
        break;
    case GameState.PLAYING:
		break;
    case GameState.POSTGAME:
		break;
	default:
		break;
	}
    if (gameState !== undefined) {
        stateDivs[state][gameState].style.display = 'none';
    }
	gameState = newState;
    stateDivs[state][gameState].style.display = 'flex';
}

function paint() {
    updateElementSizes();

	stateCanvas.paint();

    window.requestAnimationFrame(paint);
}

function updateElementSizes() {
	cachedWidth = window.innerWidth;
	cachedHeight = window.innerHeight;

    frame.width = cachedWidth;
    frame.height = cachedHeight;
}

function download() {
    window.open(`${baseUrl}/cached_games/${autojoinId}.ohw`, 'Download');
}

function openFile() {
    var input = document.createElement('input');
    input.type = 'file';

    input.onchange = e => {
       var file = e.target.files[0];
       var reader = new FileReader();
       reader.readAsText(file, 'UTF-8');
       reader.onload = readerEvent => {
          let data = JSON.parse(readerEvent.target.result);

          if (data === undefined) {
              alert('Unable to open file');
              return;
          }

          mode = data.mode;
          scoreWidth = 450;
          changeState(ClientState.IN_MULTIPLAYER_GAME);
          changeGameState(GameState.POSTGAME);
          autojoinId = undefined;
          disableButton(document.getElementById('igLobby'));
          disableButton(document.getElementById('igDownload'));
          canvas.loadPostGame(data);
          myPlayer = undefined;
       }
    }

    input.click();
}

/*
 * socket
 */
function setSocketCallbacks() {
    // In
    socket.on('loginconfirmed', function () {
        changeState(ClientState.MAIN_MENU);
        if (autojoinId) {
            joinGame(autojoinId);
        }
    });
    socket.on('logoutconfirmed', () => {
        changeState(ClientState.LOGIN_MENU);
    });
    socket.on('gamelist', data => {
        games = data.games;
    });
    socket.on('gamecreated', data => {
        if (data.mp) {
            reloadWithId(data.id);
        } else {
            joinGame(data.id);
        }
    });
    socket.on('join', function (data) {
        mode = data.mode;
        autojoinId = data.id;
        goToGame();
    });
    socket.on('gamejoinerror', () => {
        document.location = baseUrl;
    });
    socket.on('options', function (data) {
        pushBasicTimer(function () {
            options.update(data);
            igRobots.value = options.robots;
            igDoubleDeck.checked = options.D == 2;
            igTeams.checked = options.teams;
            document.getElementById('teamsDiv').style.display = options.teams ? 'inline' : 'none';
        });
    });
    socket.on('kick', () => {
        document.location = baseUrl;
    });
    socket.on('addplayers', function (data) {
        pushBasicTimer(function () {
            for (const dict of data.players) {
                let player = new ClientPlayer(dict);
                players.push(player);
                if (player.id == username) {
                    myPlayer = player;
                }
            }
            if (myPlayer === undefined) {
                myPlayer = new ClientPlayer({
                    name: username,
                    id: username,
                    host: false,
                    disconnected: false,
                    kibitzer: true,
                    index: Math.floor(Math.random() * players.length)
                });
            }

            updatePlayersOnCanvas();
            debugAddPlayers();
        });
    });
    socket.on('removeplayers', function (data) {
        pushBasicTimer(function () {
            players = players.filter(p => !data.indices.includes(p.getIndex()));
            for (let i = 0; i < players.length; i++) {
                players[i].setIndex(i);
            }

            updatePlayersOnCanvas();
        });
    });
    socket.on('updateplayers', function (data) {
        pushBasicTimer(function () {
            for (const player of data.players) {
                if (!player.kibitzer) {
                    players[player.index].update(player);
                }
            }

            updatePlayersOnCanvas();
        });
    });
    socket.on('updaterounds', function (data) {
        pushBasicTimer(function () {
            rounds.length = 0;
            rounds = rounds.concat(data.rounds);
            roundNumber = data.roundNumber;
        });
    });
    socket.on('start', function () {
        pushBasicTimer(function () {
            for (const player of players) {
                player.newGameReset();
            }
            canvas.newGameReset();
        });
    });
    socket.on('end', data => {
        processEndGame(data);
    });
    socket.on('gamestate', function (data) {
        pushBasicTimer(function () {
            options.update(data.options);
            igRobots.value = data.options.robots;
            igDoubleDeck.checked = data.options.D == 2;
            igTeams.checked = data.options.teams;

            rounds.length = 0;
            rounds = rounds.concat(data.rounds);
            roundNumber = data.roundNumber;

            leader = data.leader;
            dealer = data.dealer;

            turn = data.turn;
            trump = new Card(data.trump.num, data.trump.suit);

            for (let i = 0; i < players.length; i++) {
                players[i].update(data.players.info[i]);
                players[i].updateExtra(
                    data.players.hands[i],
                    data.players.bids[i],
                    data.players.takens[i],
                    data.players.scores[i]
                );
            }

            changeGameState(data.state);

            showOneCard = rounds[roundNumber].handSize > 1
                || myPlayer.getIndex() != dealer
                || data.state != GameState.BIDDING;

            if (data.state == GameState.BIDDING) {
                if (turn == myPlayer.getIndex() && !myPlayer.isKibitzer()) {
                    canvas.makeBidInteractables();
                }
                for (const player of players) {
                    player.setBidTimer(0);
                }
            } else if (data.state == GameState.PLAYING) {
                for (const player of players) {
                    player.setBidTimer(1);
                    if (player.getTrick().isEmpty()) {
                        player.setTrickTimer(0);
                    } else {
                        player.setTrickTimer(1);
                    }
                }
            } else if (data.state == GameState.PASSING) {
                pass = new Pass();
            }

            cardJustPlayed = undefined;

            trickTaken = !players[0].getLastTrick().isEmpty();
            takenTimer = 1;

            if (!myPlayer.isKibitzer()) {
                canvas.makeHandInteractables();
            }
        });
    });
    socket.on('deal', function (data) {
        pushBasicTimer(function () {
            for (const player of players) {
                player.newRoundReset();
            }

            trickTaken = false;

            for (let i = 0; i < players.length; i++) {
                players[i].setHand(data.hands[i].map(c => new Card(c.num, c.suit)));
            }
            trump = data.trump[0];
            trump = new Card(trump.num, trump.suit);

            showOneCard = data.hands[0].length > 1
                        || myPlayer.getIndex() != dealer
                        || myPlayer.isKibitzer();

            if (!myPlayer.isKibitzer()) {
                canvas.makeHandInteractables();
            }
        });
    });
    socket.on('performpass', function (data) {
        pushBasicTimer(function () {
            for (let i = 0; i < players.length; i++) {
                players[i].pass = data.pass[i].map(c => new Card(c.num, c.suit));
                players[i].passedTo = data.passedTo[i];
            }
        });
        animatePass(data.passedFrom);
        pushBasicTimer(function () {
            for (let i = 0; i < players.length; i++) {
                players[i].setHand(data.hands[i].map(c => new Card(c.num, c.suit)));
            }

            if (!myPlayer.isKibitzer()) {
                canvas.removeHandInteractables();
                canvas.makeHandInteractables();
            }
        });
    });
    socket.on('dealerleader', function (data) {
        pushBasicTimer(function () {
            leader = data.leader;
            dealer = data.dealer;
        });
    });
    socket.on('bid', function (data) {
        pushBasicTimer(function () {
            changeGameState(GameState.BIDDING);
            turn = data.turn;

            if (turn == myPlayer.getIndex() && !myPlayer.isKibitzer()) {
                canvas.makeBidInteractables();
            } else {
                canvas.removeBidInteractables();
            }

            for (let i = 0; i < players.length; i++) {
                if (i != turn) {
                    players[i].stopPokeTime();
                }
            }
            players[turn].startPokeTime();
        });
    });
    socket.on('play', function (data) {
        pushBasicTimer(function () {
            changeGameState(GameState.PLAYING);
            turn = data.turn;

            canvas.removeBidInteractables();

            if (turn == myPlayer.getIndex()) {
                if (data.canPlay) {
                    canPlay = data.canPlay.map(c => new Card(c.num, c.suit));
                } else {
                    canPlay = [];
                }
                if (preselected.length > 0) {
                    if (canPlayThis(preselected[0].getCard())) {
                        playCard(preselected[0]);
                        shiftPreselected();
                    } else {
                        clearPreselected(0);
                    }
                }
            }

            for (let i = 0; i < players.length; i++) {
                if (i != turn) {
                    players[i].stopPokeTime();
                }
            }
            players[turn].startPokeTime();
        });
    });
    socket.on('pass', function (data) {
        pushBasicTimer(function () {
            changeGameState(GameState.PASSING);
            turn = -1;
            pass = new Pass();

            for (let i = 0; i < players.length; i++) {
                players[i].startPokeTime();
            }
        });
    });
    socket.on('bidreport', function (data) {
        pushBasicTimer(function () {
            players[data.index].addBid(data.bid);

            if (!players.some(p => !p.hasBid())) {
                animateBids();
            }
        }, !data.human ? robotDelay : 0);
    });
    socket.on('playreport', function (data) {
        pushBasicTimer(function () {
            if (data.isLead) {
                leader = data.index;
            }

            players[data.index].addPlay(new Card(data.card.num, data.card.suit));
        }, !data.human ? robotDelay : 0);
        animatePlay(data.index);
    });
    socket.on('passreport', function (data) {
        pushBasicTimer(function () {
            players[data.index].stopPokeTime();
            players[data.index].addPass(data.cards.map(c => new Card(c.num, c.suit)));
        }, 0);
    });
    socket.on('trickwinner', function (data) {
        animateTrickTake(data.index);
    });
    socket.on('scoresreport', function (data) {
        if (!myPlayer.isKibitzer() && mode == 'Oh Hell') {
            showResultMessage();
        }
        pushBasicTimer(function () {
            for (let i = 0; i < players.length; i++) {
                players[i].addScore(data.scores[i]);
            }
            roundNumber++;
        });
    });
    socket.on('postgame', function (data) {
        pushBasicTimer(function () {
            changeGameState(GameState.POSTGAME);
            canvas.loadPostGame(data);
            enableButton(document.getElementById('igLobby'));
            enableButton(document.getElementById('igDownload'));
        });
    });
    socket.on('chat', data => {
        canvas.chat(data);
    });
    socket.on('poke', () => pokeSound.play());
    socket.on('claim', data => {
        pushBasicTimer(function () {
            if (data.index != myPlayer.getIndex()) {
                message = players[data.index].getName() + ' claims the rest of the tricks';
                players[data.index].setHand(data.hand.map(c => new Card(c.num, c.suit)));

                canvas.messageAccept.element.innerHTML = 'Accept';
                canvas.messageAccept.element.addEventListener('click', () => {
                    respondToClaim(true);
                    message = '';
                    showMessageButtons = false;
                });

                canvas.messageDecline.element.innerHTML = 'Decline';
                canvas.messageDecline.element.addEventListener('click', () => {
                    respondToClaim(false);
                    message = '';
                    showMessageButtons = false;
                });

                showMessageButtons = true;
            }
        });
    });
    socket.on('claimresult', data => {
        showClaimMessage(data);
    });
    socket.on('updateteams', function (data) {
        pushBasicTimer(function () {
            for (const team of data.teams) {
                teams[team.number].name = team.name;
                teams[team.number].members = team.members.map(i => players[i]);
            }
        });
    });
}

// Out
function connect(uname) {
    if (uname.length == 0) {
        return;
    }

    username = uname;
    setCookie('username', uname, 30);
    socket.emit('login', {id: uname});
}
function logout() {
    socket.emit('logout');
    setCookie('username', '', 0);
}

function autojoin(uname, id) {
    socket.emit('autojoin', {userId: uname, gameId: id});
}

function requestGameList() {
    socket.emit('gamelist');
}

function goToModeSelect(mp) {
    multiplayer = mp;
    if (!mp && options.robots == 0) {
        options.robots = 4;
    }
    changeState(ClientState.MODE_SELECT);
}
function createGame(mode) {
    socket.emit('creategame', {mode: mode, multiplayer: multiplayer, options: options});
}
function joinGame(id) {
    socket.emit('joingame', id);
}
function reloadWithId(id) {
    document.location.search = `gameid=${id}`;
}
function goToGame() {
    scoreWidth = 0;
    changeState(ClientState.IN_MULTIPLAYER_GAME);
    changeGameState(GameState.PREGAME);
    myPlayer = undefined;
}
function leaveGame() {
    socket.emit('leavegame');
}

function startGame() {
    socket.emit('start');
}
function requestEndGame() {
    socket.emit('end');
}
function sendPlayerUpdate() {
    socket.emit('player', {
        id: myPlayer.getId(),
        name: myPlayer.getName(),
        kibitzer: myPlayer.isKibitzer()
    });
}
function sendOptionsUpdate() {
    socket.emit('options', options);
}
function makeBid(bid) {
    socket.emit('bid', {bid: bid});
    canvas.removeBidInteractables();
}
function playCard(canvasCard) {
    cardJustPlayed = canvasCard.index();
    let card = canvasCard.getCard();
    socket.emit('play', {card: {num: card.num, suit: card.suit}});
}
function makePass(cards) {
    socket.emit('pass', {cards: cards.map(c => c.toDict())});
}
function sendChat(text) {
    socket.emit('chat', text);
}
function replaceWithRobot(index) {
    socket.emit('replacewithrobot', index);
}
function poke(index) {
    socket.emit('poke', index);
    if (turn == index) {
        players[index].startPokeTime();
    }
}
function makeClaim() {
    socket.emit('claim');
}
function respondToClaim(accept) {
    socket.emit('claimresponse', accept);
}

function reteam(index, team) {
    socket.emit('reteam', {index: index, team: team});
}
function scrambleTeams() {
    socket.emit('scrambleteams');
}

// debug
function debugExecute() {
    /*animationTime = 1;
    bidStayTime = 0;
    trickStayTime = 0;
    messageTime = 0;
    robotDelay = 0;*/
}

function debugConnected() {
    /*multiplayer = true;
    createGame('Oh Hell');*/
}

function debugJoined() {
    /*options.robots = 6;
    options.D = 2;
    options.teams = true;
    sendOptionsUpdate();*/

    //startGame();
}

function debugAddPlayers() {
    /*if (myPlayer.isKibitzer()) {
        return;
    }*/

    //myPlayer.setKibitzer(true);
    //sendPlayerUpdate();

    //startGame();
}

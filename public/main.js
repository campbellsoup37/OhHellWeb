// Connection
var socket;

/*
 * vars
 */
var frame, ctx;
var cachedWidth, cachedHeight;
var ClientState, state;
var GameState, gameState;
var stateCanvas, mainMenuCanvas, canvas;
var stateDivs;
var mpButton;
var lmUsername, lmConnect, lmBack;
var igName, igChangeName, igKibitzer, igRobots, igDoubleDeck, igTeams, igStart, igBack;
var igLeftDiv, igSpacerDiv, igChatDiv;

var username;

// variables
var players, myPlayer;
var options;
var rounds, roundNumber;
var trump;
var dealer, leader, turn;
var cardJustPlayed;
var takenTimer, trickTaken;
var message;
var preselected;
var showOneCard;

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

var scoreWidth;

var deckImg, deckImgSmall;
var cardWidth, cardHeight, cardWidthSmall, cardHeightSmall;
var maxWid;

/*
 * GraphicsTools
 */
var font, fontBold, fontSmall, fontLarge, fontTitle;

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

function drawText(text, x, y, posx, posy, fnt, style, maxWidth) {
    if (arguments.length < 6) {
        fnt = font;
    }
    if (arguments.length < 7) {
        color = 'black';
    }

    let dims = getStringDimensions(text, fnt);

    while (arguments.length >= 8 && dims[0] > maxWidth) { // TODO I'm sure this can be smarter.
        text = text.substring(0, text.length - 1);
        dims = getStringDimensions(text, fnt);
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
    let yoff = posy * dims[1] / 3;

    ctx.fillText(text, x, y + yoff);
}

function drawBox(x, y, width, height, roundness, thickBorderColor) {
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

	color = ctx.fillStyle;
	ctx.fillStyle = 'black';

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

	ctx.fillStyle = color;
}

function drawOval(x, y, width, height, fill) {
    if (arguments.length < 5) {
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

function drawCard(card, x, y, scale, small, dark, maxY, thickBorderColor) {
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
        x0, y0, cw1 * scale, ch1 * scale
    );
}

function drawLine(x1, y1, x2, y2) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
}

/*
 * CanvasInteractables
 */
class CanvasInteractable {
    constructor() {
        this.moused = false;
        this.pressed = false;
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

    updateMoused(x, y) {
        this.setMoused(
    			this.isShown()
    			&& this.isEnabled()
    			&& x >= this.x()
    			&& x <= this.x() + this.width()
    			&& y >= this.y()
    			&& y <= this.y() + this.height());
    	return this.isMoused() ? this : undefined;
    }
}

/*
 * CanvasButton
 */
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
    		drawBox(this.x(), this.y(), this.width(), this.height(), 10, undefined);
            drawText(this.text, this.x() + this.width() / 2, this.y() + this.height() / 2, 1, 1, fontBold, 'black');
    	}
    }
}

/*
 * TextField
 */
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
    		drawBox(this.x(), this.y(), this.width(), this.height(), 10, undefined);
            drawText(this.getDisplayedText(), this.x() + 5, this.y() + this.height() / 2, 0, 1, font, 'black');
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

        // plate
        if (gameState == GameState.PREGAME && this.player.isHost() || turn == this.player.getIndex()) {
            ctx.fillStyle = "yellow";
        } else if (!this.player.human) {
            ctx.fillStyle = 'rgb(210, 255, 255)';
        } else {
            ctx.fillStyle = "white";
        } // TODO robot color
        drawBox(this.x(), this.y(), this.width(), this.height(), 12, undefined);

        // name
        drawText(
            this.player.getName(),
            this.x() + this.width() / 2,
            this.y() + this.height() / 2,
            1, 1, font,
            this.player.isDisconnected() ? 'red' : 'black',
            this.width() - 40
        );

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

            if (this.player.getBidTimer() < 1) {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
            } else {
                ctx.fillStyle = 'rgba(175, 175, 175, 0.7)';
            } // TODO other colors
            drawOval(bidX - radius / 2, bidY - radius / 2, radius, radius);
            if (this.player.getBidTimer() == 0) {
                ctx.fillStyle = 'black';
                drawOval(bidX - radius / 2, bidY - radius / 2, radius, radius, false);
                drawText(this.player.getBid(), bidX, bidY, 1, 1, fontLarge, 'black');
            } else {
                drawText(this.player.getBid(), bidX, bidY, 1, 1, font, 'black');
            }
        }

        // dealer chip
        if (dealer == this.player.getIndex()) {
            ctx.fillStyle = 'cyan';
            drawOval(this.x() + this.width() - 19, this.y() + this.height() / 2 - 8, 16, 16);
            drawText('D', this.x() + this.width() - 11, this.y() + this.height() / 2, 1, 1, font, 'black')
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
            drawCard(
                this.hidden() ? new Card() : this.card,
                this.xCenter() + this.xPaintOffset(),
                this.yCenter() + this.yPaintOffset(),
                this.scale, this.small, this.dark(),
                -1, undefined
            );
        }
    }
}

/*
 * ScoreSheet
 */
class ScoreSheet extends CanvasInteractable {
    constructor() {
        super();
        this.margin = 5;
        this.scoreVSpacing = 20;
        this.lineV = 4;
        this.sortByHeight = 30;
        this.bidInfoHeight = 20;
        this.buttonWidth = 60;
        this.dealerHWidth = 10;
        this.sortBy = 'Seat';
    }

    columnHeadingHeight() {
        return this.scoreVSpacing; // TODO teams
    }

    paint() {
        if (!gameState || gameState == GameState.PREGAME) {
            return;
        }

        let pl = players;

        if (!pl.length) {
            return;
        }

        // box
        ctx.fillStyle = 'white';
        drawBox(this.x(), this.y(), this.width(), this.height() - this.bidInfoHeight - this.margin, 10);

        let N = players.length;
        let wid = (this.width() - 4 * this.margin - 2 * this.dealerHWidth) / N;
        let currentX = this.x() + 3 * this.margin + 2 * this.dealerHWidth;

        // horizontal line
        ctx.fillStyle = 'black';
        drawLine(
            currentX,
            this.y() + this.margin + this.columnHeadingHeight() + this.lineV / 2,
            this.x() + this.width() - this.margin,
            this.y() + this.margin + this.columnHeadingHeight() + this.lineV / 2
        );

        for (let i = 0; i < N; i++) {
            let player = players[i];
            let fullWid = wid; // TODO teams

            // name
            drawText(
                player.getName(),
                currentX + fullWid / 2,
                this.y() + this.margin + this.scoreVSpacing / 2,
                1, 1,
                player === myPlayer ? fontBold : font,
                'black',
                fullWid - 6
            );

            if (i > 0) {
                drawLine(
                    currentX,
                    this.y() + this.margin,
                    currentX,
                    this.y() + this.margin + this.columnHeadingHeight() + this.lineV / 2
                );
            }

            currentX += fullWid;
        }

        // score sheet (JPanel in java)
        let x = this.x();
        let y = this.y() + this.margin + this.columnHeadingHeight() + this.lineV / 2 + 1;
        let height = this.height() - this.margin - this.columnHeadingHeight()
                        - this.lineV / 2 - 4 - this.sortByHeight
                        - this.bidInfoHeight - this.margin;

        // dealers and hand sizes
        for (let i = 0; i < rounds.length; i++) {
            let round = rounds[i];
            drawText(
                round.handSize,
                x + this.margin + this.dealerHWidth / 2,
                y + this.scoreVSpacing * (i + 0.5),
                1, 1,
                font, 'black'
            );
            drawText(
                players[round.dealer].getName().substring(0, 1),
                x + 2 * this.margin + 1.5 * this.dealerHWidth,
                y + this.scoreVSpacing * (i + 0.5),
                1, 1,
                font, 'black'
            );
        }

        // rest
        currentX = 3 * this.margin + 2 * this.dealerHWidth;
        for (let i = 0; i < N; i++) {
            let player = players[i];
            let fullWid = wid; // TODO teams

            if (i > 0) {
                drawLine(x + currentX, y, x + currentX, y + height);
            }

            for (let j = 0; j < rounds.length; j++) {
                let score = j < player.getScores().length ? player.getScores()[j] : '';

                let members = [player];
                let k = members.length;

                let fnt = font;
                let currentWid = 3 * this.margin
                                    + getStringDimensions(score, fnt)[0]
                                    + (13 + this.margin) * k
                                    - this.margin;
                if (currentWid >= fullWid) {
                    fnt = fontSmall;
                }

                // bid chips
                let b = (fnt == font ? 13 : 9) + 3;
                let chipStart = j < player.getScores().length ? 0 : this.margin + b - wid;
                let chipSpacing = j < player.getScores().length ? this.margin + b : wid;
                for (const p of members) {
                    if (j < p.getBids().length) {
                        ctx.fillStyle = 'rgba(200, 200, 200, 0.7)';
                        drawOval(
                            x + currentX + 1 + fullWid - chipSpacing * k - chipStart,
                            y + this.scoreVSpacing * (j + 0.5) - b / 2,
                            b, b
                        );
                        drawText(
                            p.getBids()[j],
                            x + currentX + 1 + fullWid - chipSpacing * k - chipStart + b / 2,
                            y + this.scoreVSpacing * (j + 0.5),
                            1, 1,
                            fnt, 'black'
                        );
                    }
                    k--;
                }

                // scores
                k = members.length;
                drawText(
                    score,
                    x + currentX + 1 + fullWid / 2 - this.margin * k / 2 - b * k / 2,
                    y + this.scoreVSpacing * (j + 0.5),
                    1, 1,
                    fnt, 'black'
                );
            }

            currentX += fullWid;
        }
    }
}

/*
 * OhcCanvas
 */
class OhcCanvas {
    constructor() {
        this.interactableMoused = undefined;
    	this.interactablePressed = undefined;
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

    mouseMoved(x, y) {
        if (this.interactables == undefined) {
    		return;
    	}

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

/*
 * MainMenuCanvas
 */
class MainMenuCanvas extends OhcCanvas {
    constructor() {
        super();
    }

    initialize() {
        this.setBackground(document.getElementById('background'));

    	this.menuWidth = 400;
    	this.menuHeight = 480;

    	let buttonWidth = 150;
    	let buttonHeight = 40;

    	this.mpButton = new CanvasButton("Multiplayer");
    	this.mpButton.x = function () {
    		return cachedWidth / 2 - buttonWidth / 2;
    	}
    	this.mpButton.y = function () {
    		return cachedHeight / 2 - buttonHeight / 2;
    	}
    	this.mpButton.width = function () {
    		return buttonWidth;
    	}
    	this.mpButton.height = function () {
    		return buttonHeight;
    	}
    	this.mpButton.click = function () {
    		changeState(ClientState.LOGIN_MENU);
    	}

    	this.interactables = [[this.mpButton]];
    }

    customPaintFirst() {
        ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    	drawBox(
    			(cachedWidth - this.menuWidth) / 2,
    			(cachedHeight - this.menuHeight) / 2,
    			this.menuWidth,
    			this.menuHeight,
    			20, undefined);

        drawText('Oh Hell', cachedWidth / 2, (cachedHeight - this.menuHeight) / 2 + 90, 1, 1, fontTitle, 'black');
    }
}

/*
 * MainMenuCanvas
 */
class LoginCanvas extends OhcCanvas {
    constructor() {
        super();
    }

    initialize() {
        this.setBackground(document.getElementById('background'));

    	this.menuWidth = 400;
    	this.menuHeight = 360;

        let thisCanvas = this;

        this.nameField = new TextField('Username');
        this.nameField.x = function () {return cachedWidth / 2 - this.width() / 2 + 60;};
    	this.nameField.y = function () {return cachedHeight / 2 - 110;};
    	this.nameField.width = function () {return 200;};
    	this.nameField.height = function () {return 35;};

        this.startButton = new CanvasButton("Connect");
    	this.startButton.x = function () {return cachedWidth / 2 - this.width() / 2;}
    	this.startButton.y = function () {return cachedHeight / 2 + 40;}
    	this.startButton.width = function () {return 150;}
    	this.startButton.height = function () {return 40;}
    	this.startButton.click = function () {thisCanvas.go();};

        this.backButton = new CanvasButton("Back");
    	this.backButton.x = function () {return cachedWidth / 2 - this.width() / 2;}
    	this.backButton.y = function () {return cachedHeight / 2 + 90;}
    	this.backButton.width = function () {return 150;}
    	this.backButton.height = function () {return 40;}
    	this.backButton.click = function () {
    		changeState(ClientState.MAIN_MENU);
    	};

    	this.interactables = [[
            this.nameField,
            this.startButton,
            this.backButton
        ]];
    }

    keyPressed(e) {
        if (e.keyCode == 13) {
            this.go();
        } else {
            this.nameField.key(e);
        }
    }

    go() {
        if (this.nameField.getText() != '') {
            connect(this.nameField.getText());
        }
    }

    debugSetName(text) {
        this.nameField.setText(text);
    }

    customPaintFirst() {
        ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    	drawBox(
			(cachedWidth - this.menuWidth) / 2,
			(cachedHeight - this.menuHeight) / 2,
			this.menuWidth,
			this.menuHeight,
			20, undefined
        );

        drawText(
            'Username:',
            cachedWidth / 2 - 80,
            cachedHeight / 2 - 110 + this.nameField.height() / 2,
            2, 1, fontBold, 'black'
        );

        /*drawText(
            0 + ' ' + this.nameField.left + ' ' + this.nameField.cursor + ' ' + this.nameField.right + ' ' + this.nameField.text.length,
            cachedWidth / 2, cachedHeight / 2, 1, 1, fontBold, 'black'
        );*/
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
 * InGameCanvas
 */
class InGameCanvas extends OhcCanvas {
    constructor() {
        super();
        this.timerQueue = new TimerQueue();
    }

    initialize() {
        this.setBackground(document.getElementById('background'));
        let thisCanvas = this;

        // filled out statically
        this.scoreSheet = new ScoreSheet();
        this.scoreSheet.x = function () {return cachedWidth - (scoreWidth - scoreMargin);};
        this.scoreSheet.y = function () {return scoreMargin;};
        this.scoreSheet.width = function () {return scoreWidth - 2 * scoreMargin;};
        this.scoreSheet.height = function () {
            let height = this.scoreVSpacing * (rounds.length + 1 + 0) // TODO teams
                            + this.lineV
                            + 3 * this.margin
                            + this.sortByHeight
                            + this.bidInfoHeight;
            return height;
        };

        class LastTrick extends CanvasCard {
            paint() {
                super.paint();
                if (this.isMoused()) {
                    for (let k = 0; k < players.length; k++) {
                        let x0 = Math.min(this.xCenter() + 50, cachedWidth - scoreWidth - lastTrickSeparation * (players.length - 1) - cardWidth / 2 - 10);
                        let y0 = Math.max(this.yCenter(), cardHeight / 2 + 10);
                        drawCard(players[k].getLastTrick(), x0 + lastTrickSeparation * k, y0, 1, true, false, -1, undefined);
                    }
                }
            }
        }
        this.lastTrick = new LastTrick(new Card(), smallCardScale, true);
        this.lastTrick.player = function () {return players[leader];};
        this.lastTrick.xCenter = function () {return this.player().getTakenX() + takenXSeparation * (this.player().getTaken() - 1);};
        this.lastTrick.yCenter = function () {return this.player().getTakenY() + takenYSeparation * (this.player().getTaken() - 1);};
        this.lastTrick.isShown = function () {return trickTaken && takenTimer == 1;};
        this.lastTrick.isEnabled = function () {return gameState == GameState.PLAYING;};
        let oldPaint = this.lastTrick.paint;

        this.showCard = new CanvasButton('Show card');
        this.showCard.x = function () {return (cachedWidth - scoreWidth) / 2 - 40;};
        this.showCard.y = function () {return cachedHeight - handYOffset - this.height() / 2;};
        this.showCard.width = function () {return 80;};
        this.showCard.height = function () {return 30;};
        this.showCard.isShown = function () {
            return thisCanvas.cardInteractables !== undefined
                    && thisCanvas.cardInteractables.length > 0
                    && thisCanvas.cardInteractables[0].hidden();
        };
        this.showCard.click = function () {showOneCard = true;};

        this.miscInteractables = [this.showCard];

        // filled out dynamically
        this.namePlates = [];
        this.cardInteractables = [];
        this.bidButtons = [];

        this.interactables = [
            [this.scoreSheet],
            this.bidButtons,
            this.cardInteractables,
            this.namePlates,
            [this.lastTrick],
            this.miscInteractables
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

    clickOnNothing() {
        clearPreselected(0);
    }

    pushTimerEntry(entry) {
        this.timerQueue.push(entry);
    }

    customPaintFirst() {
        if (gameState) {
            this.paintTrump();
            this.paintPlayers();
            this.paintTaken();
        }

        this.timerQueue.tick();
    }

    customPaintLast() {
        if (gameState) {
            this.paintTrick();
            this.paintPreselected();
            if (message != '') {
                this.paintMessage();
            }
        }
    }

    paintTrump() {
        if (gameState == GameState.PREGAME || gameState == GameState.POSTGAME) {
            return;
        }

        let x = 50;
        let y = 66;

        drawCard(new Card(), x - 4, y - 4, 1, true, false, -1, undefined);
        drawCard(new Card(), x - 2, y - 2, 1, true, false, -1, undefined);
        drawCard(trump, x, y, 1, true, false, -1, undefined);
    }

    paintPlayers() {
        if (gameState == GameState.PREGAME || gameState == GameState.POSTGAME) {
            return;
        }

        for (const player of players) {
            let x = player.getX();
            let y = player.getY();
            let pos = player.getJust();

            if (player !== myPlayer) {
                let h = player.getHand().length;
                let yOffset = 40;
                let separation = 10;
                for (let i = 0; i < h; i++) {
                    drawCard(
                        player.getHand()[i],
                        x + i * separation - (h - 1) * separation / 2 - (pos - 1) * maxWid / 2,
                        y - yOffset,
                        smallCardScale, true, false, -1, undefined
                    );
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
                    drawCard(player.getTrick(), x, y, 1, true, false, -1, undefined);
                }
            }
        }
    }

    paintPreselected() {
        if (gameState == GameState.PREGAME || gameState == GameState.POSTGAME) {
            return;
        }

        for (const inter of preselected) {
            drawText(
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
                    drawCard(new Card(), x, y, smallCardScale, true, false, -1, undefined);
                }
            }
        }
    }

    paintMessage() {
        let x = (cachedWidth - scoreWidth) / 2;
        let y = cachedHeight / 2;
        let dims = getStringDimensions(message, font);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        drawBox(
            x - dims[0] / 2 - 20,
            y - dims[1] / 3 - 12,
            dims[0] + 40,
            dims[1] + 20,
            15
        );
        drawText(message, x, y, 1, 1, font, 'black');
    }

    resetNamePlates() {
        this.namePlates.length = 0;
        for (const player of players) {
            this.namePlates.push(new PlayerNamePlate(player));
        }
    }

    makeHandInteractables() {
        this.cardInteractables.length = 0;
        for (let i = 0; i < myPlayer.getHand().length; i++) {
            let card = new CanvasCard(myPlayer.getHand()[i], 1, false);
            card.index = function () {return myPlayer.getHand().indexOf(card.getCard());};
            card.xCenter = function () {
                return (cachedWidth - scoreWidth) / 2 + card.index() * cardSeparation
                        - (myPlayer.getHand().length - 1) * cardSeparation / 2;
            };
            card.yCenter = function () {
                return cachedHeight - handYOffset - (this.preselection != -1 ? preselectedCardYOffset : 0);
            };
            card.yPaintOffset = function () {
                return card.isMoused() ? -10 : 0;
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
            card.click = function () {
                if (turn == myPlayer.getIndex() && gameState == GameState.PLAYING && myPlayer.getTrick().isEmpty()) {
                    if (preselected.length == 0) {
                        playCard(this);
                    } else {
                        return;
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
            button.click = function () {makeBid(i);};
            this.bidButtons.push(button);
        }
    }

    removeBidInteractables() {
        this.bidButtons.length = 0;
    }
}

function canPlayThis(card) {
    if (turn == leader) {
        return true;
    } else {
        let led = players[leader].getTrick().suit;
        return card.suit == led || myPlayer.getHand().filter(c => c.suit == led).length == 0;
    }
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
            this.entries.unshift(entry);
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

function pushBasicTimer(func) {
    let te = new TimerEntry(0);
    te.onFirstAction = func;
    canvas.pushTimerEntry(te);
}

function animateBids() {
    let stayTe = new TimerEntry(bidStayTime);
    canvas.pushTimerEntry(stayTe, true);

    let animateTe = new TimerEntry(animationTime);
    animateTe.onAction = function () {
        let t = Math.min(this.elapsedTime / animationTime, 1);
        for (const player of players) {
            player.setBidTimer(t);
        }
    }
    canvas.pushTimerEntry(animateTe, true);
}

function animatePlay(index) {
    let animateTe = new TimerEntry(animationTime);
    animateTe.onAction = function () {
        let t = Math.min(this.elapsedTime / animationTime, 1);
        players[index].setTrickTimer(t);
    }
    canvas.pushTimerEntry(animateTe);
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
        let pronoun = 'You';

        if (myPlayer.getBid() == myPlayer.getTaken()) {
            message = pronoun + ' made it!';
        } else {
            message = pronoun + ' went down by ' + Math.abs(myPlayer.getBid() - myPlayer.getTaken()) + '.';
        }
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
	this.MAIN_MENU = 0;
    this.LOGIN_MENU = 1;
    this.IN_MULTIPLAYER_GAME = 2;
    this.MULTIPLAYER_POST_GAME = 3;
    this.FILE_VIEWER = 4;
};
var GameStateEnum = function() {
    this.PREGAME = 0;
    this.BIDDING = 1;
    this.PLAYING = 2;
    this.POSTGAME = 3;
}

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
        this.index = data.index;
        this.bid = data.bid;
        this.bidded = data.bidded;
        this.taken = data.taken;
        this.score = data.score;
        this.trick = data.trick === undefined ? undefined : new Card(data.trick.num, data.trick.suit);
        this.lastTrick = data.lastTrick === undefined ? undefined : new Card(data.lastTrick.num, data.lastTrick.suit);

        this.trickRad = -1;
    }

    updateExtra(hand, bids, takens, scores) {
        this.hand = hand.map(c => new Card(c.num, c.suit));
        this.bids = bids;
        this.takens = takens;
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

    getScores() {
        return this.scores;
    }

    getBids() {
        return this.bids;
    }

    getTakens() {
        return this.takens;
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
                    if (canvas.cardInteractables[i].matches(card)) {
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
        this.takens = [];
        this.scores = [];
        this.hands = [];
    }

    newRoundReset() {
        this.bid = 0;
        this.taken = 0;
        this.bidded = false;
        this.trick = new Card();
        this.lastTrick = new Card();

        this.bidTimer = 0;
        this.trickTimer = 0;
        this.trickRad = -1;
    }

    newTrickReset() {
        this.lastTrick = this.trick;
        this.trick = new Card();

        this.trickTimer = 0;
        this.trickRad = -1;
    }
}

function updatePlayersOnCanvas() {
    setPlayerPositions();
    if (stateCanvas === canvas) {
        canvas.resetNamePlates();
    }

    if (!myPlayer.isHost()) {
        igRobots.disabled = true;
        igDoubleDeck.disabled = true;
        igTeams.disabled = true;
        disableButton(igStart);
        disableButton(igEnd);
    } else {
        igRobots.disabled = false;
        igDoubleDeck.disabled = false;
        igTeams.disabled = false;
        enableButton(igStart);
        enableButton(igEnd);
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
        } else if (index < cut2) {
            player.getX = function () {return (cachedWidth - scoreWidth) * (index - cut1 + 1) / (cut2 - cut1 + 1);};
            player.getY = function () {return 85;};
            player.getJust = function () {return 1;};
            player.getTakenX = function () {return player.getX() + 110;};
            player.getTakenY = function () {return player.getY() - 35;};
        } else if (index < N - 1) {
            player.getX = function () {return cachedWidth - scoreWidth - 10;};
            player.getY = function () {return cachedHeight * (index - cut2 + 1) / (N - 1 - cut2 + 1);};
            player.getJust = function () {return 2;};
            player.getTakenX = function () {return player.getX() - 90;};
            player.getTakenY = function () {return player.getY() + 50;};
        } else {
            player.getX = function () {return (cachedWidth - scoreWidth) / 2;};
            player.getY = function () {return cachedHeight - 20;};
            player.getJust = function () {return 1;};
            player.getTakenX = function () {return player.getX() + 260;};
            player.getTakenY = function () {return player.getY() - 50;};
        }
    }
}

/*
 * manipulation of html elements
 */
function enableButton(button) {
    button.classList.remove('bg-gray-500');
    button.classList.add('bg-white');
    button.classList.add('hover:bg-gray-300');
    igStart.disabled = false;
}

function disableButton(button) {
    button.classList.add('bg-gray-500');
    button.classList.remove('bg-white');
    button.classList.remove('hover:bg-gray-300');
    igStart.disabled = true;
}

/*
 * callbacks
 */
window.addEventListener('load', execute);
window.addEventListener('mousemove', function (e) {
	if (stateCanvas !== undefined) {
        stateCanvas.mouseMoved(e.offsetX, e.offsetY);
    }
});
window.addEventListener('mousedown', function (e) {
    if (stateCanvas !== undefined) {
	   stateCanvas.mousePressed(e.offsetX, e.offsetY, e.button);
    }
});
window.addEventListener('mouseup', function (e) {
    if (stateCanvas !== undefined) {
	    stateCanvas.mouseReleased(e.offsetX, e.offsetY, e.button);
    }
});

function execute() {
    socket = io.connect("http://192.168.1.48");
    setSocketCallbacks();

    frame = document.getElementById("canvas");
    ctx = frame.getContext("2d");

    stateDivs = [
        [document.getElementById("mainMenuDiv")],
        [document.getElementById("loginMenuDiv")],
        [document.getElementById("preGameDiv"), document.getElementById("inGameDiv"), document.getElementById("inGameDiv")]
    ];

    // main menu
    mpButton = document.getElementById("mpButton");
    mpButton.addEventListener('click', () => {changeState(ClientState.LOGIN_MENU);});

    // login
    lmUsername = document.getElementById("lmUsername");
    lmUsername.addEventListener('keydown', e => {
        if (e.keyCode == 13) {
            connect(lmUsername.value);
        }
    });

    lmConnect = document.getElementById("lmConnect");
    lmConnect.addEventListener('click', () => {connect(lmUsername.value);});

    lmBack = document.getElementById("lmBack");
    lmBack.addEventListener('click', () => {changeState(ClientState.MAIN_MENU);});

    // in game
    igName = document.getElementById("igName");
    igName.addEventListener('keydown', e => {
        if (e.keyCode == 13) {
            //TODO change name
        }
    });

    igChangeName = document.getElementById("igChangeName");
    igChangeName.addEventListener('click', () => {
        //TODO change name
    });

    igKibitzer = document.getElementById("igKibitzer");
    igKibitzer.addEventListener('change', () => {
        //TODO kibitzer
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
    igBack.addEventListener('click', () => {changeState(ClientState.MAIN_MENU);});

    igLeftDiv = document.getElementById("igLeftDiv");
    igSpacerDiv = document.getElementById("igSpacerDiv");
    igChatDiv = document.getElementById("igChatDiv");

    igChatField.addEventListener('keydown', e => {
        if (e.keyCode == 13) {
            sendChat(igChatField.value);
            igChatField.value = '';
        }
    });

    players = [];
    takenTimer = 1;
    trickTaken = false;
    message = '';
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
    takenXSeparation = 10;
    takenYSeparation = 5;
    lastTrickSeparation = 20;
    smallCardScale = 2 / 3;
    scoreMargin = 10;

    scoreWidth = 500;

    font = "13px Arial";
    fontBold = "bold 13px Arial";
    fontSmall = "bold 9px Arial";
    fontLarge = "bold 40px Arial";
    fontTitle = "bold 52px Arial";

	ClientState = new ClientStateEnum();
    GameState = new GameStateEnum();
	mainMenuCanvas = new PlainCanvas();
    loginMenuCanvas = new PlainCanvas();
	canvas = new InGameCanvas();

    options = new Options();

    deckImg = document.getElementById('deckimg');
    deckImgSmall = document.getElementById('deckimgsmall');
    cardWidth = deckImg.width / 9;
    cardHeight = deckImg.height / 6;
    cardWidthSmall = deckImgSmall.width / 9;
    cardHeightSmall = deckImgSmall.height / 6;
    maxWid = 9 * 10 + cardWidthSmall;

	changeState(ClientState.MAIN_MENU);

	paint();

    debugExecute();
}

function debugExecute() {
    bidStayTime = 150;
    trickStayTime = 150;

    changeState(ClientState.LOGIN_MENU);
    connect('soup' + Math.random());
    //startGame();
}

function changeState(newState) {
	switch (newState) {
	case ClientState.MAIN_MENU:
		stateCanvas = mainMenuCanvas;
		break;
    case ClientState.LOGIN_MENU:
        stateCanvas = loginMenuCanvas;
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
    stateDivs[state][0].style.display = 'flex';
}

function changeGameState(newState) {
    switch (newState) {
	case GameState.PREGAME:
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

    if (state == ClientState.IN_MULTIPLAYER_GAME && gameState != GameState.PREGAME) {
        let spacerWidth = cachedWidth - scoreWidth - 100;
        igSpacerDiv.style.width = spacerWidth + scoreMargin + 'px';
        igChatDiv.style.width = scoreWidth - 2 * scoreMargin + 'px';

        igChatArea.style.height = Math.min(200, cachedHeight - canvas.scoreSheet.height() - 2 * canvas.scoreSheet.margin - 50) + 'px';
    }
}

/*
 * socket
 */
function setSocketCallbacks() {
    // In
    socket.on('join', function () {
        scoreWidth = 0;
        changeState(ClientState.IN_MULTIPLAYER_GAME);
        changeGameState(GameState.PREGAME);
        myPlayer = undefined;
    });
    socket.on('options', function (data) {
        pushBasicTimer(function () {
            options.update(data);
            igRobots.value = options.robots;
            igDoubleDeck.checked = options.D == 2;
            igTeams.checked = options.teams;
        });
    });
    socket.on('kick', () => {
        changeState(ClientState.LOGIN_MENU);
        players = [];
        canvas.cleanup();
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
            for (const dict of data.players) {
                for (const player of data.players) {
                    players[player.index].update(player);
                }
            }

            updatePlayersOnCanvas();
        });
    });
    socket.on('updaterounds', function (data) {
        pushBasicTimer(function () {
            rounds = data.rounds;
            roundNumber = data.roundNumber;
        });
    });
    socket.on('start', function () {
        pushBasicTimer(function () {
            scoreWidth = 450;
            for (const player of players) {
                player.newGameReset();
            }
        });
    });
    socket.on('gamestate', function (data) {
        pushBasicTimer(function () {
            options.update(data);
            igRobots.value = options.robots;
            igDoubleDeck.checked = options.D == 2;
            igTeams.checked = options.teams;

            rounds = data.rounds;
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

            for (let i = 0; i < data.length - 1; i++) {
                players[i].setHand(data[i].map(c => new Card(c.num, c.suit)));
            }
            trump = data[data.length - 1][0];
            trump = new Card(trump.num, trump.suit);

            showOneCard = data[0].length > 1
                        || myPlayer.getIndex() != dealer
                        || myPlayer.isKibitzer();

            if (!myPlayer.isKibitzer()) {
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
        });
    });
    socket.on('play', function (data) {
        pushBasicTimer(function () {
            changeGameState(GameState.PLAYING);
            turn = data.turn;

            canvas.removeBidInteractables();

            if (turn == myPlayer.getIndex() && preselected.length > 0) {
                if (canPlayThis(preselected[0].getCard())) {
                    playCard(preselected[0]);
                    shiftPreselected();
                } else {
                    clearPreselected(0);
                }
            }
        });
    });
    socket.on('bidreport', function (data) {
        pushBasicTimer(function () {
            players[data.index].addBid(data.bid);

            if (!players.some(p => !p.hasBid())) {
                animateBids();
            }
        });
    });
    socket.on('playreport', function (data) {
        pushBasicTimer(function () {
            players[data.index].addPlay(new Card(data.card.num, data.card.suit));
        });
        animatePlay(data.index);
    });
    socket.on('trickwinner', function (data) {
        animateTrickTake(data.index);
    });
    socket.on('scoresreport', function (data) {
        if (!myPlayer.isKibitzer()) {
            showResultMessage();
        }
        pushBasicTimer(function () {
            for (let i = 0; i < players.length; i++) {
                players[i].addScore(data.scores[i]);
            }
        });
        roundNumber++;
    });
    socket.on('chat', data => {
        igChatArea.innerHTML += data.sender + ': ' + data.text + '&#10;';
        igChatArea.scrollTop = igChatArea.scrollHeight;
    });
}

// Out
function connect(uname) {
    if (uname.length == 0) {
        return;
    }

    username = uname;
    socket.emit('join', {id: uname});
}
function startGame() {
    socket.emit('start');
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
function sendChat(text) {
    socket.emit('chat', text);
}

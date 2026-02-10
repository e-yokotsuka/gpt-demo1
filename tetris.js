const app = new PIXI.Application({
    width: 300,
    height: 600,
    backgroundColor: 0x222222,
});
document.body.appendChild(app.view);

const blockSize = 30;
const numRows = 20;
const numCols = 10;

let gameBoard = [];
let currentPiece;
let elapsedTime = 0;
const moveInterval = 1000; // 1000 milliseconds = 1 second
class Tetromino {
    constructor(shape, color) {
        this.shape = shape;
        this.color = color;
        this.row = 0;
        this.col = Math.floor(numCols / 2) - Math.ceil(shape[0].length / 2);
    }
}

const shapes = [
    [
        [1, 1, 1],
        [0, 1, 0],
    ],
    [
        [1, 1, 1, 1],
    ],
    [
        [1, 1],
        [1, 1],
    ],
    [
        [1, 1, 0],
        [0, 1, 1],
    ],
    [
        [0, 1, 1],
        [1, 1, 0],
    ],
];

const colors = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff];

function createPiece() {
    const randomIndex = Math.floor(Math.random() * shapes.length);
    return new Tetromino(shapes[randomIndex], colors[randomIndex]);
}

function initGameBoard() {
    for (let row = 0; row < numRows; row++) {
        gameBoard[row] = [];
        for (let col = 0; col < numCols; col++) {
            gameBoard[row][col] = 0;
        }
    }
}

function drawBlock(graphics, color, row, col) {
    graphics.beginFill(color);
    graphics.drawRect(col * blockSize, row * blockSize, blockSize, blockSize);
    graphics.endFill();
}

function drawPiece(graphics, piece) {
    for (let row = 0; row < piece.shape.length; row++) {
        for (let col = 0; col < piece.shape[row].length; col++) {
            if (piece.shape[row][col]) {
                drawBlock(graphics, piece.color, piece.row + row, piece.col + col);
            }
        }
    }
}

function drawGameBoard(graphics) {
    graphics.clear();
    for (let row = 0; row < numRows; row++) {
        for (let col = 0; col < numCols; col++) {
            if (gameBoard[row][col]) {
                drawBlock(graphics, gameBoard[row][col], row, col);
            }
        }
    }
}

function collide(piece) {
    for (let row = 0; row < piece.shape.length; row++) {
        for (let col = 0; col < piece.shape[row].length; col++) {
            if (piece.shape[row][col]) {
                const newRow = piece.row + row;
                const newCol = piece.col + col;

                if (newRow < 0 || newRow >= numRows || newCol < 0 || newCol >= numCols || gameBoard[newRow][newCol]) {
                    return true;
                }
            }
        }
    }
    return false;
}

function merge(piece) {
    for (let row = 0; row < piece.shape.length; row++) {
        for (let col = 0; col < piece.shape[row].length; col++) {
            if (piece.shape[row][col]) {
                gameBoard[piece.row + row][piece.col + col] = piece.color;
            }
        }
    }
}

function rotate(piece) {
    const newShape = [];
    for (let row = 0; row < piece.shape[0].length; row++) {
        newShape[row] = [];
        for (let col = 0; col < piece.shape.length; col++) {
            newShape[row][col] = piece.shape[piece.shape.length - col - 1][row];
        }
    }
    piece.shape = newShape;
    if (collide(piece)) {
        for (let i = 0; i < 3; i++) {
            piece.shape = newShape;
            rotate(piece);
        }
    }
}

function moveDown(piece) {
    piece.row++;
    if (collide(piece)) {
        piece.row--;
        merge(piece);
        currentPiece = createPiece();
        if (collide(currentPiece)) {
            initGameBoard();
        }
    }
}

function moveLeft(piece) {
    piece.col--;
    if (collide(piece)) {
        piece.col++;
    }
}

function moveRight(piece) {
    piece.col++;
    if (collide(piece)) {
        piece.col--;
    }
}

function removeFullRows() {
    outer: for (let row = numRows - 1; row >= 0; row--) {
        for (let col = 0; col < numCols; col++) {
            if (!gameBoard[row][col]) {
                continue outer;
            }
        }
        gameBoard.splice(row, 1);
        gameBoard.unshift(new Array(numCols).fill(0));
    }
}

document.addEventListener("keydown", (event) => {
    switch (event.key) {
        case "ArrowUp":
            rotate(currentPiece);
            break;
        case "ArrowDown":
            moveDown(currentPiece);
            break;
        case "ArrowLeft":
            moveLeft(currentPiece);
            break;
        case "ArrowRight":
            moveRight(currentPiece);
            break;
    }
});

initGameBoard();
currentPiece = createPiece();

const graphics = new PIXI.Graphics();
app.stage.addChild(graphics);

app.ticker.add((delta) => {
    elapsedTime += delta * app.ticker.deltaMS;
    if (elapsedTime >= moveInterval) {
        moveDown(currentPiece);
        elapsedTime = 0;
    }
    drawGameBoard(graphics);
    drawPiece(graphics, currentPiece);
    removeFullRows();
});


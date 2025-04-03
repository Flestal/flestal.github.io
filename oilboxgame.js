const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- 설정 ---
const TILE_SIZE = 32;
const UI_COLS = 7; // UI 패널이 차지할 타일 컬럼 수
const ORIGINAL_BG_WIDTH = 1200;
const ORIGINAL_BG_HEIGHT = 675;

// 게임 영역 크기 계산 (기존 배경 크기 기준)
const GAME_COLS = Math.floor(ORIGINAL_BG_WIDTH / TILE_SIZE); // 37
const GAME_ROWS = Math.floor(ORIGINAL_BG_HEIGHT / TILE_SIZE); // 21
const GAME_AREA_WIDTH = GAME_COLS * TILE_SIZE; // 1184
const GAME_AREA_HEIGHT = GAME_ROWS * TILE_SIZE; // 672

// 전체 캔버스 크기 설정 (게임 영역 + UI 영역)
canvas.width = GAME_AREA_WIDTH + (UI_COLS * TILE_SIZE); // 1184 + 224 = 1408
canvas.height = GAME_AREA_HEIGHT; // 672

const COLS = GAME_COLS; // 맵 로직에 사용될 컬럼 수
const ROWS = GAME_ROWS; // 맵 로직에 사용될 로우 수
const UI_START_X = GAME_AREA_WIDTH; // UI 패널 시작 X 좌표

// --- 이미지 로딩 (동일) ---
const images = {};
const imageSources = {
    player: 'images/oilbox.png',
    wall: 'images/wall.png',
    goal: 'images/goal.png',
    background: 'images/bg.png' // 배경은 게임 영역에만 그림
};
let imagesLoaded = 0;
let totalImages = Object.keys(imageSources).length;

function loadImage(key, src) {
    images[key] = new Image();
    images[key].onload = () => {
        imagesLoaded++;
        if (imagesLoaded === totalImages) {
            console.log("모든 이미지 로딩 완료!");
            startGame();
        }
    };
    images[key].onerror = () => {
        console.error(`이미지 로딩 실패: ${src}`);
    };
    images[key].src = src;
}

for (const key in imageSources) {
    loadImage(key, imageSources[key]);
}

// --- 게임 상태 변수 ---
let map = [];
let player = { x: 0, y: 0, startX: 0, startY: 0 };
let goal = { x: 0, y: 0 };
let walls = [];

let isMoving = false;
let moveDirection = null;
let currentMoveTarget = null;
const MOVE_SPEED = 8;

let gameState = 'loading'; // 'loading', 'playing', 'cleared', 'resetting'

// --- 새 상태 변수 ---
let currentClears = 0; // 현재 세션의 연속 클리어 횟수
let highScores = []; // 상위 10개 기록 ( [{ score: number, date: string }, ...] )

// --- 쿠키 함수 ---
function setCookie(name, value, days) {
    let expires = "";
    if (days) {
        let date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        expires = "; expires=" + date.toUTCString();
    }
    // 쿠키 값에 JSON 문자열을 안전하게 저장하기 위해 encodeURIComponent 사용
    document.cookie = name + "=" + (encodeURIComponent(value) || "") + expires + "; path=/; SameSite=Lax";
    console.log("쿠키 저장:", name, value);
}

function getCookie(name) {
    let nameEQ = name + "=";
    let ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) == ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) == 0) {
            // decodeURIComponent를 사용하여 값을 복원
            const value = decodeURIComponent(c.substring(nameEQ.length, c.length));
            console.log("쿠키 로드:", name, value);
            return value;
        }
    }
    return null;
}

// --- 최고 점수 관리 ---
function loadHighScores() {
    const cookieData = getCookie("oilboxHighScores");
    if (cookieData) {
        try {
            highScores = JSON.parse(cookieData);
            // 점수 순으로 내림차순 정렬
            highScores.sort((a, b) => b.score - a.score);
        } catch (e) {
            console.error("최고 점수 쿠키 파싱 오류:", e);
            highScores = [];
        }
    } else {
        highScores = [];
    }
    console.log("최고 점수 로드됨:", highScores);
}

function updateHighScores(newScore) {
    if (newScore <= 0) return; // 0점은 기록하지 않음

    const currentDate = new Date().toLocaleDateString(); // 간단한 날짜 형식
    highScores.push({ score: newScore, date: currentDate });
    highScores.sort((a, b) => b.score - a.score); // 점수 내림차순 정렬
    highScores = highScores.slice(0, 10); // 상위 10개만 유지
    setCookie("oilboxHighScores", JSON.stringify(highScores), 365); // 1년 동안 쿠키 저장
    console.log("최고 점수 업데이트됨:", highScores);
}


// --- 게임 로직 함수 ---

// isWalkable, isMapSolvable (동일 - 내부에서 COLS, ROWS 사용 확인)
function isWalkable(col, row) {
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) { // COLS, ROWS 사용 (게임 영역 기준)
        return false;
    }
    return map[row][col] !== 1;
}

function isMapSolvable(tempMap, start, end) {
    const queue = [start];
    const visited = new Set();
    visited.add(`${start.row},${start.col}`);

    while (queue.length > 0) {
        const current = queue.shift();
        const directions = [{ dr: -1, dc: 0 }, { dr: 1, dc: 0 }, { dr: 0, dc: -1 }, { dr: 0, dc: 1 }];

        for (const dir of directions) {
            let { row: nextRow, col: nextCol } = current;
            let landRow = -1, landCol = -1;

            // 벽이나 맵 가장자리에 닿을 때까지 이동 시뮬레이션
            while (true) {
                let testR = nextRow + dir.dr;
                let testC = nextCol + dir.dc;

                // 게임 영역(COLS, ROWS) 밖으로 나가거나 벽이면 멈춤
                if (testR < 0 || testR >= ROWS || testC < 0 || testC >= COLS || tempMap[testR][testC] === 1) {
                    landRow = nextRow; // 현재 위치가 착지 지점
                    landCol = nextCol;
                    break;
                }
                 // 맵 밖으로 완전히 나가버리는 경우 - 이 경우는 isSolvable에서 고려하지 않음 (이동 불가 경로)
                 // 사실상 위의 조건(testR<0 등)에서 break되므로 별도 처리는 불필요할 수 있음.

                nextRow = testR;
                nextCol = testC;
            }

             // 착지 지점이 목표 지점이면 성공
             if(landRow === end.row && landCol === end.col) {
                return true;
             }

            // 유효한 착지 지점이고 아직 방문 안 했으면 큐에 추가
            const visitedKey = `${landRow},${landCol}`;
            if (landRow !== -1 && !visited.has(visitedKey)) { // landRow가 -1 이 아니어야 함 (위 로직 상 -1 될 일은 없음)
                visited.add(visitedKey);
                queue.push({ row: landRow, col: landCol });
            }
        }
    }
    return false;
}


// 랜덤 클리어 가능 맵 생성
function generateMap() {
    console.log("맵 생성 시도...");
    let solvable = false;
    let attempts = 0;
    const maxAttempts = 100;

    while (!solvable && attempts < maxAttempts) {
        attempts++;
        map = [];
        walls = [];
        let startPos = null;
        let goalPos = null;

        // 1. 게임 영역(COLS, ROWS) 기준으로 맵 생성
        for (let r = 0; r < ROWS; r++) {
            map[r] = [];
            for (let c = 0; c < COLS; c++) {
                // 테두리 벽 설정
                if (r === 0 || r === ROWS - 1 || c === 0 || c === COLS - 1) {
                    map[r][c] = 1;
                } else {
                    map[r][c] = 0;
                }
            }
        }

        // 2. 플레이어 시작 위치 (게임 영역 내)
        let startR, startC;
        do {
            startR = Math.floor(Math.random() * (ROWS - 2)) + 1;
            startC = Math.floor(Math.random() * (COLS - 2)) + 1;
        } while (map[startR][startC] !== 0);
        map[startR][startC] = 3;
        startPos = { row: startR, col: startC };
        player.startX = startC * TILE_SIZE;
        player.startY = startR * TILE_SIZE;

        // 3. 목표 지점 (게임 영역 내, 시작 위치와 다름)
        let goalR, goalC;
         do {
            goalR = Math.floor(Math.random() * (ROWS - 2)) + 1;
            goalC = Math.floor(Math.random() * (COLS - 2)) + 1;
        } while (map[goalR][goalC] !== 0 || (goalR === startR && goalC === startC));
        map[goalR][goalC] = 2;
        goalPos = { row: goalR, col: goalC };
        goal.x = goalC * TILE_SIZE;
        goal.y = goalR * TILE_SIZE;

        // 4. 내부 벽 (게임 영역 내)
        const wallDensity = 0.15;
        for (let r = 1; r < ROWS - 1; r++) {
            for (let c = 1; c < COLS - 1; c++) {
                if (map[r][c] === 0 && Math.random() < wallDensity) {
                    map[r][c] = 1;
                }
            }
        }

        // 5. 벽 객체 생성
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                if (map[r][c] === 1) {
                    walls.push({ x: c * TILE_SIZE, y: r * TILE_SIZE });
                }
            }
        }

        // 6. 해결 가능성 검사 (게임 영역 기준)
        solvable = isMapSolvable(map, startPos, goalPos);
        if (!solvable) {
             console.log(`시도 ${attempts}: 해결 불가능한 맵 생성됨. 재시도...`);
        }

    } // end while

    if (!solvable) {
        console.error("해결 가능한 맵 생성 실패! 마지막 맵 사용.");
    } else {
         console.log(`시도 ${attempts}: 해결 가능한 맵 생성 완료!`);
    }

    // 게임 상태 초기화
    isMoving = false;
    moveDirection = null;
    gameState = 'playing';
    resetPlayerPosition(); // 플레이어 위치 초기화
}

// 새 게임 시작 (T 키 또는 버튼 클릭 시)
function startNewGame() {
    console.log("새 게임 시작 요청");
    // 현재 클리어 기록을 최고 점수에 반영 시도
    updateHighScores(currentClears);
    // 현재 클리어 기록 초기화
    currentClears = 0;
    // 새 맵 생성
    generateMap();
}


// 플레이어 위치를 시작 지점으로 리셋 (현재 맵 유지)
function resetPlayerPosition() {
    player.x = player.startX;
    player.y = player.startY;
    isMoving = false;
    moveDirection = null;
    // 게임 오버 상태에서 리셋하는 경우 다시 playing으로
    if (gameState === 'resetting' || gameState === 'playing') {
         gameState = 'playing';
    }
    // 클리어 상태에서 R 누르면 클리어 카운트 유지하고 현재 맵 재시작? -> 일단 playing으로만
    console.log("플레이어 위치 리셋됨 (현재 맵)");
}


// --- 입력 처리 ---
function handleInput(event) {
    // 로딩 중이거나 이동 중이면 키 입력 무시 (단, R, T는 특정 상태에서 가능하게 할 수 있음)
    if (gameState === 'loading') return;

    // 이동 키 (WASD, Arrows) - 움직이지 않을 때만 & playing 상태일 때만
    if (!isMoving && gameState === 'playing') {
        let requestedDir = null;
        switch (event.key.toUpperCase()) {
            case 'W': case 'ARROWUP': requestedDir = 'up'; break;
            case 'A': case 'ARROWLEFT': requestedDir = 'left'; break;
            case 'S': case 'ARROWDOWN': requestedDir = 'down'; break;
            case 'D': case 'ARROWRIGHT': requestedDir = 'right'; break;
        }

        if (requestedDir) {
            moveDirection = requestedDir;
            calculateMoveTarget(); // 이동 목표 지점 계산
            if (currentMoveTarget) {
                 isMoving = true;
            } else {
                moveDirection = null;
            }
            return; // 이동 키 처리했으면 종료
        }
    }

    // 기능 키 (R, T) - 특정 조건 하에 언제든 가능하도록
    switch (event.key.toUpperCase()) {
        case 'R': // 현재 맵 재시작
            if (gameState === 'playing' || gameState === 'cleared' || gameState === 'resetting') {
                 console.log("R 키: 현재 맵 재시작");
                 resetPlayerPosition(); // 플레이어 위치만 리셋
            }
            break;
        case 'T': // 새 맵 생성
             console.log("T 키: 새 게임 시작");
             startNewGame(); // 점수 기록, 클리어 카운트 리셋, 새 맵 생성
            break;
    }
}

// 이동 목표 계산 (동일 - COLS, ROWS 기준)
function calculateMoveTarget() {
    if (!moveDirection) return;

    let currentTileCol = Math.round(player.x / TILE_SIZE);
    let currentTileRow = Math.round(player.y / TILE_SIZE);
    let targetCol = currentTileCol;
    let targetRow = currentTileRow;
    let dx = 0, dy = 0;

    switch (moveDirection) {
        case 'up': dy = -1; break;
        case 'down': dy = 1; break;
        case 'left': dx = -1; break;
        case 'right': dx = 1; break;
    }

    let hasMoved = false;
    currentMoveTarget = null; // 일단 초기화

    while (true) {
        const nextCol = targetCol + dx;
        const nextRow = targetRow + dy;

        // 1. 게임 영역 밖 체크
        if (nextCol < 0 || nextCol >= COLS || nextRow < 0 || nextRow >= ROWS) {
            // 한 칸이라도 움직였다면, 현재 위치가 최종 목적지 + 맵 밖 플래그
            if (hasMoved) {
                currentMoveTarget = { x: targetCol * TILE_SIZE, y: targetRow * TILE_SIZE, outOfBounds: true };
            } else {
                 currentMoveTarget = null; // 첫 칸부터 밖이면 이동 불가
            }
            break;
        }

        // 2. 벽 체크
        if (map[nextRow][nextCol] === 1) {
             // 한 칸이라도 움직였다면, 현재 위치가 최종 목적지
             if (hasMoved) {
                 currentMoveTarget = { x: targetCol * TILE_SIZE, y: targetRow * TILE_SIZE, outOfBounds: false };
             } else {
                  currentMoveTarget = null; // 첫 칸부터 벽이면 이동 불가
             }
            break;
        }

        // 3. 계속 이동
        targetCol = nextCol;
        targetRow = nextRow;
        hasMoved = true;
    }

    if (currentMoveTarget) {
        console.log(`이동 목표: (${currentMoveTarget.x / TILE_SIZE}, ${currentMoveTarget.y / TILE_SIZE}), 맵밖: ${currentMoveTarget.outOfBounds}`);
    } else if (!hasMoved) {
        console.log("이동 불가한 방향");
        moveDirection = null; // 이동 시작 안 함
    }
}

// --- 버튼 영역 정의 ---
const buttonRestart = { x: UI_START_X + 20, y: GAME_AREA_HEIGHT - 140, width: TILE_SIZE * 5, height: 40, text: "현재 맵 재시작 (R)" };
const buttonNewMap = { x: UI_START_X + 20, y: GAME_AREA_HEIGHT - 80, width: TILE_SIZE * 5, height: 40, text: "새 맵 생성 (T)" };


// --- 클릭 이벤트 처리 ---
function handleCanvasClick(event) {
    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    // 재시작 버튼 클릭 확인
    if (mouseX >= buttonRestart.x && mouseX <= buttonRestart.x + buttonRestart.width &&
        mouseY >= buttonRestart.y && mouseY <= buttonRestart.y + buttonRestart.height) {
        console.log("버튼 클릭: 현재 맵 재시작");
         if (gameState === 'playing' || gameState === 'cleared' || gameState === 'resetting') {
             resetPlayerPosition();
         }
    }

    // 새 맵 생성 버튼 클릭 확인
    if (mouseX >= buttonNewMap.x && mouseX <= buttonNewMap.x + buttonNewMap.width &&
        mouseY >= buttonNewMap.y && mouseY <= buttonNewMap.y + buttonNewMap.height) {
        console.log("버튼 클릭: 새 게임 시작");
        startNewGame();
    }
}


// --- 게임 루프 ---
function update() {
    // 클리어 또는 리셋 상태 처리
     if (gameState === 'cleared') {
         // 클리어 상태에서는 더 이상 업데이트(이동)하지 않음
         // 다음 맵 생성은 draw에서 메시지 표시 후 setTimeout으로 처리
         return;
     }
     if (gameState === 'resetting') {
         // 리셋 상태면 플레이어 위치 복구
          resetPlayerPosition(); // 여기서 gameState가 'playing'으로 바뀜
         return;
     }

     // 플레이 중이 아니거나 움직이지 않으면 업데이트 불필요
    if (gameState !== 'playing' || !isMoving) {
        return;
    }

    // 이동 애니메이션
    let moveEnded = false;
    let targetX = currentMoveTarget.x;
    let targetY = currentMoveTarget.y;

    switch (moveDirection) {
        case 'up':
            player.y -= MOVE_SPEED;
            if (player.y <= targetY) { player.y = targetY; moveEnded = true; }
            break;
        case 'down':
            player.y += MOVE_SPEED;
             if (player.y >= targetY) { player.y = targetY; moveEnded = true; }
            break;
        case 'left':
            player.x -= MOVE_SPEED;
             if (player.x <= targetX) { player.x = targetX; moveEnded = true; }
            break;
        case 'right':
            player.x += MOVE_SPEED;
             if (player.x >= targetX) { player.x = targetX; moveEnded = true; }
            break;
    }

    // 이동 완료 처리
    if (moveEnded) {
        isMoving = false;
        moveDirection = null;
        console.log(`이동 완료: (${player.x / TILE_SIZE}, ${player.y / TILE_SIZE})`);

        // 1. 맵 밖으로 나갔는지 최종 확인
        if (currentMoveTarget && currentMoveTarget.outOfBounds) {
            console.log("게임 오버! (맵 밖)");
            gameState = 'resetting'; // 리셋 상태로 변경
            currentMoveTarget = null;
            return; // 아래 로직 스킵
        }

        // 2. 목표 지점에 도달했는지 확인
        if (player.x === goal.x && player.y === goal.y) {
            console.log("클리어!");
            gameState = 'cleared';
            currentClears++; // 클리어 횟수 증가!
            // 다음 맵 생성은 draw 함수에서 메시지 표시 후 처리
        }
        currentMoveTarget = null;
    }
}

// --- UI 그리기 함수 ---
function drawUI() {
    // UI 배경색
    ctx.fillStyle = '#4a4a4a'; // 어두운 회색
    ctx.fillRect(UI_START_X, 0, canvas.width - UI_START_X, canvas.height);

    // UI 텍스트 스타일
    ctx.fillStyle = 'white';
    ctx.font = '16px Arial';
    ctx.textAlign = 'left';
    let uiY = 30; // 시작 Y 위치

    // 1. 단축키 설명
    ctx.font = 'bold 18px Arial';
    ctx.fillText("조작법", UI_START_X + 20, uiY);
    uiY += 30;
    ctx.font = '16px Arial';
    ctx.fillText("이동: WASD / 방향키", UI_START_X + 20, uiY); uiY += 25;
    ctx.fillText("맵 재시작: R", UI_START_X + 20, uiY); uiY += 25;
    ctx.fillText("새 게임: T", UI_START_X + 20, uiY); uiY += 40;

    // 2. 현재 클리어 기록
    ctx.font = 'bold 18px Arial';
    ctx.fillText("현재 기록", UI_START_X + 20, uiY); uiY += 30;
    ctx.font = '24px Arial';
    ctx.fillText(`${currentClears} 클리어`, UI_START_X + 20, uiY); uiY += 50;

    // 3. 상위 기록
    ctx.font = 'bold 18px Arial';
    ctx.fillText("상위 10 기록", UI_START_X + 20, uiY); uiY += 30;
    ctx.font = '14px Arial';
    if (highScores.length === 0) {
        ctx.fillText("기록이 없습니다.", UI_START_X + 20, uiY); uiY += 20;
    } else {
        highScores.forEach((scoreData, index) => {
            if (uiY < buttonRestart.y - 60) { // 버튼 영역 침범 않도록
                 ctx.fillText(`${index + 1}. ${scoreData.score} 클리어 (${scoreData.date})`, UI_START_X + 20, uiY);
                 uiY += 20;
            }
        });
    }
     uiY = buttonRestart.y; // Y 위치를 버튼 위로 재설정 (혹시 기록이 많을 경우 대비)

    // 4. 버튼 그리기
    // 재시작 버튼
    ctx.fillStyle = '#6699cc'; // 버튼 색
    ctx.fillRect(buttonRestart.x, buttonRestart.y, buttonRestart.width, buttonRestart.height);
    ctx.fillStyle = 'white';
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(buttonRestart.text, buttonRestart.x + buttonRestart.width / 2, buttonRestart.y + 25);

    // 새 맵 생성 버튼
    ctx.fillStyle = '#cc6666'; // 버튼 색
    ctx.fillRect(buttonNewMap.x, buttonNewMap.y, buttonNewMap.width, buttonNewMap.height);
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.fillText(buttonNewMap.text, buttonNewMap.x + buttonNewMap.width / 2, buttonNewMap.y + 25);

}

// --- 메인 그리기 함수 ---
function draw() {
    // 캔버스 클리어 (전체 영역)
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. 게임 영역 배경 그리기
    // bg.png 크기가 게임 영역(1184x672)과 다르면 맞춰서 그려야 함.
    // 여기서는 게임 영역 크기에 맞춰서 그림 (1200x675 이미지를 1184x672에 그림)
    ctx.drawImage(images.background, 0, 0, GAME_AREA_WIDTH, GAME_AREA_HEIGHT);

    // 2. 벽 그리기 (게임 영역 내)
    walls.forEach(wall => {
        ctx.drawImage(images.wall, wall.x, wall.y, TILE_SIZE, TILE_SIZE);
    });

    // 3. 목표 지점 그리기 (게임 영역 내)
    ctx.drawImage(images.goal, goal.x, goal.y, TILE_SIZE, TILE_SIZE);

    // 4. 플레이어 그리기 (게임 영역 내)
    ctx.drawImage(images.player, player.x, player.y, TILE_SIZE, TILE_SIZE);

    // 5. UI 패널 그리기
    drawUI();

    // 6. 클리어 메시지 표시 (전체 화면 중앙 오버레이)
     if (gameState === 'cleared') {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, canvas.height / 2 - 40, canvas.width, 80); // 전체 너비에 표시
        ctx.font = '30px Arial';
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.fillText(`클리어! (${currentClears}번째)`, canvas.width / 2, canvas.height / 2 + 10);

         // 클리어 상태가 된 후 일정 시간 뒤 다음 맵 생성 (루프에서 계속 호출되지 않도록 주의)
         // -> setTimeout을 gameLoop 밖에서 관리하거나, 플래그 사용 필요
         // -> 간단하게: 클리어 상태가 되면 바로 다음 맵 생성을 예약하고 상태 변경
         gameState = 'loading'; // 잠깐 로딩 상태로 (중복 예약 방지)
         setTimeout(() => {
              console.log("다음 레벨 생성");
              generateMap(); // 새 맵 생성 및 게임 상태 초기화 ('playing'으로)
         }, 1500); // 1.5초 후 새 맵 로드
    }
}


function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

// --- 게임 시작 ---
function startGame() {
    console.log("게임 시작!");
    loadHighScores(); // 쿠키에서 최고 점수 로드
    generateMap(); // 첫 맵 생성 (이 안에서 resetPlayerPosition 호출)
    document.addEventListener('keydown', handleInput); // 키 입력 리스너
    canvas.addEventListener('click', handleCanvasClick); // 마우스 클릭 리스너
    // gameState는 generateMap에서 'playing'으로 설정됨
    gameLoop(); // 게임 루프 시작
}

// 초기 이미지 로딩 시작
console.log("이미지 로딩 중...");
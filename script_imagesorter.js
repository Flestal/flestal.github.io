'use strict'; // 엄격 모드 사용

// --- DOM Elements ---
const dropArea = document.getElementById('drop-area');
const dropMessage = document.getElementById('drop-message');
const shuffleButton = document.getElementById('shuffle-button');
const sortButton = document.getElementById('sort-button');
const resetButton = document.getElementById('reset-button');
const segmentCountInput = document.getElementById('segment-count');
const sortMethodSelect = document.getElementById('sort-method');
const statusBar = document.getElementById('status-bar');
const statusMessage = document.getElementById('status-message');
const infoMessage = document.getElementById('info-message');

// --- State Variables ---
let originalImage = null;        // 원본 이미지 요소 (<img>)
let originalImageDataUrl = null; // 원본 이미지 Data URL (리셋용)
let originalWidth = 0;
let originalHeight = 0;
let segments = [];               // 이미지 조각 요소(<img>) 배열 (index가 id 역할)
let segmentOrder = [];           // 현재 표시 순서 배열 (segments 배열의 index를 담음)
let isSorting = false;           // 현재 정렬 중인지 여부
let sortDelay = 50;              // 정렬 시각화 지연 시간 (ms)

// --- Event Listeners ---
shuffleButton.addEventListener('click', handleShuffle);
sortButton.addEventListener('click', handleSort);
resetButton.addEventListener('click', handleReset);

dropArea.addEventListener('dragover', handleDragOver);
dropArea.addEventListener('dragleave', handleDragLeave);
dropArea.addEventListener('drop', handleDrop);

// --- Initialization ---
updateButtonStates(); // 초기 버튼 상태 설정

// --- Event Handlers ---

function handleDragOver(event) {
    event.preventDefault(); // 필수: 드롭을 허용하기 위함
    if (!isSorting) {
        dropArea.classList.add('drag-over'); // CSS 클래스로 스타일 관리
    }
}

function handleDragLeave() {
    dropArea.classList.remove('drag-over');
}

function handleDrop(event) {
    event.preventDefault(); // 필수: 브라우저 기본 동작 방지
    dropArea.classList.remove('drag-over');

    if (isSorting) return; // 정렬 중에는 파일 드롭 무시

    const file = event.dataTransfer.files[0];

    if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();

        reader.onloadstart = () => {
            // 로딩 시작 시 피드백
            dropArea.innerHTML = '<p>이미지 로딩 중...</p>';
            resetState(); // 이전 상태 초기화
        };

        reader.onload = (e) => {
            originalImageDataUrl = e.target.result; // 리셋용 Data URL 저장
            const img = new Image(); // new Image() 사용 권장
            img.onload = () => {
                // 이미지 로드 완료 후 처리
                originalImage = img;
                originalWidth = img.naturalWidth; // naturalWidth 사용
                originalHeight = img.naturalHeight; // naturalHeight 사용

                displayOriginalImage(); // 원본 이미지 표시 함수 호출
                resetButton.style.display = 'inline-block'; // 리셋 버튼 표시
                infoMessage.style.display = 'block'; // 정보 메시지 표시
                updateButtonStates(); // 버튼 상태 업데이트
            };
            img.onerror = () => {
                // 이미지 로딩 실패 시
                showError('이미지 파일을 로드할 수 없습니다.');
                handleReset(); // 상태 초기화
            };
            img.src = originalImageDataUrl;
        };

        reader.onerror = () => {
            // 파일 리딩 실패 시
            showError('파일을 읽는 중 오류가 발생했습니다.');
            handleReset(); // 상태 초기화
        };

        reader.readAsDataURL(file);
    } else {
        showError('이미지 파일(JPG, PNG 등)만 드롭해주세요.');
    }
}

function handleShuffle() {
    if (!originalImage || isSorting) return;

    const segmentCount = parseInt(segmentCountInput.value);
    if (isNaN(segmentCount) || segmentCount < 2) {
        showError('조각 개수는 2 이상의 숫자를 입력해주세요.');
        return;
    }

    // 이미지 분할 로직 개선 (정수 너비 보장 및 마지막 조각 처리)
    segments = [];
    segmentOrder = [];
    dropArea.innerHTML = ''; // 기존 내용 클리어
    dropArea.style.display = 'flex'; // Flexbox로 조각 배치

    let currentX = 0;
    for (let i = 0; i < segmentCount; i++) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.height = originalHeight;

        // 마지막 조각인지 확인하여 너비 계산
        let segmentWidth;
        if (i === segmentCount - 1) {
            // 마지막 조각은 남은 너비 전체 사용
            segmentWidth = originalWidth - currentX;
        } else {
            // 일반 조각은 계산된 너비 사용 (내림 처리)
            segmentWidth = Math.floor(originalWidth / segmentCount);
        }

        // 너비가 0 이하인 경우 방지 (매우 작은 이미지 또는 많은 조각 수)
        if (segmentWidth <= 0) {
           console.warn(`Segment ${i} has zero or negative width. Skipping.`);
           continue;
        }

        canvas.width = segmentWidth;

        // 원본 이미지에서 해당 부분 그리기
        ctx.drawImage(originalImage, currentX, 0, segmentWidth, originalHeight, 0, 0, segmentWidth, originalHeight);

        const segmentImg = new Image();
        segmentImg.src = canvas.toDataURL();
        segmentImg.style.height = '100%'; // 부모(dropArea) 높이에 맞춤
        segmentImg.style.display = 'block'; // inline 공백 제거
        segmentImg.dataset.id = i; // 데이터 속성으로 원래 인덱스(ID) 저장

        segments.push(segmentImg); // 배열에 이미지 요소 저장 (index가 id)
        segmentOrder.push(i);      // 초기 순서 배열 (0, 1, 2, ...)

        currentX += segmentWidth; // 다음 조각 시작 X 좌표 업데이트
    }

    // Fisher-Yates shuffle algorithm (segmentOrder 배열 섞기)
    for (let i = segmentOrder.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [segmentOrder[i], segmentOrder[j]] = [segmentOrder[j], segmentOrder[i]];
    }

    console.log("Shuffled order:", segmentOrder);
    renderSegments(); // 섞인 순서대로 이미지 조각 표시
    updateButtonStates(); // 버튼 상태 업데이트
}

async function handleSort() {
    if (segments.length === 0 || isSorting) return;

    isSorting = true;
    updateButtonStates(); // 정렬 시작 시 버튼 비활성화
    showStatus(`'${sortMethodSelect.options[sortMethodSelect.selectedIndex].text}' 정렬 중...`);

    const sortMethod = sortMethodSelect.value;
    const currentSegmentOrder = [...segmentOrder]; // 정렬 함수에 복사본 전달 고려 (필요 시)

    try {
        switch (sortMethod) {
            case 'bubble':    await bubbleSort(currentSegmentOrder); break;
            case 'selection': await selectionSort(currentSegmentOrder); break;
            case 'insertion': await insertionSort(currentSegmentOrder); break;
            case 'merge':     await mergeSort(currentSegmentOrder, 0, currentSegmentOrder.length - 1); break;
            case 'heap':      await heapSort(currentSegmentOrder); break;
            case 'quick':     await quickSort(currentSegmentOrder, 0, currentSegmentOrder.length - 1); break;
            case 'tree':      await treeSort(currentSegmentOrder); break;
            default: console.error("Unknown sort method:", sortMethod);
        }
        // 최종적으로 정렬된 상태 반영
        segmentOrder = currentSegmentOrder;
        renderSegments(); // 최종 정렬 결과 렌더링 보장
        showStatus('정렬 완료!');
    } catch (error) {
        console.error("Sorting error:", error);
        showError('정렬 중 오류가 발생했습니다.');
        showStatus('정렬 오류');
    } finally {
        isSorting = false;
        updateButtonStates(); // 정렬 완료/오류 후 버튼 활성화
        // 상태 메시지 잠시 후 숨기기 (선택 사항)
        // setTimeout(() => { statusBar.style.display = 'none'; }, 3000);
    }
}

function handleReset() {
    if (isSorting) return; // 정렬 중에는 리셋 방지

    resetState();
    // 드롭 영역 초기 메시지 복원
    dropArea.innerHTML = '';
    dropArea.appendChild(dropMessage);
    dropMessage.textContent = '여기에 JPG/PNG 파일을 드래그 앤 드롭하세요';
    dropArea.style.width = ''; // 기본값으로 복원
    dropArea.style.height = ''; // 기본값으로 복원
    dropArea.style.display = 'flex'; // 초기 flex 설정 유지

    resetButton.style.display = 'none'; // 리셋 버튼 숨김
    statusBar.style.display = 'none'; // 상태 바 숨김
    infoMessage.style.display = 'none'; // 정보 메시지 숨김
    updateButtonStates(); // 버튼 상태 업데이트
}

// --- Helper Functions ---

function resetState() {
    // 상태 변수 초기화
    originalImage = null;
    originalImageDataUrl = null;
    originalWidth = 0;
    originalHeight = 0;
    segments = [];
    segmentOrder = [];
    isSorting = false; // 중요: isSorting 상태도 초기화
}

function displayOriginalImage() {
    // 드롭 영역에 원본 이미지 표시
    dropArea.innerHTML = ''; // 내용 비우기
    dropArea.style.width = `${originalWidth}px`;
    dropArea.style.height = `${originalHeight}px`;
    dropArea.style.display = 'block'; // 이미지 하나만 있을 때는 block이 나을 수 있음

    const imgElement = new Image();
    imgElement.src = originalImageDataUrl;
    imgElement.style.width = '100%';
    imgElement.style.height = '100%';
    dropArea.appendChild(imgElement);
}

function renderSegments() {
    // 현재 segmentOrder에 따라 이미지 조각들을 dropArea에 그림
    dropArea.innerHTML = ''; // 기존 이미지 조각 제거
    dropArea.style.display = 'flex'; // 조각들을 가로로 배치하기 위해 flex 사용

    segmentOrder.forEach(id => {
        // segments 배열에서 id에 해당하는 이미지 요소 가져오기
        const segmentElement = segments[id];
        if (segmentElement) {
            dropArea.appendChild(segmentElement);
        } else {
            console.error(`Segment with id ${id} not found in segments array.`);
        }
    });
     // 드롭 영역 크기 업데이트 (조각 총합에 맞춤) - Flexbox 사용 시 자동 조절될 수 있음
     dropArea.style.width = `${originalWidth}px`;
     dropArea.style.height = `${originalHeight}px`;
}

async function swap(arr, index1, index2) {
    // 시각화를 위한 지연 포함
    await new Promise(resolve => setTimeout(resolve, sortDelay));
    // segmentOrder 배열 내의 요소(id) 위치 변경
    [arr[index1], arr[index2]] = [arr[index2], arr[index1]];
    // 변경된 순서로 즉시 렌더링
    segmentOrder = arr; // 중요: 실제 segmentOrder 업데이트
    renderSegments();
}

// 가상 스왑 (Merge Sort 등에서 실제 스왑 없이 위치 변경 + 렌더링만 필요할 때)
async function virtualSwap(arr, index) {
    await new Promise(resolve => setTimeout(resolve, sortDelay));
    segmentOrder = arr; // 변경된 배열 반영
    renderSegments(); // 렌더링
}

function updateButtonStates() {
    // 상태에 따라 버튼 활성화/비활성화
    const imageLoaded = !!originalImage;
    const segmentsExist = segments.length > 0;

    shuffleButton.disabled = !imageLoaded || isSorting;
    sortButton.disabled = !segmentsExist || isSorting;
    resetButton.disabled = isSorting; // 리셋은 정렬 중 아닐 때만 가능
    sortMethodSelect.disabled = isSorting;
    segmentCountInput.disabled = isSorting;

    // Shuffle 후에만 Sort 가능하도록 하려면:
    // sortButton.disabled = !segmentsExist || isSorting || segmentOrder.length === 0;
}

function showStatus(message) {
    statusBar.style.display = 'block';
    statusMessage.textContent = message;
}

function showError(message) {
    // 사용자에게 오류 메시지 표시 (alert 대신 다른 방식 고려 가능)
    alert(`오류: ${message}`);
    console.error(message);
}

// --- Sorting Algorithms (with modifications) ---
// 이제 segmentData 객체 대신 segments 배열의 index(id)를 직접 비교합니다.
// swap 함수는 segmentOrder 배열을 직접 수정하고 renderSegments를 호출합니다.

async function bubbleSort(arr) {
    const len = arr.length;
    for (let i = 0; i < len; i++) {
        let swapped = false;
        for (let j = 0; j < len - i - 1; j++) {
            // 비교 대상: arr[j]와 arr[j + 1]은 segment의 원래 ID(index)
            if (arr[j] > arr[j + 1]) {
                await swap(arr, j, j + 1); // swap 함수가 arr(segmentOrder) 수정 및 렌더링
                swapped = true;
            }
        }
        if (!swapped) break; // 최적화: 교환 없으면 이미 정렬됨
    }
}

async function selectionSort(arr) {
    const len = arr.length;
    for (let i = 0; i < len; i++) {
        let minIndex = i;
        for (let j = i + 1; j < len; j++) {
            if (arr[j] < arr[minIndex]) { // ID 비교
                minIndex = j;
            }
        }
        if (minIndex !== i) {
            await swap(arr, i, minIndex);
        } else {
             // 제자리인 경우에도 시각적 효과를 위해 잠시 멈춤 (선택 사항)
             await virtualSwap(arr, i);
        }
    }
}

async function insertionSort(arr) {
    const len = arr.length;
    for (let i = 1; i < len; i++) {
        let currentId = arr[i];
        let j = i - 1;
        while (j >= 0 && arr[j] > currentId) {
            // 요소를 뒤로 밀면서 시각화 (실제 swap 대신 이동처럼 보이게)
            arr[j + 1] = arr[j];
            await virtualSwap(arr, j + 1); // 이동 후 렌더링
            j--;
        }
        if (arr[j + 1] !== currentId) {
            arr[j + 1] = currentId;
            await virtualSwap(arr, j + 1); // 최종 위치에 삽입 후 렌더링
        }
    }
}

async function mergeSort(arr, left, right) {
    if (left >= right) {
        return; // 기저 조건: 요소가 하나거나 없을 때
    }
    const mid = Math.floor((left + right) / 2);
    await mergeSort(arr, left, mid);
    await mergeSort(arr, mid + 1, right);
    await merge(arr, left, mid, right);
}

async function merge(arr, left, mid, right) {
    const n1 = mid - left + 1;
    const n2 = right - mid;

    // 임시 배열 생성 (값 복사)
    const L = new Array(n1);
    const R = new Array(n2);
    for (let i = 0; i < n1; i++) L[i] = arr[left + i];
    for (let j = 0; j < n2; j++) R[j] = arr[mid + 1 + j];

    let i = 0; // L 배열 인덱스
    let j = 0; // R 배열 인덱스
    let k = left; // 병합될 원래 배열(arr) 인덱스

    while (i < n1 && j < n2) {
        if (L[i] <= R[j]) { // ID 비교
            arr[k] = L[i];
            i++;
        } else {
            arr[k] = R[j];
            j++;
        }
        await virtualSwap(arr, k); // 병합되는 과정 시각화
        k++;
    }

    // 남은 요소들 복사
    while (i < n1) {
        arr[k] = L[i];
        await virtualSwap(arr, k);
        i++;
        k++;
    }
    while (j < n2) {
        arr[k] = R[j];
        await virtualSwap(arr, k);
        j++;
        k++;
    }
}


async function heapSort(arr) {
    const n = arr.length;

    // 최대 힙 구성 (Build Max Heap)
    // 마지막 부모 노드부터 시작하여 루트까지 heapify 수행
    for (let i = Math.floor(n / 2) - 1; i >= 0; i--) {
        await heapify(arr, n, i);
    }

    // 힙 정렬
    // 루트(최대값)를 배열 끝으로 보내고, 힙 크기를 줄여가며 heapify 반복
    for (let i = n - 1; i > 0; i--) {
        // 루트(arr[0])와 마지막 요소(arr[i]) 교환
        await swap(arr, 0, i);
        // 힙 크기를 줄여서(i) 루트 노드에 대해 heapify 수행
        await heapify(arr, i, 0);
    }
}

async function heapify(arr, heapSize, rootIndex) {
    let largest = rootIndex;    // 현재 루트를 가장 큰 값으로 초기화
    const leftChild = 2 * rootIndex + 1;
    const rightChild = 2 * rootIndex + 2;

    // 왼쪽 자식이 힙 크기 안에 있고, 루트보다 크면 largest 업데이트
    if (leftChild < heapSize && arr[leftChild] > arr[largest]) {
        largest = leftChild;
    }

    // 오른쪽 자식이 힙 크기 안에 있고, 현재 largest보다 크면 largest 업데이트
    if (rightChild < heapSize && arr[rightChild] > arr[largest]) {
        largest = rightChild;
    }

    // largest가 루트 인덱스와 다르면 (자식 중 더 큰 값이 있으면)
    if (largest !== rootIndex) {
        // 루트와 largest 교환
        await swap(arr, rootIndex, largest);
        // 교환된 위치(largest 인덱스)를 루트로 하는 서브트리에 대해 재귀적으로 heapify 수행
        // 이 부분이 중요: 영향을 받은 서브트리도 힙 속성을 만족하도록 함
        await heapify(arr, heapSize, largest);
    } else {
         // 변경 없을 때도 시각화를 위해 잠시 멈춤 (선택 사항)
         await virtualSwap(arr, rootIndex);
    }
}


async function quickSort(arr, low, high) {
    if (low < high) {
        // 파티션 나누고, 피벗 위치(pi) 얻기
        const pi = await partition(arr, low, high);

        // 피벗을 기준으로 좌우 부분 배열에 대해 재귀 호출
        // Promise.all을 사용하여 시각적으로 동시에 진행되는 것처럼 보이게 함
        await Promise.all([
            quickSort(arr, low, pi - 1),
            quickSort(arr, pi + 1, high)
        ]);
    }
}

async function partition(arr, low, high) {
    const pivotId = arr[high]; // 마지막 요소를 피벗으로 사용
    let i = low - 1; // 작은 요소들의 마지막 위치 인덱스

    for (let j = low; j < high; j++) {
        // 현재 요소(arr[j])가 피벗(pivotId)보다 작거나 같으면
        if (arr[j] <= pivotId) {
            i++; // 작은 요소 위치 인덱스 증가
            await swap(arr, i, j); // arr[i]와 arr[j] 교환
        } else {
             // 비교만 하고 넘어갈 때도 시각화를 위해 멈춤 (선택 사항)
             await virtualSwap(arr, j);
        }
    }

    // 모든 요소 확인 후, 피벗을 올바른 위치(i + 1)로 이동
    await swap(arr, i + 1, high);
    return i + 1; // 피벗의 최종 위치 반환
}


// --- Tree Sort ---
// 이진 탐색 트리 노드
class TreeNode {
    constructor(id) {
        this.id = id; // 노드는 segment ID를 저장
        this.left = null;
        this.right = null;
        this.count = 1; // 중복 ID 처리용 카운트 (Tree Sort는 일반적으로 중복 처리 안함)
    }
}

// 이진 탐색 트리에 노드 삽입 (재귀)
function insertNode(node, id) {
    if (node === null) {
        return new TreeNode(id);
    }

    // 중복 ID 처리 (Tree Sort의 표준 동작은 아니지만, 필요 시)
    if (id === node.id) {
        node.count++;
    } else if (id < node.id) {
        node.left = insertNode(node.left, id);
    } else {
        node.right = insertNode(node.right, id);
    }
    return node;
}

// 중위 순회 (In-order Traversal) 및 배열 채우기 (재귀)
async function inOrderTraversal(node, sortedArr) {
    if (node !== null) {
        await inOrderTraversal(node.left, sortedArr);
        // 노드의 ID를 count만큼 배열에 추가 (중복 처리 반영)
        for (let i = 0; i < node.count; i++) {
             sortedArr.push(node.id);
        }
        await inOrderTraversal(node.right, sortedArr);
    }
}

async function treeSort(arr) {
    if (arr.length === 0) return;

    let root = null;
    // 1. 배열 요소로 이진 탐색 트리 구축
    for (const id of arr) {
        root = insertNode(root, id);
        // 트리 구축 과정 시각화는 복잡하므로 생략하거나 다른 방식 필요
    }

    // 2. 중위 순회하여 정렬된 ID 배열 생성
    const sortedIds = [];
    await inOrderTraversal(root, sortedIds);

    // 3. 원래 배열(arr)을 정렬된 ID 배열로 업데이트하면서 시각화
    for (let i = 0; i < sortedIds.length; i++) {
        if (arr[i] !== sortedIds[i]) {
            arr[i] = sortedIds[i];
            await virtualSwap(arr, i); // 변경된 배열 상태 렌더링
        }
    }
    // 최종 상태 렌더링 보장
    segmentOrder = arr;
    renderSegments();
}
let originalImage = null;
let originalWidth = -1;
let segments = {}; // 이미지 조각을 저장할 객체 (key: id, value: segment)
let segmentOrder = []; // 이미지 조각의 순서를 저장할 배열 (id를 순서대로 저장)
let segmentData = {}; // 이미지 조각의 데이터를 저장할 객체 (key: id, value: data)

const dropArea = document.getElementById('drop-area');
const shuffleButton = document.getElementById('shuffle-button');
const sortButton = document.getElementById('sort-button');
const shuffleCountInput = document.getElementById('shuffle-count');

shuffleButton.addEventListener('click', shuffleImage);
sortButton.addEventListener('click', sortImage);

dropArea.addEventListener('dragover', (event) => {
    event.preventDefault();
    dropArea.style.backgroundColor = '#e0e0e0';
});

dropArea.addEventListener('dragleave', () => {
    dropArea.style.backgroundColor = '#e9e9e9';
});

dropArea.addEventListener('drop', (event) => {
    event.preventDefault();
    dropArea.style.backgroundColor = '#e9e9e9';

    const file = event.dataTransfer.files[0];
    if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
            dropArea.innerHTML = '';
            const img = document.createElement('img');
            img.src = e.target.result;
            img.onload = () => {
                originalImage = img;
                originalWidth = originalImage.width;
                console.log("originalWidth : ",originalImage.width);
                console.log("dropareawidth : ",dropArea.style.width);
                dropArea.style.width = `${originalImage.width}px`;
                dropArea.style.height = `${originalImage.height}px`;
                console.log("dropareawidth2 : ",dropArea.style.width);
                dropArea.appendChild(img);
                segments = {};
                segmentOrder = [];
                segmentData = {};
            }
        };
        reader.readAsDataURL(file);
    }
});

function shuffleImage() {
    if (!originalImage) return;

    const shuffleCount = parseInt(shuffleCountInput.value);
    if (isNaN(shuffleCount) || shuffleCount <= 0) {
        alert('Please enter a valid number for shuffling.');
        return;
    }

    // console.log("img complete : ",originalImage.complete);
    console.log("originalWidth : ",originalWidth);
    console.log("originalImage.width : ",originalImage.width);
    

    // const segmentWidth = originalImage.width / shuffleCount;
    const segmentWidth = originalWidth / shuffleCount;
    segments = {};
    segmentOrder = [];
    segmentData = {};

    dropArea.innerHTML = '';

    for (let i = 0; i < shuffleCount; i++) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.height = originalImage.height;
        canvas.width = segmentWidth;
        ctx.drawImage(originalImage, i * segmentWidth, 0, segmentWidth, originalImage.height, 0, 0, segmentWidth, originalImage.height);

        const segment = document.createElement('img');
        segment.src = canvas.toDataURL();
        segment.style.height = '100%';
        segment.style.display = 'block';
        // segment.classList.add('splitted');
        segments[i] = segment; // key-value 형태로 저장 (key: id, value: segment)
        segmentOrder.push(i); // 초기 순서 (id) 저장
        segmentData[i] = { id: i, src: segment.src }; // 이미지 조각의 데이터 (id, src) 저장
    }
    console.log()

    // Fisher-Yates shuffle algorithm
    for (let i = segmentOrder.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [segmentOrder[i], segmentOrder[j]] = [segmentOrder[j], segmentOrder[i]];
    }
    console.log("shuffled : ",segmentOrder);

    renderSegments(); // 섞인 순서대로 이미지 조각 표시
}

async function sortImage() {
    if (Object.keys(segments).length === 0) return;

    const sortMethod = document.getElementById('sort-method').value;

    switch (sortMethod) {
        case 'bubble':
            await bubbleSort(segmentOrder);
            break;
        case 'selection':
            await selectionSort(segmentOrder);
            break;
        case 'insertion':
            await insertionSort(segmentOrder);
            break;
        case 'merge':
            await mergeSort(segmentOrder, 0, segmentOrder.length - 1);
            break;
        case 'heap':
            await heapSort(segmentOrder);
            break;
        case 'quick':
            await quickSort(segmentOrder, 0, segmentOrder.length - 1);
            break;
        case 'tree':
            await treeSort(segmentOrder);
            break;
    }
}

async function bubbleSort(arr) {
    const len = arr.length;
    for (let i = 0; i < len; i++) {
        for (let j = 0; j < len - i - 1; j++) {
            if (segmentData[arr[j]].id > segmentData[arr[j + 1]].id) { // id를 기준으로 비교
                await swap(arr, j, j + 1);
                renderSegments(); // id 순서가 바뀔 때마다 이미지 조각 다시 표시
            }
        }
    }
}

async function selectionSort(arr) {
    const len = arr.length;
    for (let i = 0; i < len; i++) {
        let min = i;
        for (let j = i + 1; j < len; j++) {
            if (segmentData[arr[min]].id > segmentData[arr[j]].id) { // id를 기준으로 비교
                min = j;
            }
        }
        if (min !== i) {
            await swap(arr, i, min);
            renderSegments(); // id 순서가 바뀔 때마다 이미지 조각 다시 표시
        }
    }
}

async function insertionSort(arr) {
    const len = arr.length;
    for (let i = 1; i < len; i++) {
        let j = i;
        while (j > 0 && segmentData[arr[j - 1]].id > segmentData[arr[j]].id) { // id를 기준으로 비교
            await swap(arr, j, j - 1);
            renderSegments(); // id 순서가 바뀔 때마다 이미지 조각 다시 표시
            j--;
        }
    }
}

async function mergeSort(arr, left, right) {
    if (left < right) {
        const mid = Math.floor((left + right) / 2);
        await mergeSort(arr, left, mid);
        await mergeSort(arr, mid + 1, right);
        await merge(arr, left, mid, right);
    }
}

async function merge(arr, left, mid, right) {
    const n1 = mid - left + 1;
    const n2 = right - mid;

    const L = new Array(n1);
    const R = new Array(n2);

    for (let i = 0; i < n1; i++) {
        L[i] = arr[left + i];
    }
    for (let j = 0; j < n2; j++) {
        R[j] = arr[mid + 1 + j];
    }

    let i = 0;
    let j = 0;
    let k = left;

    while (i < n1 && j < n2) {
        if (segmentData[L[i]].id <= segmentData[R[j]].id) {
            arr[k] = L[i];
            i++;
        } else {
            arr[k] = R[j];
            j++;
        }
        await swap(arr, k, k); // 시각화를 위해 swap 사용 (이동하는 요소 강조)
        renderSegments();
        k++;
    }

    while (i < n1) {
        arr[k] = L[i];
        await swap(arr, k, k);
        renderSegments();
        i++;
        k++;
    }

    while (j < n2) {
        arr[k] = R[j];
        await swap(arr, k, k);
        renderSegments();
        j++;
        k++;
    }
}

async function heapSort(arr) {
    const len = arr.length;

    for (let i = Math.floor(len / 2) - 1; i >= 0; i--) {
        await heapify(arr, len, i);
    }

    for (let i = len - 1; i > 0; i--) {
        await swap(arr, 0, i);
        renderSegments();
        await heapify(arr, i, 0);
    }
}

async function heapify(arr, len, i) {
    let largest = i;
    const left = 2 * i + 1;
    const right = 2 * i + 2;

    if (left < len && segmentData[arr[left]].id > segmentData[arr[largest]].id) {
        largest = left;
    }

    if (right < len && segmentData[arr[right]].id > segmentData[arr[largest]].id) {
        largest = right;
    }

    if (largest !== i) {
        await swap(arr, i, largest);
        renderSegments();
        await heapify(arr, len, largest);
    }
}

async function quickSort(arr, low, high) {
    if (low < high) {
        const pi = await partition(arr, low, high);
        // await quickSort(arr, low, pi - 1);
        // await quickSort(arr, pi + 1, high);
        await Promise.all([
            quickSort(arr,low,pi-1),
            quickSort(arr,pi+1,high)
        ]);
    }
}

async function partition(arr, low, high) {
    // 가운데 값을 피벗으로 선택
    const pivotIndex = Math.floor((low + high) / 2);
    const pivot = segmentData[arr[pivotIndex]].id;

    // 피벗을 맨 오른쪽으로 이동 (편의상)
    await swap(arr, pivotIndex, high);
    renderSegments();

    let i = (low - 1);

    for (let j = low; j <= high - 1; j++) {
        if (segmentData[arr[j]].id < pivot) {
            i++;
            await swap(arr, i, j);
            renderSegments();
        }
    }
    await swap(arr, i + 1, high);
    renderSegments();
    return (i + 1);
}

// 이진 탐색 트리 노드
class Node {
    constructor(data) {
        this.data = data;
        this.left = null;
        this.right = null;
    }
}

// 이진 탐색 트리 순회 및 정렬
async function inOrderTraversal(node, arr) {
    if (node !== null) {
        await inOrderTraversal(node.left, arr);
        arr.push(node.data);
        await inOrderTraversal(node.right, arr);
    }
}

async function treeSort(arr) {
    let root = null;

    // 이진 탐색 트리 구축
    for (let i = 0; i < arr.length; i++) {
        root = await insert(root, arr[i]);
    }

    // 중위 순회를 사용하여 정렬된 배열 얻기
    const sortedArr = [];
    await inOrderTraversal(root, sortedArr);

    // 정렬된 배열을 원래 배열에 복사
    for (let i = 0; i < arr.length; i++) {
        arr[i] = sortedArr[i];
        await swap(arr, i, i); // 시각화를 위해 swap 사용
        renderSegments();
    }
}

// 이진 탐색 트리에 노드 삽입
async function insert(node, data) {
    if (node === null) {
        return new Node(data);
    }

    if (segmentData[data].id < segmentData[node.data].id) {
        node.left = await insert(node.left, data);
    } else {
        node.right = await insert(node.right, data);
    }

    return node;
}

async function swap(arr, index1, index2) {
    return new Promise(resolve => {
        setTimeout(() => {
            // id 순서만 변경
            [arr[index1], arr[index2]] = [arr[index2], arr[index1]];
            resolve();
        }, 50);
    });
}

function renderSegments() {
    dropArea.innerHTML = ''; // 기존 이미지 조각 제거
    segmentOrder.forEach(id => {
        dropArea.appendChild(segments[id]);
    });
}
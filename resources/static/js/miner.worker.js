// miner.worker.js
self.importScripts('https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.1.1/crypto-js.min.js');

// Состояние воркера
let isMining = false;
let currentJob = null;
let currentDifficulty = null;
let hashCount = 0;
let lastHashrateUpdate = Date.now();
let startHashCount = 0;

// Функция SHA-256 с использованием Web Crypto API
async function sha256(message) {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
        const encoder = new TextEncoder();
        const data = encoder.encode(message);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
    
    // Fallback на CryptoJS
    return CryptoJS.SHA256(message).toString();
}

// Генерация случайной строки
function generateRandomString(length = 20) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// Основной цикл майнинга
async function mineLoop() {
    if (!isMining || !currentJob || !currentDifficulty) return;
    
    try {
        const randomStr = generateRandomString();
        const hash = await sha256(currentJob + randomStr);
        hashCount++;
        
        // Проверяем сложность
        if (hash.startsWith('0'.repeat(currentDifficulty))) {
            self.postMessage({
                type: 'result',
                result: randomStr,
                hash: hash,
                hashCount: hashCount
            });
            return;
        }
        
        // Отправляем статистику каждые 1000 хешей или каждую секунду
        const now = Date.now();
        if (hashCount - startHashCount >= 1000 || now - lastHashrateUpdate >= 1000) {
            const timeDiff = (now - lastHashrateUpdate) / 1000;
            const hashesSinceLastUpdate = hashCount - startHashCount;
            const hashrate = timeDiff > 0 ? Math.floor(hashesSinceLastUpdate / timeDiff) : 0;
            
            self.postMessage({
                type: 'stats',
                hashCount: hashCount,
                hashrate: hashrate
            });
            
            startHashCount = hashCount;
            lastHashrateUpdate = now;
        }
        
        // Продолжаем майнинг
        self.setTimeout(mineLoop, 0);
        
    } catch (error) {
        self.postMessage({
            type: 'error',
            message: error.message || 'Unknown error in worker'
        });
    }
}

// Обработчик сообщений от основного потока
self.addEventListener('message', async (event) => {
    const { type, job, difficulty, stop } = event.data;
    
    switch (type) {
        case 'start':
            if (!job || typeof difficulty !== 'number') {
                self.postMessage({
                    type: 'error',
                    message: 'Invalid job or difficulty parameters'
                });
                return;
            }
            
            isMining = true;
            currentJob = job;
            currentDifficulty = difficulty;
            hashCount = 0;
            startHashCount = 0;
            lastHashrateUpdate = Date.now();
            
            self.postMessage({
                type: 'status',
                message: 'Mining started'
            });
            
            mineLoop();
            break;
            
        case 'stop':
            isMining = false;
            currentJob = null;
            currentDifficulty = null;
            
            self.postMessage({
                type: 'status',
                message: 'Mining stopped',
                finalHashCount: hashCount
            });
            break;
            
        case 'updateJob':
            if (isMining && job && typeof difficulty === 'number') {
                currentJob = job;
                currentDifficulty = difficulty;
                self.postMessage({
                    type: 'status',
                    message: 'Job updated'
                });
            }
            break;
            
        case 'getStats':
            const now = Date.now();
            const timeDiff = (now - lastHashrateUpdate) / 1000;
            const hashesSinceLastUpdate = hashCount - startHashCount;
            const hashrate = timeDiff > 0 ? Math.floor(hashesSinceLastUpdate / timeDiff) : 0;
            
            self.postMessage({
                type: 'stats',
                hashCount: hashCount,
                hashrate: hashrate,
                isMining: isMining
            });
            break;
    }
});

// Обработчик ошибок
self.onerror = function(error) {
    self.postMessage({
        type: 'error',
        message: `Worker error: ${error.message}`,
        filename: error.filename,
        lineno: error.lineno
    });
};
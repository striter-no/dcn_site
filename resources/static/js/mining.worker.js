function showMiningError(message) {
    const existing = document.getElementById('mining-error-notification');
    if (existing) existing.remove();
    
    const notification = document.createElement('div');
    notification.id = 'mining-error-notification';
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background-color: #ff6b6b;
        color: #fff;
        padding: 12px 16px;
        border-radius: 8px;
        z-index: 10000;
        font-family: monospace;
        font-size: 13px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
        max-width: 300px;
        word-wrap: break-word;
    `;
    notification.textContent = message;
    notification.onclick = () => notification.remove();
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.opacity = '0';
            notification.style.transition = 'opacity 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }
    }, 5000);
}

// Функции для работы с куками
function getCookie(name) {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) === ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
}

function setCookie(name, value, days = 365) {
    const expires = new Date();
    expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
    document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/`;
}

// SHA256 функция
async function fsha256(inp) {
    const str = String(inp);
    
    // Используем Web Crypto API если доступен
    if (window.crypto && window.crypto.subtle) {
        const encoder = new TextEncoder();
        const data = encoder.encode(str);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
    
    // Fallback на crypto-js если доступен
    if (typeof CryptoJS !== 'undefined') {
        return CryptoJS.SHA256(str).toString();
    }
}

function sha256Simple(str) {
    // Упрощенная версия для демонстрации
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(64, '0');
}

// Состояние майнинга
let miningState = {
    isMining: false,
    startTime: null,
    currentJob: null,
    difficulty: null,
    hashCount: 0,
    startHashCount: 0,
    lastHashrateUpdate: Date.now(),
    intervalId: null,
    jobCheckInterval: null
};

// Получение job с сервера
async function getCurrentJob() {
    try {
        const response = await fetch('/api/mining/job');
        const data = await response.json();
        if (data.status === 'ok') {
            return {
                job: data.challange,
                difficulty: data.difficulty
            };
        }
        return null;
    } catch (error) {
        console.error('Ошибка получения job:', error);
        return null;
    }
}

// Майнинг функция
async function mine(preset, difficulty, stopCallback) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    
    while (!stopCallback()) {
        // Генерируем случайную строку
        let s = '';
        for (let i = 0; i < 20; i++) {
            s += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        
        // Проверяем хеш (await так как fsha256 теперь async)
        const hash = await fsha256(preset + s);
        miningState.hashCount++;
        
        if (hash.startsWith('0'.repeat(difficulty))) {
            return s;
        }
        
        // Небольшая задержка чтобы не блокировать UI
        await new Promise(resolve => setTimeout(resolve, 0));
    }
    
    throw new Error('Mining stopped');
}

// Отправка результата майнинга
async function submitMining(account, key, minedString) {
    try {
        const response = await fetch('/api/mining/check', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                account: account,
                key: key,
                string: minedString
            })
        });
        
        const data = await response.json();
        return data.description || 'Unknown result';
    } catch (error) {
        console.error('Ошибка отправки результата:', error);
        return 'Error submitting';
    }
}

// Получение баланса
async function getBalance(account) {
    try {
        const response = await fetch('/api/acc/balance', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ account: account })
        });
        
        const data = await response.json();
        if (data.status === 'ok') {
            return parseFloat(data.description) || 0;
        }
        return 0;
    } catch (error) {
        console.error('Ошибка получения баланса:', error);
        return 0;
    }
}

// Получение доменов
async function getDomains(account) {
    try {
        const response = await fetch('/api/acc/domains', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ account: account })
        });
        
        const data = await response.json();
        if (data.status === 'ok' && Array.isArray(data.description)) {
            return data.description;
        }
        return [];
    } catch (error) {
        console.error('Ошибка получения доменов:', error);
        return [];
    }
}

// Получение стоимости домена
async function getDomainCost(domain) {
    try {
        const response = await fetch('/api/dmn/cost', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ domain: domain })
        });
        
        const data = await response.json();
        if (data.status === 'ok') {
            return parseFloat(data.description) || 0;
        }
        return 0;
    } catch (error) {
        console.error('Ошибка получения стоимости домена:', error);
        return 0;
    }
}

// Форматирование времени
function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

// Обновление времени майнинга
function updateMiningTime() {
    if (!miningState.isMining || !miningState.startTime) return;
    
    const now = Date.now();
    const elapsed = Math.floor((now - miningState.startTime) / 1000);
    const miningButton = document.getElementById('mining-button');
    
    if (miningButton) {
        miningButton.textContent = `майнинг ${formatTime(elapsed)}`;
    }
    
    // Сохраняем время в куки
    setCookie('mining_start_time', miningState.startTime.toString());
}

// Обновление хешрейта
function updateHashrate() {
    const now = Date.now();
    const timeDiff = (now - miningState.lastHashrateUpdate) / 1000; // секунды
    
    if (timeDiff > 0) {
        const hashesSinceLastUpdate = miningState.hashCount - miningState.startHashCount;
        const hashrate = Math.floor(hashesSinceLastUpdate / timeDiff);
        
        const hashrateEl = document.getElementById('mining-hashrate');
        if (hashrateEl) {
            hashrateEl.textContent = `${hashrate} H/s`;
        }
        
        miningState.startHashCount = miningState.hashCount;
        miningState.lastHashrateUpdate = now;
    }
}

// Загрузка доменов
async function loadDomains(account) {
    const domainsListEl = document.getElementById('domains-list');
    if (!domainsListEl) return;
    
    try {
        const domains = await getDomains(account);
        
        if (domains.length === 0) {
            domainsListEl.innerHTML = '<div class="col-12 mono-text text-center py-3" style="color: #9591A4;">У вас пока нет доменов</div>';
            return;
        }
        
        // Параллельная загрузка стоимости доменов
        const costPromises = domains.map(domain => getDomainCost(domain));
        const costs = await Promise.all(costPromises);
        
        let html = '';
        domains.forEach((domain, index) => {
            const cost = costs[index] || 0;
            html += `
                <div class="col-12 mono-text domain-info mt-2 mb-2 py-2">
                    <div class="row row-no-stretch">
                        <div class="col-6 px-5 mono-text black-text">${domain}</div>
                        <div class="col-6 mono-text black-text text-end" style="padding-right: 20px;">${cost.toFixed(2)} dcn</div>
                    </div>
                </div>
            `;
        });
        
        domainsListEl.innerHTML = html;
    } catch (error) {
        console.error('Ошибка загрузки доменов:', error);
        domainsListEl.innerHTML = '<div class="col-12 mono-text text-center py-3" style="color: #ff6b6b;">Ошибка загрузки доменов</div>';
    }
}

// Обновление баланса
async function updateBalance(account) {
    const balance = await getBalance(account);
    const balanceEl = document.getElementById('mining-balance');
    if (balanceEl) {
        balanceEl.textContent = `${balance.toFixed(2)} dcn`;
    }
}

// Проверка изменения job
async function checkJobChange() {
    if (!miningState.isMining) return;
    
    const jobData = await getCurrentJob();
    if (!jobData) return;
    
    if (miningState.currentJob !== jobData.job) {
        console.log(`Job changed: ${miningState.currentJob} -> ${jobData.job}`);
        miningState.currentJob = jobData.job;
        miningState.difficulty = jobData.difficulty;
    }
}
let miningWorker = null;
let workerStatsInterval = null;
let jobCheckInterval = null;

// Функция создания и управления worker
function setupMiningWorker(account, key) {
    if (miningWorker) {
        miningWorker.terminate();
    }
    
    // Создаем worker
    miningWorker = new Worker('/path/to/miner.worker.js'); // Укажите правильный путь
    
    // Обработчик сообщений от worker
    miningWorker.onmessage = async (event) => {
        const { type, ...data } = event.data;
        
        switch (type) {
            case 'result':
                console.log(`Mined result: ${data.result} | Hash: ${data.hash} | Total hashes: ${data.hashCount}`);
                
                try {
                    const result = await submitMining(account, key, data.result);
                    console.log(`Submission result: ${result}`);
                    
                    // Получаем новое задание
                    const newJob = await getCurrentJob();
                    if (newJob && miningState.isMining) {
                        miningWorker.postMessage({
                            type: 'updateJob',
                            job: newJob.job,
                            difficulty: newJob.difficulty
                        });
                        miningState.currentJob = newJob.job;
                        miningState.difficulty = newJob.difficulty;
                    }
                } catch (error) {
                    console.error('Error submitting result:', error);
                    showMiningError('Ошибка отправки результата: ' + error.message);
                }
                break;
                
            case 'stats':
                miningState.hashCount = data.hashCount;
                const hashrateEl = document.getElementById('mining-hashrate');
                if (hashrateEl) {
                    hashrateEl.textContent = `${data.hashrate} H/s`;
                }
                break;
                
            case 'status':
                console.log('Worker status:', data.message);
                if (data.message === 'Mining stopped' && data.finalHashCount) {
                    console.log(`Total hashes mined: ${data.finalHashCount}`);
                }
                break;
                
            case 'error':
                console.error('Worker error:', data.message);
                showMiningError('Ошибка воркера: ' + data.message);
                stopMining();
                break;
        }
    };
    
    // Обработчик ошибок worker
    miningWorker.onerror = (error) => {
        console.error('Worker crashed:', error);
        showMiningError('Воркер упал: ' + error.message);
        stopMining();
    };
}

// Обновленная функция запуска/остановки майнинга
async function toggleMining(account, key) {
    if (miningState.isMining) {
        stopMining();
        return;
    }
    
    // Запуск майнинга
    miningState.isMining = true;
    miningState.startTime = Date.now();
    miningState.hashCount = 0;
    
    const miningButton = document.getElementById('mining-button');
    if (miningButton) {
        miningButton.style.backgroundColor = '#FF2B67';
        miningButton.classList.add('active');
    }
    
    // Сохраняем время начала
    setCookie('mining_start_time', miningState.startTime.toString());
    
    // Получаем первое задание
    const firstJob = await getCurrentJob();
    if (!firstJob) {
        alert('Не удалось получить задание для майнинга');
        miningState.isMining = false;
        return;
    }
    
    miningState.currentJob = firstJob.job;
    miningState.difficulty = firstJob.difficulty;
    
    // Настраиваем worker
    setupMiningWorker(account, key);
    
    // Запускаем майнинг в worker
    miningWorker.postMessage({
        type: 'start',
        job: firstJob.job,
        difficulty: firstJob.difficulty
    });
    
    // Обновляем время каждую секунду
    miningState.intervalId = setInterval(updateMiningTime, 1000);
    
    // Проверяем статистику каждую секунду
    workerStatsInterval = setInterval(() => {
        if (miningWorker) {
            miningWorker.postMessage({ type: 'getStats' });
        }
    }, 1000);
    
    // Проверяем изменение job каждые 3 секунды
    jobCheckInterval = setInterval(async () => {
        if (!miningState.isMining) return;
        
        try {
            const jobData = await getCurrentJob();
            if (!jobData) return;
            
            if (miningState.currentJob !== jobData.job) {
                console.log(`Job changed: ${miningState.currentJob} -> ${jobData.job}`);
                miningState.currentJob = jobData.job;
                miningState.difficulty = jobData.difficulty;
                
                if (miningWorker) {
                    miningWorker.postMessage({
                        type: 'updateJob',
                        job: jobData.job,
                        difficulty: jobData.difficulty
                    });
                }
            }
        } catch (error) {
            console.error('Error checking job change:', error);
        }
    }, 3000);
    
    console.log('Mining started with Web Worker');
}

// Функция остановки майнинга
function stopMining() {
    miningState.isMining = false;
    
    const miningButton = document.getElementById('mining-button');
    if (miningButton) {
        miningButton.textContent = 'Нажмите, чтобы запустить майнинг';
        miningButton.style.backgroundColor = '#925566';
        miningButton.classList.remove('active');
    }
    
    // Останавливаем worker
    if (miningWorker) {
        miningWorker.postMessage({ type: 'stop' });
        setTimeout(() => {
            miningWorker.terminate();
            miningWorker = null;
        }, 1000);
    }
    
    // Очищаем интервалы
    if (miningState.intervalId) {
        clearInterval(miningState.intervalId);
        miningState.intervalId = null;
    }
    
    if (workerStatsInterval) {
        clearInterval(workerStatsInterval);
        workerStatsInterval = null;
    }
    
    if (jobCheckInterval) {
        clearInterval(jobCheckInterval);
        jobCheckInterval = null;
    }
    
    // Удаляем время из куки
    setCookie('mining_start_time', '', -1);
    
    console.log('Mining stopped');
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', async function() {
    const account = getCookie('dcn_account');
    const key = getCookie('dcn_key');
    
    // Отображаем адрес
    const addressEl = document.getElementById('mining-address');
    if (addressEl && account) {
        const shortAddress = account.length > 20 
            ? account.substring(0, 10) + '...' + account.substring(account.length - 10)
            : account;
        addressEl.textContent = shortAddress;
        addressEl.setAttribute('title', account);
    } else if (addressEl) {
        addressEl.textContent = 'Аккаунт не найден';
    }
    
    // Загружаем баланс и домены
    if (account) {
        await updateBalance(account);
        await loadDomains(account);
    }
    
    // Проверяем, был ли майнинг запущен ранее
    const savedStartTime = getCookie('mining_start_time');
    if (savedStartTime) {
        const startTime = parseInt(savedStartTime);
        const now = Date.now();
        const elapsed = Math.floor((now - startTime) / 1000);
        
        // Если прошло меньше часа, можно показать что майнинг был запущен
        // Но не запускаем автоматически
    }
    
    // Обработчик кнопки майнинга
    const miningButton = document.getElementById('mining-button');
    if (miningButton && account && key) {
        miningButton.addEventListener('click', () => {
            toggleMining(account, key);
        });
    } else if (miningButton) {
        miningButton.disabled = true;
        miningButton.textContent = 'Необходимо создать аккаунт';
    }
});


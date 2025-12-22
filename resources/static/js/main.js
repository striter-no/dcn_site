// Функции для работы с куками
function setCookie(name, value, days = 365) {
    const expires = new Date();
    expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
    document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/`;
}

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

// Генерация случайного ключа (как в localminer.py)
function generateKey(length = 30) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// Регистрация нового аккаунта
async function registerAccount(key) {
    try {
        const response = await fetch('/api/acc/new', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ key: key })
        });
        
        const data = await response.json();
        
        if (data.status === 'ok') {
            return data.description; // Возвращает адрес аккаунта
        } else {
            console.error('Ошибка регистрации аккаунта:', data.description);
            return null;
        }
    } catch (error) {
        console.error('Ошибка подключения при регистрации:', error);
        return null;
    }
}

// Инициализация аккаунта (проверка куки или создание нового)
async function initializeAccount() {
    let account = getCookie('dcn_account');
    let key = getCookie('dcn_key');
    
    // Если аккаунт и ключ уже есть в куках, используем их
    if (account && key) {
        return { account, key };
    }
    
    // Генерируем новый ключ и регистрируем аккаунт
    key = generateKey(30);
    account = await registerAccount(key);
    
    if (account) {
        // Сохраняем в куки
        setCookie('dcn_account', account);
        setCookie('dcn_key', key);
        return { account, key };
    }
    
    return null;
}

// Копирование адреса в буфер обмена
function copyToClipboard(text) {
    // Проверяем, доступен ли современный API clipboard (работает в HTTPS и localhost)
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
            showCopyNotification('Адрес скопирован!');
        }).catch(err => {
            console.warn('Современный метод копирования не сработал, пробуем fallback:', err);
            fallbackCopy(text);
        });
    } else {
        // Если современный API недоступен, сразу используем fallback
        fallbackCopy(text);
    }
}

function fallbackCopy(text) {
    // Создаем скрытый textarea элемент
    const textarea = document.createElement('textarea');
    textarea.value = text;
    
    // Делаем элемент невидимым и добавляем в DOM
    textarea.style.position = 'fixed';
    textarea.style.top = '0';
    textarea.style.left = '0';
    textarea.style.width = '2px';
    textarea.style.height = '2px';
    textarea.style.padding = '0';
    textarea.style.border = 'none';
    textarea.style.outline = 'none';
    textarea.style.boxShadow = 'none';
    textarea.style.background = 'transparent';
    
    document.body.appendChild(textarea);
    
    try {
        // Выделяем текст и копируем
        textarea.focus();
        textarea.select();
        textarea.setSelectionRange(0, textarea.value.length);
        
        const successful = document.execCommand('copy');
        if (successful) {
            showCopyNotification('Адрес скопирован!');
        } else {
            throw new Error('document.execCommand("copy") вернул false');
        }
    } catch (err) {
        console.error('Ошибка копирования через fallback:', err);
        showCopyNotification('Не удалось скопировать текст', true);
    } finally {
        // Удаляем элемент в любом случае
        document.body.removeChild(textarea);
    }
}

function showCopyNotification(message, isError = false) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background-color: ${isError ? '#ff8a8a' : '#8affc9'};
        color: #000;
        padding: 10px 15px;
        border-radius: 10px;
        z-index: 10000;
        font-family: monospace;
        font-size: 12px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
        transition: opacity 0.3s ease;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    // Плавное исчезание
    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 300);
    }, isError ? 3000 : 2000);
}

// Обработчик поиска домена
document.addEventListener('DOMContentLoaded', function() {
    // Инициализация fitty после загрузки DOM
    fitty('.fittyc', {
        minSize: 24,      // минимальный размер шрифта (px)
        maxSize: 48,      // максимальный
        multiLine: true,  // важно: не переносить на новую строку
        observeWindowResize: true  // отслеживать изменение размера окна
    });

    fitty('.fittym', {
        minSize: 30,      // минимальный размер шрифта (px)
        maxSize: 48,      // максимальный
        multiLine: true,  // важно: не переносить на новую строку
        observeWindowResize: true  // отслеживать изменение размера окна
    });
    
    const searchBtn = document.getElementById('search-domain-btn');
    const searchInput = document.getElementById('domain-search-input');
    
    if (searchBtn && searchInput) {
        searchBtn.addEventListener('click', function() {
            const domain = searchInput.value.trim();
            if (domain) {
                window.location.href = `/domains.html?domain=${encodeURIComponent(domain)}`;
            }
        });
        
        // Также обрабатываем Enter в поле ввода
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                const domain = searchInput.value.trim();
                if (domain) {
                    window.location.href = `/domains.html?domain=${encodeURIComponent(domain)}`;
                }
            }
        });
    }

    const miningButton = document.getElementById('try-in-browser-btn');
    if (miningButton) {
        miningButton.addEventListener('click', () => {
            window.location.href = '/mining.html';
        });
    }
    
    // Загрузка статистики
    const statsDomains = document.getElementById('stats-domains');
    const statsHolders = document.getElementById('stats-holders');
    const statsTurnover = document.getElementById('stats-turnover');
    
    if (statsDomains && statsHolders && statsTurnover) {
        fetch('/api/stats')
            .then(response => response.json())
            .then(data => {
                statsDomains.textContent = data.domains || 0;
                statsHolders.textContent = data.holders || 0;
                statsTurnover.textContent = data.turnover || 0;
            })
            .catch(error => {
                console.error('Ошибка загрузки статистики:', error);
            });
    }
    
    // Обработчик кнопки "Зарегистрировать домен"
    const registerDomainBtn = document.getElementById('register-domain-btn');
    if (registerDomainBtn) {
        registerDomainBtn.addEventListener('click', function() {
            window.location.href = '/pre-register.html';
        });
    }
    
    // Инициализация аккаунта и отображение адреса
    const walletAddressEl = document.getElementById('wallet-address');
    const copyAddressBtn = document.getElementById('copy-address-btn');
    
    if (walletAddressEl) {
        initializeAccount().then(accountData => {
            if (accountData && accountData.account) {
                walletAddressEl.textContent = accountData.account;
                walletAddressEl.setAttribute('title', accountData.account);
                
                // Обработчик кнопки копирования
                if (copyAddressBtn) {
                    copyAddressBtn.addEventListener('click', function() {
                        copyToClipboard(accountData.account);
                    });
                }
            } else {
                walletAddressEl.textContent = 'Ошибка загрузки адреса';
            }
        });
    }
});
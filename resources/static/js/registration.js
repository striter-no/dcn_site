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

// Данные аккаунта из куки
let account = getCookie('dcn_account') || "";
let key = getCookie('dcn_key') || "";

// Текущее количество лет аренды
let years = 1;
const NETWORK_FEE = 1; // Комиссия сети

// Получение домена из URL
function getDomainFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('domain') || 'domain.dcn';
}

// Функция для показа уведомления об ошибке
function showError(message) {
    // Создаем элемент уведомления
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background-color:rgb(255, 55, 71);
        color: #fff;
        padding: 15px 20px;
        border-radius: 10px;
        z-index: 10000;
        font-family: monospace;
        font-size: 12px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
        max-width: 400px;
        opacity: 0.9;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Удаляем уведомление через 5 секунд
    setTimeout(() => {
        notification.remove();
    }, 5000);
}

// Функция для показа успешного уведомления
function showSuccess(message) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background-color: #8affc9;
        color: #000;
        padding: 15px 20px;
        border-radius: 10px;
        z-index: 10000;
        font-family: monospace;
        font-size: 16px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
        max-width: 400px;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 5000);
}

// Обновление текста с количеством лет
function updateYearsDisplay() {
    const yearsDisplay = document.getElementById('years-display');
    const registrationText = document.getElementById('registration-text');
    const registrationLabel = document.getElementById('registration-label');
    
    if (yearsDisplay) {
        yearsDisplay.textContent = years + (years === 1 ? ' год' : years < 5 ? ' года' : ' лет');
    }
    
    if (registrationText) {
        registrationText.textContent = `регистрация на ${years} ${years === 1 ? 'год' : years < 5 ? 'года' : 'лет'}`;
    }
    
    if (registrationLabel) {
        registrationLabel.textContent = `Регистрация на ${years} ${years === 1 ? 'год' : years < 5 ? 'года' : 'лет'}`;
    }
    
    // Обновляем стоимость
    updateCost();
}

// Получение стоимости домена через API
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
        } else {
            showError('Ошибка получения стоимости домена: ' + (data.description || 'Неизвестная ошибка'));
            return 0;
        }
    } catch (error) {
        console.error('Ошибка запроса стоимости:', error);
        showError('Ошибка подключения к серверу');
        return 0;
    }
}

// Обновление стоимости регистрации
async function updateCost() {
    const domain = getDomainFromURL();
    const baseCost = await getDomainCost(domain);
    const totalCost = baseCost * years;
    
    const registrationCostEl = document.getElementById('registration-cost');
    const totalCostEl = document.getElementById('total-cost');
    
    if (registrationCostEl) {
        registrationCostEl.textContent = totalCost.toFixed(2) + ' DCN';
    }
    
    if (totalCostEl) {
        const total = totalCost + NETWORK_FEE;
        totalCostEl.textContent = total.toFixed(2) + ' DCN';
    }
}

// Регистрация домена
async function registerDomain() {
    const domain = getDomainFromURL();
    const ipInput = document.getElementById('ip-input');
    const ip = ipInput ? ipInput.value.trim() : '';
    
    // Проверка обязательного поля IP
    if (!ip) {
        showError('Пожалуйста, введите IP адрес для домена');
        if (ipInput) {
            ipInput.focus();
        }
        return;
    }
    
    // Проверка наличия account и key
    if (!account || !key) {
        showError('Не указаны данные аккаунта (account и key)');
        return;
    }
    
    // Показываем индикатор загрузки
    const regButton = document.getElementById('reg-button');
    const originalText = regButton ? regButton.textContent : '';
    if (regButton) {
        regButton.disabled = true;
        regButton.textContent = 'Регистрация...';
    }
    
    try {
        const response = await fetch('/api/trnsc/new_domain', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                account: account,
                key: key,
                domain: domain,
                ip: ip
            })
        });
        
        const data = await response.json();
        
        if (data.status === 'ok') {
            showSuccess('Домен успешно зарегистрирован!');
            // Можно перенаправить на страницу домена
            setTimeout(() => {
                window.location.href = `/domains.html?domain=${encodeURIComponent(domain)}`;
            }, 1500);
        } else {
            showError('Ошибка регистрации: ' + (data.description || 'Неизвестная ошибка'));
        }
    } catch (error) {
        console.error('Ошибка регистрации домена:', error);
        showError('Ошибка подключения к серверу');
    } finally {
        // Восстанавливаем кнопку
        if (regButton) {
            regButton.disabled = false;
            regButton.textContent = originalText;
        }
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    // Получаем домен из URL и обновляем заголовок
    const domain = getDomainFromURL();
    const domainTitle = document.getElementById('domain-title');
    if (domainTitle) {
        domainTitle.textContent = domain + ' | Регистрация';
    }
    
    // Обработчики для кнопок увеличения/уменьшения лет
    const decreaseBtn = document.getElementById('decrease-years-btn');
    const increaseBtn = document.getElementById('increase-years-btn');
    
    if (decreaseBtn) {
        decreaseBtn.addEventListener('click', function() {
            if (years > 1) {
                years--;
                updateYearsDisplay();
            }
        });
    }
    
    if (increaseBtn) {
        increaseBtn.addEventListener('click', function() {
            years++;
            updateYearsDisplay();
        });
    }
    
    // Обработчик для кнопки регистрации
    const regButton = document.getElementById('reg-button');
    if (regButton) {
        regButton.addEventListener('click', registerDomain);
    }
    
    // Обработчик Enter в поле IP
    const ipInput = document.getElementById('ip-input');
    if (ipInput) {
        ipInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                registerDomain();
            }
        });
    }
    
    // Инициализация отображения
    updateYearsDisplay();
});


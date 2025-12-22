// Получение домена из URL параметров
document.addEventListener('DOMContentLoaded', function() {
    const urlParams = new URLSearchParams(window.location.search);
    const domain = urlParams.get('domain');
    
    const domainNameEl = document.getElementById('domain-name');
    const domainOwnerEl = document.getElementById('domain-owner');
    const domainCostEl = document.getElementById('domain-cost');
    
    if (domain) {
        // Обновляем название домена
        if (domainNameEl) {
            domainNameEl.textContent = domain;
        } else {
            domainNameEl.textContent = '-';
        }
        
        // Загружаем стоимость домена
        fetch('/api/dmn/cost', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ domain: domain })
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'ok' && domainCostEl) {
                domainCostEl.textContent = data.description + ' dcn';
            } else if (domainCostEl) {
                domainCostEl.textContent = 'Ошибка загрузки';
            }
        })
        .catch(error => {
            console.error('Ошибка загрузки стоимости:', error);
            if (domainCostEl) {
                domainCostEl.textContent = 'Ошибка загрузки';
            }
        });
        
        // Загружаем владельца домена
        fetch('/api/dmn/owner', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ domain: domain })
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'ok' && domainOwnerEl) {
                const owner = data.description;
                if (owner === 'noone') {
                    domainOwnerEl.textContent = 'Не зарегистрирован';
                } else {
                    // Обрезаем адрес для отображения
                    const shortOwner = owner.length > 20 
                        ? owner.substring(0, 10) + '...' + owner.substring(owner.length - 10)
                        : owner;
                    domainOwnerEl.textContent = shortOwner;
                }
            } else if (domainOwnerEl) {
                domainOwnerEl.textContent = 'Ошибка загрузки';
            }
        })
        .catch(error => {
            console.error('Ошибка загрузки владельца:', error);
            if (domainOwnerEl) {
                domainOwnerEl.textContent = 'Ошибка загрузки';
            }
        });
    }
});
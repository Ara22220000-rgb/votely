#!/bin/bash
# Скачать бесплатную GeoIP базу IP2Location Lite
# Регистрация требуется на https://www.ip2location.com/free

DB_DIR="$(dirname "$0")/../data"
mkdir -p "$DB_DIR"

# Если есть токен IP2Location (переменная окружения)
if [ -n "$IP2LOCATION_TOKEN" ]; then
    echo "Скачивание GeoIP базы с токеном..."
    curl -L "https://www.ip2location.com/download/?token=${IP2LOCATION_TOKEN}&file=Bin-IP2Location-Lite-DB1" -o "$DB_DIR/ip2location-lite.bin"
else
    echo "IP2LOCATION_TOKEN не установлен. Используем базовую GeoIP базу..."
    
    # Альтернатива: MaxMind GeoLite2 (требуется регистрация)
    # Скачивание через wget/curl с аккаунтом
    
    # Для тестов создадим пустой файл
    touch "$DB_DIR/ip2location-lite.bin"
    echo "Пустой файл создан. Для полноценной работы:"
    echo "1. Зарегистрируйтесь на https://www.ip2location.com/free"
    echo "2. Получите токен"
    echo "3. Установите переменную окружения IP2LOCATION_TOKEN"
    echo "4. Запустите этот скрипт снова"
fi

echo "Готово! База сохранена в $DB_DIR/ip2location-lite.bin"

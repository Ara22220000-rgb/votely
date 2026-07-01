FROM php:8.2-apache

# Установка зависимостей для PostgreSQL
RUN apt-get update && apt-get install -y libpq-dev && \
    docker-php-ext-install pdo pdo_pgsql pgsql && \
    rm -rf /var/lib/apt/lists/*


# Включение mod_rewrite для Apache
RUN a2enmod rewrite

# Копирование файлов проекта
COPY web/ /var/www/html/
COPY migrations/ /app/migrations/

# Настройка прав
RUN chown -R www-data:www-data /var/www/html

# Открытие порта
EXPOSE 80

# Запуск Apache
CMD ["apache2-foreground"]

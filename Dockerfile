FROM php:8.2-apache

# Установка зависимостей для PostgreSQL
RUN apt-get update && apt-get install -y libpq-dev && \
    docker-php-ext-install pdo pdo_pgsql pgsql && \
    apt-mark manual libpq5 && \
    rm -rf /var/lib/apt/lists/*


# Включение mod_rewrite и security headers для Apache
RUN a2enmod rewrite headers proxy proxy_http

RUN { \
    echo "expose_php=Off"; \
    echo "session.cookie_httponly=1"; \
    echo "session.cookie_samesite=Strict"; \
} > /usr/local/etc/php/conf.d/votely-security.ini

# Копирование файлов проекта
COPY web/ /var/www/html/
COPY docker/php/apache.conf /etc/apache2/sites-available/000-default.conf
COPY migrations/ /app/migrations/

# Настройка прав
RUN chown -R www-data:www-data /var/www/html

# Открытие порта
EXPOSE 80

# Запуск Apache
CMD ["apache2-foreground"]

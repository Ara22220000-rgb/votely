FROM php:8.2-apache

# Устанавливаем зависимости для PostgreSQL
RUN apt-get update && apt-get install -y libpq-dev \
    && docker-php-ext-install pdo pdo_pgsql \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Включаем mod_rewrite для Apache
RUN a2enmod rewrite

# Настраиваем Apache
RUN sed -i 's!/var/www/html!/var/www/html!g' /etc/apache2/sites-available/000-default.conf
COPY docker/php/apache.conf /etc/apache2/sites-available/000-default.conf

# Устанавливаем права
RUN chown -R www-data:www-data /var/www/html

EXPOSE 80

CMD ["apache2-foreground"]

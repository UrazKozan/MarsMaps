FROM php:8.3-cli

WORKDIR /app
COPY . .

# Render supplies PORT at runtime. The built-in PHP server is sufficient for
# this short-lived, read-only hackathon demo.
CMD ["sh", "-c", "php -S 0.0.0.0:${PORT:-10000} -t public"]

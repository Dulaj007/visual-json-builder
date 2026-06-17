"""
settings.py — Django project configuration for JSON Builder
===========================================================

This is a minimal settings file suitable for local development.
It contains only the settings that differ from Django defaults plus
those required to make the app work.

NOT safe for production:
  - DEBUG = True exposes full tracebacks to the browser.
  - SECRET_KEY is a placeholder; replace it with a random value
    (e.g. via django.core.management.utils.get_random_secret_key())
    and load it from an environment variable before deploying.
  - ALLOWED_HOSTS = ['*'] accepts requests from any host; narrow this
    to the actual domain(s) in production.
  - No database is configured because this app has no models —
    all state lives in the browser's localStorage and is exported
    directly to a JSON file by the client-side JavaScript.
"""

from pathlib import Path

# BASE_DIR resolves to the project root (the directory containing manage.py).
# All other path references (e.g. DIRS in TEMPLATES) should be built
# relative to this so the project works regardless of where it is cloned.
BASE_DIR = Path(__file__).resolve().parent.parent

# ── Security ──────────────────────────────────────────────────────────────────
# SECURITY WARNING: keep the real secret key out of source control.
SECRET_KEY = 'django-insecure-jsoncov-dev-key-do-not-use-in-production'

# SECURITY WARNING: never run with DEBUG=True in a production environment.
DEBUG = True

# In development any hostname is accepted; restrict to your domain in prod.
ALLOWED_HOSTS = ['*']

# ── Installed apps ────────────────────────────────────────────────────────────
# Only two apps are needed:
#   django.contrib.staticfiles — serves files from each app's /static/ folder
#                                when DEBUG=True (no web server required locally)
#   builder                   — the single app that contains the view, template,
#                                and client-side assets for the JSON Builder UI
INSTALLED_APPS = [
    'django.contrib.staticfiles',
    'builder',
]

# ── Middleware ────────────────────────────────────────────────────────────────
# Minimal middleware stack — only the essentials:
#   SecurityMiddleware  — adds security headers (HSTS, X-Content-Type, etc.)
#   CommonMiddleware    — enforces APPEND_SLASH and handles ETags
# Session, auth, CSRF, and message middleware are omitted because this app
# has no forms that POST to Django and no user accounts.
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.middleware.common.CommonMiddleware',
]

# The root URL configuration module.  All URLs are delegated to builder.urls.
ROOT_URLCONF = 'jsoncov.urls'

# ── Templates ─────────────────────────────────────────────────────────────────
# APP_DIRS=True tells Django to look for templates inside each installed app's
# templates/ subdirectory automatically, so builder/templates/builder/index.html
# is discoverable as 'builder/index.html' without listing it in DIRS.
TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                # Adds the current HttpRequest as `request` in every template
                # context — required for {% static %} to work correctly.
                'django.template.context_processors.request',
            ],
        },
    },
]

# ── Static files ──────────────────────────────────────────────────────────────
# STATIC_URL is the URL prefix for all static assets.
# With DEBUG=True and django.contrib.staticfiles installed, Django serves
# files from each app's /static/ directory automatically — no STATIC_ROOT
# or collectstatic step needed for local development.
STATIC_URL = '/static/'

# ── Miscellaneous ─────────────────────────────────────────────────────────────
# Suppresses the system check warning about auto-created primary key fields.
# BigAutoField (64-bit integer) is the recommended default in modern Django.
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

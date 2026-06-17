"""
wsgi.py — WSGI entry point for the JSON Builder project
=========================================================

WSGI (Web Server Gateway Interface) is the standard interface between
Python web applications and web servers such as Gunicorn or uWSGI.

This module exposes a module-level callable named `application` that a
WSGI server picks up when the app is deployed. Django's development server
(manage.py runserver) also uses this module internally.

In production you would point your WSGI server at this file, for example:
    gunicorn jsoncov.wsgi:application

The DJANGO_SETTINGS_MODULE environment variable is set here as a fallback
so the module works when imported directly. In practice, manage.py and most
deployment configurations set this variable before importing wsgi.py.
"""

import os
from django.core.wsgi import get_wsgi_application

# Fallback: use the development settings if the environment variable is absent.
# Production deployments should set DJANGO_SETTINGS_MODULE explicitly rather
# than relying on this default.
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'jsoncov.settings')

# `application` is the WSGI callable.  The web server calls it for every HTTP
# request and passes it the WSGI environ dict + the start_response callable.
application = get_wsgi_application()

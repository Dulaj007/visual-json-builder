"""
apps.py — App configuration for the builder app
=================================================

Django discovers this AppConfig subclass automatically when 'builder'
appears in INSTALLED_APPS (Django 3.2+ uses the default_app_config
discovery mechanism; explicit AppConfig classes are the recommended
approach for all new apps).

This configuration class sets two required attributes:
    default_auto_field — the field type used for auto-created primary keys
                         on any models added in the future. BigAutoField is
                         a 64-bit integer, matching the project-level default
                         set in settings.py to suppress system check warnings.
    name               — the Python dotted path to the app, as it appears
                         in INSTALLED_APPS.  Must match exactly.

No ready() method is defined because the app requires no startup
initialisation (no signal connections, no patching of other apps, etc.).
"""

from django.apps import AppConfig


class BuilderConfig(AppConfig):
    """Configuration class for the 'builder' app."""

    # Use 64-bit integer primary keys for any future models.
    default_auto_field = 'django.db.models.BigAutoField'

    # The fully-qualified Python package name of this app.
    name = 'builder'

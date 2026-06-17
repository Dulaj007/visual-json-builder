"""
urls.py — Project-level URL configuration
==========================================

This is the root URL configuration referenced by ROOT_URLCONF in settings.py.

The entire URL space is delegated to builder.urls via include(). No URLs
are defined directly at the project level because this app has only one
page. If additional apps (e.g. an API or an admin) were added in the future,
their url patterns would be listed here alongside the builder include.

URL pattern:
    ''  →  builder.urls  →  builder.views.index  (the JSON Builder page)
"""

from django.urls import path, include

urlpatterns = [
    # Delegate all URLs to the builder app's URL module.
    # The empty string prefix means builder.urls handles everything from '/'.
    path('', include('builder.urls')),
]

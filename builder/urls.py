"""
urls.py — URL configuration for the builder app
=================================================

Defines the URL patterns handled by the builder app.  This module is
included by the project-level jsoncov/urls.py under the empty-string
prefix, so every pattern here is relative to the site root '/'.

Currently a single pattern maps the root URL to the index view, making
'http://localhost:8000/' serve the JSON Builder page.

If the app grows to include additional pages or an API, new path()
entries would be added to urlpatterns here.  For example:
    path('api/export/', views.export_api, name='export_api'),
"""

from django.urls import path
from . import views

# app_name is used as a namespace prefix when reversing URLs with {% url %}
# or reverse() — e.g. {% url 'builder:index' %}.
app_name = 'builder'

urlpatterns = [
    # Root URL → index view → renders the JSON Builder single-page app.
    # name='index' allows templates and other views to reference this URL
    # symbolically via {% url 'builder:index' %} instead of hard-coding '/'.
    path('', views.index, name='index'),
]

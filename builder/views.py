"""
views.py — HTTP request handlers for the builder app
======================================================

This file contains all Django view functions for the builder app.
Currently there is only one view because the entire application is a
single-page interface — Django's only job is to serve the HTML shell;
everything else (rendering, state management, export) is handled by
client-side JavaScript in app.js.

If future requirements introduce server-side functionality (e.g. saving
schemas to a database, a REST API for import/export, or user accounts)
those views would be added here alongside index().
"""

from django.shortcuts import render


def index(request):
    """
    Render the JSON Builder single-page application shell.

    Accepts any HTTP method (GET in practice) and returns the fully
    rendered index.html template.  No context variables are passed
    because the template has no dynamic server-side content — the
    {% static %} template tag is the only thing that requires Django's
    template engine at all.

    Args:
        request (HttpRequest): The incoming HTTP request object.

    Returns:
        HttpResponse: The rendered HTML page with a 200 status code.
    """
    return render(request, 'builder/index.html')

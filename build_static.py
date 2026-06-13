"""Render the Flask site to static HTML for Vercel deployment.

The eye-navigation feature is fully client-side, so the pages only need
to be served as static files over HTTPS. This renders each route through
Flask and writes hyphenated filenames so Vercel's cleanUrls maps
/physical-health -> physical-health.html, etc.
"""
import os
import shutil
import app as flask_app

ROUTES = {
    "/": "index.html",
    "/activities": "activities.html",
    "/physical-health": "physical-health.html",
    "/mental-health": "mental-health.html",
    "/social-connection": "social-connection.html",
}

DIST = os.path.join(os.path.dirname(__file__), "dist")


def build():
    if os.path.exists(DIST):
        shutil.rmtree(DIST)
    os.makedirs(DIST)

    client = flask_app.app.test_client()
    for route, filename in ROUTES.items():
        resp = client.get(route)
        assert resp.status_code == 200, (route, resp.status_code)
        with open(os.path.join(DIST, filename), "wb") as fh:
            fh.write(resp.data)
        print("rendered", route, "->", filename)

    shutil.copytree("static", os.path.join(DIST, "static"))
    print("copied static/ ->", os.path.join(DIST, "static"))


if __name__ == "__main__":
    build()

# Harvey Chowdhury — Portfolio

A dark, responsive design portfolio featuring GymLog, a workout logging prototype.

## Preview

Open `index.html` in a browser. No installation or build step is required.

For a local web server:

```sh
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## Pages

- `index.html` — portfolio homepage
- `projects/gymlog/index.html` — GymLog case study
- `projects/gymlog/prototype.html` — interactive workout prototype
- `assets/` — interface illustrations and favicon
- `style.css` and `script.js` — portfolio styles and interactions

## GitHub Pages

Upload this folder’s contents to the root of a GitHub repository. In the repository’s **Settings → Pages**, select **Deploy from a branch**, the `main` branch, and `/ (root)`, then save. All internal links are relative, so the site works at either a user site or project site URL.

For a personal site, use a repository named `Rayhanson-Git.github.io`.

## Experience

Responsive layouts, pointer-following highlights, subtle floating motion, an optional motion toggle, keyboard-accessible screen previews, and reduced-motion support. The site uses system fonts and has no external dependencies, analytics, or trackers.

The GymLog prototype uses sample workout records and keeps changes in memory for the current page session. The case-study images are static interface views; the prototype provides the working interactions.

# Harvey Chowdhury — Portfolio

A dark, responsive design portfolio featuring GymLog, a workout logging prototype, Studio Apartment Evening, an audio storytelling project, and LeaveBy, a live workout transition planner.

<p>
  <a href="https://rayhanson-git.github.io/" aria-label="View Harvey Chowdhury's live portfolio">
    <img src="assets/live-portfolio-button.svg" alt="View Live Portfolio" width="340" height="84" />
  </a>
</p>

**Live site:** https://rayhanson-git.github.io/

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
- `projects/studio-apartment-evening/index.html` — sound storytelling project, audio player, process, session screenshot, and recording credits
- `projects/leaveby/index.html` — LeaveBy overview, form and result previews, and a Visit LeaveBy button
- `projects/leaveby/media/` — development screenshots of the plan form and calculated result
- `projects/studio-apartment-evening/media/` — finished MP3, waveform, and Audition screenshot
- `assets/` — interface illustrations and favicon
- `style.css` and `script.js` — portfolio styles and interactions

## GitHub Pages

Upload this folder’s contents to the root of a GitHub repository. In the repository’s **Settings → Pages**, select **Deploy from a branch**, the `main` branch, and `/ (root)`, then save. All internal links are relative, so the site works at either a user site or project site URL.

For a personal site, use a repository named `Rayhanson-Git.github.io`.

## Experience

Responsive layouts, pointer-following highlights, subtle floating motion, an optional motion toggle, keyboard-accessible screen previews, and reduced-motion support. The site uses system fonts and has no external dependencies, analytics, or trackers.

The GymLog prototype uses sample workout records and keeps changes in memory for the current page session. The case-study images are static interface views; the prototype provides the working interactions.


LeaveBy works backward from one upcoming commitment to calculate when to stop a workout, leave, and arrive. Its live-app buttons open the deployed app on the custom domain. The previews are development screenshots; the working app also follows the device’s light or dark appearance.

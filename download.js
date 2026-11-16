// "Download for Mac" buttons. Each one links to its project's latest release page, which works with no script and when
// GitHub can't be reached. Once the latest release is known, the button points straight at that release's disk image.
(function (root) {
  'use strict';

  // The disk image of a GitHub release, or null. Only a .dmg served from this repository's own release downloads counts.
  function latestDmg(release, repo) {
    if (!release || !Array.isArray(release.assets) || !/^[\w.-]+\/[\w.-]+$/.test(repo)) return null;
    const base = `https://github.com/${repo}/releases/download/`;
    const asset = release.assets.find((a) => a && typeof a.name === 'string' && /\.dmg$/i.test(a.name)
      && typeof a.browser_download_url === 'string' && a.browser_download_url.startsWith(base));
    if (!asset) return null;
    return { url: asset.browser_download_url, version: String(release.tag_name || '').replace(/^v/, ''), size: Number(asset.size) || 0 };
  }

  if (typeof module === 'object' && module.exports) module.exports = { latestDmg };
  if (typeof document === 'undefined') return;

  const buttons = [...document.querySelectorAll('a[data-latest-dmg]')];
  const repos = [...new Set(buttons.map((b) => b.dataset.latestDmg))];
  repos.forEach((repo) => {
    if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) return;
    fetch(`https://api.github.com/repos/${repo}/releases/latest`, { headers: { Accept: 'application/vnd.github+json' } })
      .then((r) => (r.ok ? r.json() : null))
      .then((release) => {
        const dmg = latestDmg(release, repo);
        if (!dmg) return; // the release page link stays
        buttons.filter((b) => b.dataset.latestDmg === repo).forEach((b) => { b.href = dmg.url; });
        const mb = dmg.size ? `, ${(dmg.size / 1048576).toFixed(1)} MB` : '';
        document.querySelectorAll(`[data-latest-dmg-version="${repo}"]`).forEach((el) => { el.textContent = `Version ${dmg.version}${mb}`; });
      })
      .catch(() => {}); // offline or rate-limited: the release page link stays
  });
})(typeof window === 'undefined' ? globalThis : window);

import fs from "node:fs";
import path from "node:path";

// Fix HTML: convert absolute paths to relative so the site works at any subpath.
for (const p of fs
	.readdirSync("dist")
	.filter((file) => file.endsWith(".html"))
	.map((file) => `dist/${file}`)) {
	const html = fs.readFileSync(p, "utf8");
	fs.writeFileSync(
		p,
		html
			.replace(/href="\/(?!\/)/g, 'href="./')
			.replace(/src="\/(?!\/)/g, 'src="./'),
	);
}

// Vite content-hashes every shared JS chunk, including imports between chunks.
// Keep entry JS and the combined CSS stable for Drupal embeds; bump their ?v= on deploy.

// Fix CSS: convert absolute asset URLs to relative so they resolve correctly at subpaths
// (e.g. url('/assets/img/x.png') -> url('../assets/img/x.png') since CSS lives in dist/css/).
for (const p of fs.readdirSync("dist/css").map((f) => `dist/css/${f}`)) {
	const css = fs.readFileSync(p, "utf8");
	const fixed = css.replace(/url\(['"]?\/assets\//g, (match) =>
		match.replace("/assets/", "../assets/"),
	);
	fs.writeFileSync(p, fixed);
}

// A plain branded SVG, no image library needed — it renders fine as an <img> thumbnail
// anywhere Drupal's app picker shows one, and keeps the build dependency-free.
const buildPlaceholderThumbnail = (title) => {
	const safeTitle = String(title ?? "")
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;");
	return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#004987"/>
  <rect width="1200" height="12" fill="#009edb"/>
  <text x="60" y="340" fill="#ffffff" font-family="Arial, sans-serif" font-size="56" font-weight="bold">${safeTitle}</text>
  <text x="60" y="390" fill="#ffffff" font-family="Arial, sans-serif" font-size="24">UNCTAD</text>
</svg>
`;
};

// Bump the Drupal app manifest version on every build, and make sure every manifest has a
// thumbnail. One manifest per embedded page — public/assets/drupal-app.json for a single-page
// project, one additional manifest per extra page for a multi-page one. Drupal scans every
// .json file directly in this folder for the manifest shape (a "schema" key); the filename
// doesn't matter to it, so this detects manifests by content rather than by name too. The
// source copy in public/ keeps the version counter; the copy in dist/ (already copied by Vite)
// gets the same value.
const manifestDir = "public/assets";
const manifestNames = fs
	.readdirSync(manifestDir, { withFileTypes: true })
	.filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
	.map((entry) => entry.name)
	.filter((name) => {
		try {
			return (
				"schema" in
				JSON.parse(fs.readFileSync(`${manifestDir}/${name}`, "utf8"))
			);
		} catch {
			return false;
		}
	});

for (const name of manifestNames) {
	const manifestSource = `${manifestDir}/${name}`;
	const manifest = JSON.parse(fs.readFileSync(manifestSource, "utf8"));
	manifest.version = String((Number.parseInt(manifest.version, 10) || 0) + 1);

	// If nobody has dropped in a real thumbnail yet, generate a placeholder so the Drupal app
	// picker never shows a broken image. Once a real file exists at the declared path, this
	// stops touching it.
	if (manifest.thumbnail) {
		const declaredPath = path.join(manifestDir, manifest.thumbnail);
		if (!fs.existsSync(declaredPath)) {
			const svgRelative = manifest.thumbnail.replace(/\.(png|jpe?g)$/i, ".svg");
			const svgPath = path.join(manifestDir, svgRelative);
			fs.mkdirSync(path.dirname(svgPath), { recursive: true });
			fs.writeFileSync(svgPath, buildPlaceholderThumbnail(manifest.title));
			manifest.thumbnail = svgRelative;
			fs.mkdirSync(path.dirname(`dist/assets/${svgRelative}`), {
				recursive: true,
			});
			fs.copyFileSync(svgPath, `dist/assets/${svgRelative}`);
		}
	}

	const manifestJson = `${JSON.stringify(manifest, null, 2)}\n`;
	fs.writeFileSync(manifestSource, manifestJson);
	fs.writeFileSync(`dist/assets/${name}`, manifestJson);
}

const path = require("path");

/**
 * Resolves @import "tw-animate-css" to the package's CSS file path
 * (bypasses package exports "style" condition so the bare specifier works).
 */
function postcssResolveTwAnimateCss() {
  return {
    postcssPlugin: "resolve-tw-animate-css",
    Once(root) {
      root.walkAtRules("import", (atRule) => {
        const params = atRule.params.trim();
        const match = params.match(/^["']tw-animate-css["']\s*;?$/);
        if (match) {
          const resolved = path.resolve(
            __dirname,
            "node_modules/tw-animate-css/dist/tw-animate.css"
          );
          atRule.params = `"${resolved.replace(/\\/g, "/")}"`;
        }
      });
    },
  };
}
postcssResolveTwAnimateCss.postcss = true;

module.exports = postcssResolveTwAnimateCss;

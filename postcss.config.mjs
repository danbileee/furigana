import path from "path";

const resolveTwAnimatePath = path.resolve(
  process.cwd(),
  "postcss-resolve-tw-animate.cjs"
);

const config = {
  plugins: {
    [resolveTwAnimatePath]: {},
    "@tailwindcss/postcss": {},
  },
};

export default config;

import createCache from "@emotion/cache";

export default function createEmotionCache() {
  return createCache({
    key: "css",
    // Moves MUI styles to the top of the <head> so they're loaded first. It
    // allows for easy override of MUI styles with other styling solutions,
    // like CSS modules.
    prepend: true,
  });
}

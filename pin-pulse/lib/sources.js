// Pinterest "ideas" pages the app reads. Each page lists Pinterest's own
// most popular pins for that topic, so no search terms are involved.
// tab: "clothes" or "visuals"; cat: the visuals category shown as a filter.
export const CATEGORIES = {
  knitwear: "Плетива",
  patterns: "Шарки и мотиви",
  illustration: "Илюстрации и графики",
  palettes: "Цветови палитри",
  nature: "Природа и текстури",
  art: "Картини и рисунки",
};

const I = "https://www.pinterest.com/ideas/";

export const DEFAULT_SOURCES = [
  // ---- clothes (knitwear only) ----
  { tab: "clothes", cat: "knitwear", name: "Knitwear", url: I + "knitwear/940442032365/" },
  { tab: "clothes", cat: "knitwear", name: "Knit Fashion", url: I + "knit-fashion/940509791485/" },
  { tab: "clothes", cat: "knitwear", name: "Winter Knitwear", url: I + "winter-knitwear/958229927690/" },
  { tab: "clothes", cat: "knitwear", name: "Knit Trends", url: I + "knit-trends/917080757981/" },
  { tab: "clothes", cat: "knitwear", name: "Sweater Outfits", url: I + "sweater-outfits/910208557091/" },
  { tab: "clothes", cat: "knitwear", name: "Cardigan Outfits", url: I + "cardigan-outfits/903640174863/" },
  { tab: "clothes", cat: "knitwear", name: "Cable Knit", url: I + "cable-knit/900952993506/" },
  { tab: "clothes", cat: "knitwear", name: "Colorwork Sweaters", url: I + "colorwork-sweaters/932592806592/" },
  // ---- visuals for design ----
  { tab: "visuals", cat: "patterns", name: "Fair Isle Pattern", url: I + "fair-isle-pattern/950687838503/" },
  { tab: "visuals", cat: "patterns", name: "Knitting Charts", url: I + "knitting-charts/912566368192/" },
  { tab: "visuals", cat: "patterns", name: "Folk Art Designs", url: I + "folk-art-designs/920593336625/" },
  { tab: "visuals", cat: "illustration", name: "Illustration Art", url: I + "illustration-art/946168700358/" },
  { tab: "visuals", cat: "illustration", name: "Graphic Art", url: I + "graphic-art/899673152664/" },
  { tab: "visuals", cat: "illustration", name: "Print Design Art", url: I + "print-design-art/960159933943/" },
  { tab: "visuals", cat: "palettes", name: "Color Palettes", url: I + "color-palettes/911967060434/" },
  { tab: "visuals", cat: "palettes", name: "Color Palette Inspiration", url: I + "color-palette-inspiration/901858651107/" },
  { tab: "visuals", cat: "palettes", name: "Earthy Color Palette", url: I + "earthy-color-palette/939112140299/" },
  { tab: "visuals", cat: "nature", name: "Nature Aesthetic", url: I + "nature-aesthetic/904736726034/" },
  { tab: "visuals", cat: "nature", name: "Natures Pattern", url: I + "natures-pattern/939552182521/" },
  { tab: "visuals", cat: "nature", name: "Texture Element", url: I + "texture-element/923598192160/" },
  { tab: "visuals", cat: "art", name: "Landscapes Art", url: I + "landscapes-art/937523191739/" },
  { tab: "visuals", cat: "art", name: "Inspirational Artwork", url: I + "inspirational-artwork/939644407246/" },
  { tab: "visuals", cat: "art", name: "Folk Art", url: I + "folk-art/920937705477/" },
].map(s => ({ ...s, on: true }));

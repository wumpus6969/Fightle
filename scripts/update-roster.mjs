import fs from "node:fs/promises";
import path from "node:path";
import * as cheerio from "cheerio";
import countries from "i18n-iso-countries";
import en from "i18n-iso-countries/langs/en.json" with { type: "json" };

countries.registerLocale(en);

const ROOT = path.resolve(import.meta.dirname, "..");
const UFC = "https://www.ufc.com";
const CURRENT_ROSTER = "https://en.wikipedia.org/wiki/List_of_current_UFC_fighters";
const FALLBACK_IMAGE = "assets/fighter-avatar.png";
const HEADERS = {
  "user-agent": "Fightle roster updater/1.0 (+https://github.com/wumpus6969/Fightle)",
  accept: "text/html,application/xhtml+xml",
};

const divisionCodes = new Map([
  ["women's strawweight", "WSW"],
  ["women's flyweight", "WFLW"],
  ["women's bantamweight", "WBW"],
  ["women's featherweight", "WFW"],
  ["strawweight", "SW"],
  ["flyweight", "FLW"],
  ["bantamweight", "BW"],
  ["featherweight", "FW"],
  ["lightweight", "LW"],
  ["welterweight", "WW"],
  ["middleweight", "MW"],
  ["light heavyweight", "LHW"],
  ["heavyweight", "HW"],
]);

const specialCountries = new Map([
  ["northern ireland", ["Northern Ireland", "gb-nir"]],
  ["united states", ["United States", "us"]],
  ["south korea", ["South Korea", "kr"]],
  ["england", ["England", "gb-eng"]],
  ["scotland", ["Scotland", "gb-sct"]],
  ["wales", ["Wales", "gb-wls"]],
  ["czech republic", ["Czechia", "cz"]],
  ["democratic republic of the congo", ["Democratic Republic of the Congo", "cd"]],
  ["republic of the congo", ["Republic of the Congo", "cg"]],
  ["ivory coast", ["Côte d’Ivoire", "ci"]],
  ["turkey", ["Türkiye", "tr"]],
]);

const clean = (value) => value?.replace(/\[[^\]]*]/g, "").replace(/\s+/g, " ").trim() || "";
const normalizeName = (value) => clean(value)
  .normalize("NFD")
  .replace(/\p{Diacritic}/gu, "")
  .replace(/ł/gi, "l")
  .replace(/[^a-z0-9]/gi, "")
  .toLowerCase();
const slugifyName = (value) => clean(value)
  .normalize("NFD")
  .replace(/\p{Diacritic}/gu, "")
  .replace(/ł/gi, "l")
  .replace(/[^a-z0-9]+/gi, "-")
  .replace(/^-|-$/g, "")
  .toLowerCase();

// The current-roster source and UFC use different display names for these athletes.
// Keeping the aliases here lets future roster refreshes continue finding their photos.
const profileAliases = new Map([
  ["abusupiyanmagomedov", { page: "/athlete/abus-magomedov" }],
  ["alatengheili", { page: "/athlete/heili-alateng" }],
  ["aoriqileng", { page: "/athlete/aoriqileng" }],
  ["beatrizmesquita", { page: "/athlete/bia-mesquita" }],
  ["brunogustavodasilva", { page: "/athlete/bruno-silva" }],
  ["carlosdiegoferreira", { page: "/athlete/diego-ferreira" }],
  ["choidooho", { page: "/athlete/dooho-choi" }],
  ["gabrielgreen", { page: "/athlete/gabriel-green" }],
  ["janblachowicz", { page: "/athlete/jan-blachowicz" }],
  ["michaelpage", { page: "/athlete/michael-page" }],
  ["michaloleksiejczuk", { page: "/athlete/michal-oleksiejczuk" }],
  ["montserratruiz", { page: "/athlete/montserrat-conejo" }],
  ["parkhyunsung", { page: "/athlete/hyunsung-park" }],
  ["parkjunyong", { page: "/athlete/jun-yong-park" }],
  ["patriciopitbull", {
    page: "https://jp.ufc.com/athlete/patricio-pitbull-freire",
    profile: "/athlete/patricio-pitbull-freire",
  }],
  ["robertruchala", { page: "/athlete/robert-ruchala" }],
  ["ronaldorodriguez", { page: "/athlete/luis-rodriguez" }],
  ["sharabutdinmagomedov", { page: "/athlete/shara-magomedov" }],
]);

async function fetchText(url, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, { headers: HEADERS });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return await response.text();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, attempt * 500));
    }
  }
  throw new Error(`Failed to fetch ${url}: ${lastError?.message}`);
}

function absoluteUrl(value) {
  if (!value || value.includes("no-profile-image")) return "";
  return new URL(value, UFC).href;
}

function divisionCode(label) {
  const normalized = clean(label)
    .toLowerCase()
    .replace(/\([^)]*\)/g, "")
    .replace(/\s+division$/, "")
    .trim()
    .replace(/weights$/, "weight");
  return divisionCodes.get(normalized) || null;
}

function countryInfo(name) {
  const normalized = clean(name).toLowerCase();
  if (specialCountries.has(normalized)) {
    const [country, iso] = specialCountries.get(normalized);
    return { country, iso };
  }
  const iso = countries.getAlpha2Code(clean(name), "en")?.toLowerCase();
  if (!iso) return null;
  return {
    country: countries.getName(iso.toUpperCase(), "en", { select: "alias" }) || clean(name),
    iso,
  };
}

function parseHeight(value) {
  const imperial = clean(value).match(/(\d+)\s*ft\s*(\d+)\s*in/i);
  if (imperial) return Number(imperial[1]) * 12 + Number(imperial[2]);
  const metric = clean(value).match(/(\d+(?:\.\d+)?)\s*m\b/i);
  return metric ? Math.round(Number(metric[1]) * 39.3701) : null;
}

async function scrapeCurrentRoster() {
  const html = await fetchText(CURRENT_ROSTER);
  const $ = cheerio.load(html);
  const roster = [];
  console.log(`Roster tables found: ${$("table.wikitable").length}`);

  $("table.wikitable").each((_, tableElement) => {
    const table = $(tableElement);
    const heading = clean(
      table.prevAll(".mw-heading").first().find("h3").text() ||
      table.prevAll("h3").first().text(),
    );
    const division = divisionCode(heading);
    if (table.find(".vcard .fn").length) {
      console.log(`Roster table heading: "${heading}" (${table.find(".vcard .fn").length} names)`);
    }
    if (!division) return;

    table.find("tbody tr").each((__, rowElement) => {
      const cells = $(rowElement).find(":scope > td");
      if (cells.length < 4) return;
      const name = clean(cells.eq(1).find(".vcard .fn").first().text());
      const countryLabel = clean(cells.eq(0).find("img").first().attr("alt") || cells.eq(0).text());
      const location = countryInfo(countryLabel);
      const age = Number.parseInt(clean(cells.eq(2).text()), 10);
      const height = parseHeight(cells.eq(3).text());
      if (!name || !location || !Number.isFinite(age) || !height) return;
      roster.push({ name, division, ...location, age, height });
    });
  });

  const unique = [...new Map(roster.map((fighter) => [normalizeName(fighter.name), fighter])).values()];
  console.log(`Current-roster source: ${unique.length} complete fighters`);
  return unique;
}

async function scrapeRankings() {
  const html = await fetchText(`${UFC}/rankings`);
  const $ = cheerio.load(html);
  const rankings = new Map();

  $(".view-grouping").each((_, grouping) => {
    const group = $(grouping);
    const title = clean(group.find(".view-grouping-header").first().text());
    if (/pound-for-pound/i.test(title)) return;
    const division = divisionCode(title);
    if (!division) return;

    const championHref = group.find("caption a[href*='/athlete/']").first().attr("href")?.split("?")[0];
    if (championHref) rankings.set(championHref, { division, rank: 0 });

    group.find("tbody tr").each((__, row) => {
      const rank = Number.parseInt(clean($(row).find(".views-field-weight-class-rank").text()), 10);
      const href = $(row).find("a[href*='/athlete/']").first().attr("href")?.split("?")[0];
      if (href && Number.isFinite(rank)) rankings.set(href, { division, rank });
    });
  });

  console.log(`Official rankings: ${rankings.size} ranked fighters`);
  return rankings;
}

async function searchOfficialProfile(fighter, rankings) {
  const wanted = normalizeName(fighter.name);
  let selected = null;
  const alias = profileAliases.get(wanted);

  if (alias) {
    const aliasUrl = absoluteUrl(alias.page);
    const aliasHtml = await fetchText(aliasUrl);
    const aliasPage = cheerio.load(aliasHtml);
    selected = {
      profile: alias.profile || new URL(aliasUrl).pathname,
      image: absoluteUrl(
        aliasPage(".hero-profile__image").first().attr("src") ||
        aliasPage('meta[property="og:image"]').attr("content"),
      ),
    };
  }

  const html = selected ? "" : await fetchText(`${UFC}/athletes/all?search=${encodeURIComponent(fighter.name)}`);
  const $ = cheerio.load(html);

  $(".c-listing-athlete-flipcard").each((_, cardElement) => {
    const card = $(cardElement);
    const name = clean(card.find(".c-listing-athlete__name").first().text());
    if (normalizeName(name) !== wanted) return;
    const profile = card.find("a[href*='/athlete/']").first().attr("href")?.split("?")[0];
    const image = absoluteUrl(card.find(".c-listing-athlete__thumbnail img").first().attr("src"));
    selected = { profile, image };
  });

  if (!selected) {
    const firstCard = $(".c-listing-athlete-flipcard").first();
    const candidateName = clean(firstCard.find(".c-listing-athlete__name").first().text());
    if (candidateName && (
      normalizeName(candidateName).includes(wanted) ||
      wanted.includes(normalizeName(candidateName))
    )) {
      selected = {
        profile: firstCard.find("a[href*='/athlete/']").first().attr("href")?.split("?")[0],
        image: absoluteUrl(firstCard.find(".c-listing-athlete__thumbnail img").first().attr("src")),
      };
    }
  }

  if (!selected) {
    const guessedProfile = `/athlete/${slugifyName(fighter.name)}`;
    try {
      const profileHtml = await fetchText(absoluteUrl(guessedProfile), 2);
      const profilePage = cheerio.load(profileHtml);
      const profileName = clean(
        profilePage(".hero-profile__name").first().text() ||
        profilePage('meta[property="og:title"]').attr("content")?.replace(/\s*\|\s*UFC$/, ""),
      );
      if (normalizeName(profileName) === wanted) {
        selected = {
          profile: guessedProfile,
          image: absoluteUrl(
            profilePage(".hero-profile__image").first().attr("src") ||
            profilePage('meta[property="og:image"]').attr("content"),
          ),
        };
      }
    } catch {
      // Some official profile slugs do not match the fighter's display name.
    }
  }

  if (selected?.profile && !selected.image) {
    const profileHtml = await fetchText(absoluteUrl(selected.profile));
    const profilePage = cheerio.load(profileHtml);
    selected.image = absoluteUrl(
      profilePage(".hero-profile__image").first().attr("src") ||
      profilePage('meta[property="og:image"]').attr("content"),
    );
  }

  const ranking = selected?.profile ? rankings.get(selected.profile) : null;
  return {
    ...fighter,
    division: ranking?.division || fighter.division,
    rank: ranking?.rank ?? null,
    image: selected?.image || "",
    profile: selected?.profile ? absoluteUrl(selected.profile) : "",
  };
}

async function mapConcurrent(items, concurrency, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      try {
        results[index] = await worker(items[index], index);
      } catch (error) {
        results[index] = { ...items[index], rank: null, image: "", profile: "", error: error.message };
      }
      if ((index + 1) % 50 === 0) console.log(`Matched ${index + 1}/${items.length} official profiles`);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, run));
  return results;
}

async function copyUsedFlags(fighters) {
  const destination = path.join(ROOT, "public", "flags");
  await fs.mkdir(destination, { recursive: true });
  const used = [...new Set(fighters.map((fighter) => fighter.iso))];
  for (const iso of used) {
    const source = path.join(ROOT, "node_modules", "flag-icons", "flags", "4x3", `${iso}.svg`);
    const target = path.join(destination, `${iso}.svg`);
    try {
      await fs.copyFile(source, target);
    } catch {
      console.warn(`Missing flag asset for ${iso}`);
    }
  }
  return used.length;
}

const [currentRoster, rankings] = await Promise.all([scrapeCurrentRoster(), scrapeRankings()]);
let previousByName = new Map();
try {
  const previous = JSON.parse(await fs.readFile(path.join(ROOT, "src", "data", "fighters.json"), "utf8"));
  previousByName = new Map(previous.filter((fighter) => fighter.image).map((fighter) => [normalizeName(fighter.name), fighter]));
} catch {
  // The first import has no previous roster cache.
}
const fighters = (await mapConcurrent(
  currentRoster,
  12,
  async (fighter) => {
    const previous = previousByName.get(normalizeName(fighter.name));
    const latest = await searchOfficialProfile(fighter, rankings);
    if (!latest.image && previous?.image) {
      latest.image = previous.image;
      latest.profile ||= previous.profile;
    }
    return latest;
  },
)).sort((a, b) => a.name.localeCompare(b.name));

await fs.mkdir(path.join(ROOT, "src", "data"), { recursive: true });
await fs.writeFile(
  path.join(ROOT, "src", "data", "fighters.json"),
  `${JSON.stringify(fighters, null, 2)}\n`,
  "utf8",
);
const flagCount = await copyUsedFlags(fighters);

console.log(JSON.stringify({
  currentRosterFighters: fighters.length,
  officialPortraits: fighters.filter((fighter) => fighter.image).length,
  portraitFallbacks: fighters.filter((fighter) => !fighter.image).length,
  officialProfiles: fighters.filter((fighter) => fighter.profile).length,
  rankedFighters: fighters.filter((fighter) => fighter.rank != null).length,
  uniqueCountries: new Set(fighters.map((fighter) => fighter.country)).size,
  copiedFlags: flagCount,
  errors: fighters.filter((fighter) => fighter.error).slice(0, 10),
  fallbackImage: FALLBACK_IMAGE,
}, null, 2));

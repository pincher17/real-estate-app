import { supabase } from "../supabase";

const BATCH_SIZE = 500;

function normalizeNumber(raw: string): number | null {
  const cleaned = raw.replace(/[\s\u00A0'’]/g, "");
  if (!cleaned) return null;

  const hasComma = cleaned.includes(",");
  const hasDot = cleaned.includes(".");

  let normalized = cleaned;
  if (hasComma && hasDot) {
    // Assume commas are thousand separators
    normalized = normalized.replace(/,/g, "");
  } else if (hasComma && !hasDot) {
    const commaGroups = normalized.match(/^\d{1,3}(,\d{3})+$/);
    if (commaGroups) {
      normalized = normalized.replace(/,/g, "");
    } else {
      // Treat comma as decimal separator
      normalized = normalized.replace(/,/g, ".");
    }
  } else if (hasDot && !hasComma) {
    const dotGroups = normalized.match(/^\d{1,3}(\.\d{3})+$/);
    if (dotGroups) {
      normalized = normalized.replace(/\./g, "");
    }
  }

  normalized = normalized.replace(/[^0-9.]/g, "");
  if (!normalized) return null;

  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

function normalizeLine(line: string): string {
  return line
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/\uFE0F/g, "")
    .replace(/[^\S\r\n]+/g, " ")
    .replace(/²/g, "2");
}

type PriceResult = {
  value: number | null;
  currency: string | null;
  usd: number | null;
  priority: "explicit" | "normal";
};

function extractPrice(text: string): PriceResult {
  const patterns: { re: RegExp; currency: string }[] = [
    { re: /(\$|usd|\bus\s?d|\bдолл\b|\bдоллар\b|\bдол\b\.?)/i, currency: "USD" },
    { re: /(₾|\bgel\b|\bлари\b)/i, currency: "GEL" },
    { re: /(€|\beur\b)/i, currency: "EUR" },
    { re: /(₽|\bруб\b|\brub\b)/i, currency: "RUB" }
  ];

  const numberRe =
    /\d{1,3}(?:[.\s,'’]\d{3})+|\d{3,}|\d{2,3}[.,]\d{1,2}|\d{2,3}\s*[kк]\b/gi;
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  let best: { value: number; currency: string } | null = null;
  const candidates: { value: number; currency: string; priority: "explicit" | "normal" }[] = [];

  const isPricePerM2 = (line: string) => {
    const normalized = normalizeLine(line);
    if (/(\/\s?m2|\/\s?m2|per\s?m2|за\s?м2|за\s?м2|за\s?кв\.?\s?м)/i.test(normalized)) {
      return true;
    }
    // Lines like "$1622м²" or "₾1200 м²" are price per m2
    if (/[€$₾₽]/.test(normalized) && /(m2|кв\.?\s?м)/i.test(normalized)) {
      return true;
    }
    return false;
  };

  // 1) Explicit "Price" / "Цена" line wins
  for (const line of lines) {
    if (!/цена|price/i.test(line)) continue;
    if (isPricePerM2(line)) continue;
    const normalized = normalizeLine(line);
    const currencyMatch = patterns.find((p) => p.re.test(normalized));
    for (const m of line.matchAll(numberRe)) {
      let raw = m[0];
      let multiplier = 1;
      if (/[kк]\b/i.test(raw)) {
        multiplier = 1000;
        raw = raw.replace(/[kк]\b/gi, "");
      }
      const value = normalizeNumber(raw);
      if (value != null) {
        candidates.push({
          value: value * multiplier,
          currency: currencyMatch ? currencyMatch.currency : "USD",
          priority: "explicit"
        });
      }
    }
  }

  // 2) General scan
  for (const line of lines) {
    if (isPricePerM2(line)) continue;
    const normalized = normalizeLine(line);
    const currencyMatch = patterns.find((p) => p.re.test(normalized));
    const hasK = /\b\d{2,3}\s*[kк]\b/i.test(line);
    const hasThousandWord = /(тыс|thousand)/i.test(line);
    if (!currencyMatch && !hasK && !hasThousandWord) continue;

    let maxValue: number | null = null;
    for (const m of line.matchAll(numberRe)) {
      let raw = m[0];
      let multiplier = 1;
      if (/[kк]\b/i.test(raw)) {
        multiplier = 1000;
        raw = raw.replace(/[kк]\b/gi, "");
      }
      const value = normalizeNumber(raw);
      if (value != null) {
        const scaled = value * multiplier;
        if (maxValue == null || scaled > maxValue) maxValue = scaled;
      }
    }
    if (maxValue != null) {
      candidates.push({
        value: maxValue,
        currency: currencyMatch ? currencyMatch.currency : "USD",
        priority: "normal"
      });
    }
  }

  if (!best) {
    // Fallback: detect bare currency lines like "$165,000"
    for (const line of lines) {
      if (isPricePerM2(line)) continue;
      const normalized = normalizeLine(line);
      if (!/[$€₾₽]/.test(normalized)) continue;
      let maxValue: number | null = null;
      for (const m of line.matchAll(numberRe)) {
        let raw = m[0];
        let multiplier = 1;
        if (/[kк]\b/i.test(raw)) {
          multiplier = 1000;
          raw = raw.replace(/[kк]\b/gi, "");
        }
        const value = normalizeNumber(raw);
        if (value != null) {
          const scaled = value * multiplier;
          if (maxValue == null || scaled > maxValue) maxValue = scaled;
        }
      }
      if (maxValue != null) {
        const currencyMatch = patterns.find((p) => p.re.test(normalized));
        candidates.push({
          value: maxValue,
          currency: currencyMatch ? currencyMatch.currency : "USD",
          priority: "normal"
        });
      }
    }
  }

  if (!best) {
    // Fallback: detect currency with amount separated by space (e.g. "$ 43800")
    const currencyAmount = lines.find((line) =>
      /[$€₾₽]\s*\d{2,6}/.test(normalizeLine(line))
    );
    if (currencyAmount) {
      const normalized = normalizeLine(currencyAmount);
      const currencyMatch = patterns.find((p) => p.re.test(normalized));
      const m = currencyAmount.match(/\d{2,6}/);
      if (m) {
        const value = normalizeNumber(m[0]);
        if (value != null) {
          candidates.push({
            value,
            currency: currencyMatch ? currencyMatch.currency : "USD",
            priority: "normal"
          });
        }
      }
    }
  }

  if (candidates.length > 0) {
    const explicit = candidates.filter((c) => c.priority === "explicit");
    if (explicit.length > 0) {
      best = explicit.sort((a, b) => b.value - a.value)[0];
    } else {
      best = candidates.sort((a, b) => b.value - a.value)[0];
    }
  }

  if (!best) {
    return { value: null, currency: null, usd: null, priority: "normal" };
  }

  return {
    value: best.value,
    currency: best.currency,
    usd: best.currency === "USD" ? best.value : null,
    priority: "normal"
  };
}

function extractArea(text: string): number | null {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const re = /(\d{1,4}(?:[.,]\d{1,2})?)\s*(?:m2|m²|sqm|sq\s?m|кв\.?\s?м|кв\s?м|м2|м²)/i;

  const candidates: number[] = [];
  for (const line of lines) {
    const normalized = normalizeLine(line);
    // Skip price-per-m2 lines
    if (/[€$₾₽]/.test(normalized) && /(m2|кв\.?\s?м)/i.test(normalized)) continue;
    const match = normalized.match(re);
    if (!match) continue;
    const value = normalizeNumber(match[1]);
    if (value == null) continue;
    if (value < 10 || value > 500) continue;
    candidates.push(value);
  }

  if (candidates.length > 0) {
    return candidates.sort((a, b) => b - a)[0];
  }

  const match = text.match(re);
  if (!match) return null;
  return normalizeNumber(match[1]);
}

function extractRooms(text: string): {
  roomsText: string | null;
  bedrooms: number | null;
  living: number | null;
} {
  if (/(studio|студия)/i.test(text)) {
    return { roomsText: "studio", bedrooms: 0, living: 1 };
  }

  const plusRe = /(\d)\s*\+\s*(\d)/;
  const plusMatch = text.match(plusRe);
  if (plusMatch) {
    const bedrooms = Number(plusMatch[1]);
    const living = Number(plusMatch[2]);
    return {
      roomsText: `${bedrooms}+${living}`,
      bedrooms,
      living
    };
  }

  const roomsRe = /(\d)\s*(?:комн|комн\.|комнаты|rooms?)/i;
  const roomsMatch = text.match(roomsRe);
  if (roomsMatch) {
    const bedrooms = Number(roomsMatch[1]);
    return { roomsText: `${bedrooms}+1`, bedrooms, living: 1 };
  }

  return { roomsText: null, bedrooms: null, living: null };
}

function extractFloor(text: string): { floor: number | null; totalFloors: number | null } {
  const ofRe = /(?:этаж|floor)?\s*(\d{1,2})\s*(?:из|of)\s*(\d{1,2})/i;
  const ofMatch = text.match(ofRe);
  if (ofMatch) {
    return { floor: Number(ofMatch[1]), totalFloors: Number(ofMatch[2]) };
  }

  const colonRe = /(?:этаж|floor)\s*[:\-]?\s*(\d{1,2})(?:\s*\/\s*(\d{1,2}))?/i;
  const colonMatch = text.match(colonRe);
  if (colonMatch) {
    return {
      floor: Number(colonMatch[1]),
      totalFloors: colonMatch[2] ? Number(colonMatch[2]) : null
    };
  }

  const inlineRe = /(этаж|floor)\s*(\d{1,2})\s*\/\s*(\d{1,2})/i;
  const inlineMatch = text.match(inlineRe);
  if (inlineMatch) {
    return {
      floor: Number(inlineMatch[2]),
      totalFloors: Number(inlineMatch[3])
    };
  }

  const inlineSingleRe = /(этаж|floor)\s*(\d{1,2})/i;
  const inlineSingleMatch = text.match(inlineSingleRe);
  if (inlineSingleMatch) {
    return { floor: Number(inlineSingleMatch[2]), totalFloors: null };
  }

  const slashRe = /(\d{1,2})\s*\/\s*(\d{1,2})\s*этаж/i;
  const slashMatch = text.match(slashRe);
  if (slashMatch) {
    return { floor: Number(slashMatch[1]), totalFloors: Number(slashMatch[2]) };
  }

  const plainFloor = /(\d{1,2})\s*(?:-?\s*[йй]?|)\s*этаж/i;
  const plainMatch = text.match(plainFloor);
  if (plainMatch) {
    return { floor: Number(plainMatch[1]), totalFloors: null };
  }

  return { floor: null, totalFloors: null };
}

function extractCondition(text: string): string | null {
  const checks: { re: RegExp; value: string }[] = [
    { re: /(white\s*frame|белый\s*каркас)/i, value: "WHITE_FRAME" },
    { re: /(black\s*frame|черный\s*каркас)/i, value: "BLACK_FRAME" },
    { re: /(renovated|ремонт|ремонтирован)/i, value: "RENOVATED" },
    { re: /(furnished|мебель|меблирован)/i, value: "FURNISHED" },
    { re: /(under\s*construction|строится)/i, value: "UNDER_CONSTRUCTION" }
  ];

  for (const c of checks) {
    if (c.re.test(text)) return c.value;
  }

  return null;
}

function pickAddressLine(lines: string[]): string | null {
  const addressRe = /(ул\.?|улица|street|st\.|просп\.?|проспект|ave\.|avenue|бульвар|пр\-т|район)/i;
  for (const line of lines) {
    if (addressRe.test(line) || /,\s*\d{1,4}\b/.test(line)) {
      return line;
    }
  }
  return null;
}

function pickBuildingName(lines: string[]): string | null {
  for (const line of lines) {
    const hasLetters = /[A-Za-zА-Яа-я]/.test(line);
    const hasPrice = /(\$|usd|₾|gel|€|₽|руб|долл)/i.test(line);
    const hasArea = /(m2|m²|sqm|кв\.?\s?м|м2|м²)/i.test(line);
    const hasFloor = /этаж|floor/i.test(line);
    if (hasLetters && !hasPrice && !hasArea && !hasFloor && line.length <= 60) {
      return line;
    }
  }
  return null;
}

function classifyPropertyType(title: string, description: string): "apartment" | "commercial" | "house_land" {
  const text = `${title} ${description}`;
  const apartmentRe =
    /(^|[^a-zа-я])(квартир[а-яa-z]*|апартамент[а-яa-z]*|apartment[s]?)([^a-zа-я]|$)/i;
  const commercialRe =
    /(^|[^a-zа-я])(коммерц[а-яa-z]*|коммерческ[а-яa-z]*|бизнес[а-яa-z]*|офис[а-яa-z]*|магазин[а-яa-z]*|кафе|ресторан[а-яa-z]*|склад[а-яa-z]*|помещен[а-яa-z]*|торгов[а-яa-z]*|commercial|office|shop|retail|warehouse|business)([^a-zа-я]|$)/i;
  const houseLandRe =
    /(^|[^a-zа-я])(участ[а-яa-z]*|земл[а-яa-z]*|коттедж[а-яa-z]*|таунхаус[а-яa-z]*|частн[а-яa-z]*\s+дом[а-яa-z]*|дач[а-яa-z]*|house|land|villa|townhouse|plot)([^a-zа-я]|$)/i;

  if (apartmentRe.test(text)) return "apartment";
  if (commercialRe.test(text)) return "commercial";
  if (houseLandRe.test(text)) return "house_land";
  return "apartment";
}

type RunExtractionOptions = {
  listingIds?: string[];
};

async function fillMissingDescriptions(listingIds?: string[]) {
  if (listingIds && listingIds.length === 0) return;

  let query = supabase
    .from("listings")
    .select("id, source_id, listing_key, description_raw")
    .or("description_raw.is.null,description_raw.eq.");
  if (listingIds && listingIds.length > 0) {
    query = query.in("id", listingIds);
  }

  const { data: listings, error } = await query;

  if (error) {
    console.error("Failed to load listings for description backfill", error);
    return;
  }

  if (!listings || listings.length === 0) return;

  console.log(`Filling missing descriptions for ${listings.length} listings...`);
  let updated = 0;

  for (const listing of listings) {
    const { data: msgs, error: msgError } = await supabase
      .from("telegram_messages")
      .select("text_raw")
      .eq("source_id", listing.source_id)
      .or(`grouped_id.eq.${listing.listing_key},message_id.eq.${listing.listing_key}`)
      .not("text_raw", "is", null)
      .limit(10);

    if (msgError || !msgs || msgs.length === 0) continue;

    const best = msgs
      .map((m) => (m as any).text_raw as string)
      .filter((t) => t && t.trim().length > 0)
      .sort((a, b) => b.length - a.length)[0];

    if (best) {
      await supabase
        .from("listings")
        .update({ description_raw: best })
        .eq("id", listing.id);
      updated++;
      if (updated % 50 === 0) {
        console.log(`Updated descriptions: ${updated}/${listings.length}`);
      }
    }
  }

  console.log(`Description backfill done. Updated ${updated} listings.`);
}

export async function runExtraction(options: RunExtractionOptions = {}) {
  const listingIds = options.listingIds && options.listingIds.length > 0 ? options.listingIds : undefined;
  await fillMissingDescriptions(listingIds);

  let from = 0;
  let totalProcessed = 0;
  while (true) {
    let query = supabase
      .from("listings")
      .select(
        "id, title, description_raw, property_type, price_usd, price_value, price_currency, area_m2, floor, total_floors, rooms_text, rooms_bedrooms, rooms_living, condition_norm"
      );
    if (listingIds) {
      query = query.in("id", listingIds);
    }

    const { data, error } = await query.range(from, from + BATCH_SIZE - 1);

    if (error) {
      console.error("Failed to load listings", error);
      return;
    }

    if (!data || data.length === 0) break;

    console.log(`Processing listings ${from + 1}-${from + data.length}...`);

    for (const row of data as any[]) {
      const title = (row.title || "").toString();
      const description = (row.description_raw || "").toString();
      if (!description.trim()) continue;
      const lines = description
        .split(/\r?\n/)
        .map((l: string) => l.trim())
        .filter(Boolean);

      const updates: Record<string, any> = {};
      const nextPropertyType = classifyPropertyType(title, description);
      if (row.property_type !== nextPropertyType) {
        updates.property_type = nextPropertyType;
      }

      const price = extractPrice(description);
      if (price.value != null) {
        const shouldOverwrite =
          price.priority === "explicit" ||
          row.price_value == null ||
          row.price_value === 0 ||
          row.price_value < 1000 ||
          (row.price_value != null && row.price_value < price.value);
        if (shouldOverwrite) {
          updates.price_value = price.value;
          updates.price_currency = price.currency;
          if (price.usd != null) updates.price_usd = price.usd;
        }
      }

      if (row.area_m2 == null) {
        const area = extractArea(description);
        if (area != null) updates.area_m2 = area;
      }

      if (row.rooms_text == null && row.rooms_bedrooms == null) {
        const rooms = extractRooms(description);
        if (rooms.roomsText) updates.rooms_text = rooms.roomsText;
        if (rooms.bedrooms != null) updates.rooms_bedrooms = rooms.bedrooms;
        if (rooms.living != null) updates.rooms_living = rooms.living;
      }

      {
        const floor = extractFloor(description);
        if (
          floor.floor != null &&
          (row.floor == null || row.floor !== floor.floor)
        ) {
          updates.floor = floor.floor;
        }
        if (
          floor.totalFloors != null &&
          (row.total_floors == null || row.total_floors !== floor.totalFloors)
        ) {
          updates.total_floors = floor.totalFloors;
        }
      }

      if (row.condition_norm == null) {
        const condition = extractCondition(description);
        if (condition) updates.condition_norm = condition;
      }

      if (!row.address_text || !row.district || !row.street || !row.building_name) {
        const address = pickAddressLine(lines);
        const building = pickBuildingName(lines);
        if (address && !row.address_text) updates.address_text = address;
        if (building && !row.building_name) updates.building_name = building;
      }

      if (Object.keys(updates).length > 0) {
        await supabase.from("listings").update(updates).eq("id", row.id);
      }
    }

    totalProcessed += data.length;
    console.log(`Processed ${totalProcessed} listings so far.`);

    if (data.length < BATCH_SIZE) break;
    from += BATCH_SIZE;
  }

  console.log("Extraction complete.");
}

if (require.main === module) {
  runExtraction().catch((err) => {
    console.error("Extraction failed", err);
    process.exit(1);
  });
}

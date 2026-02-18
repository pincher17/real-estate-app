import { Api } from "telegram";
import { getTelegramClient, disconnectTelegramClient } from "./client";
import { supabase, SourceRow, TelegramMessageRow } from "../supabase";
import { config } from "../config";

const THREE_MONTHS_MS = 90 * 24 * 60 * 60 * 1000;
const MESSAGE_CHECK_BATCH_SIZE = 100;
const MAX_SUSPICIOUS_MISSING_RATIO = 0.6;
const MIN_LISTINGS_FOR_RATIO_GUARD = 20;

type ListingRow = {
  id: string;
  source_id: string;
  listing_key: number;
  message_id: number;
  permalink: string | null;
};

async function ensureSource(): Promise<SourceRow> {
  const client = await getTelegramClient();
  const channel = await client.getEntity(config.telegramChannelUsername);

  const peerId = Number((channel as any).id.valueOf());
  const title = (channel as any).title ?? null;
  const username = (channel as any).username ?? null;

  console.log(`Found channel: ${title} (@${username})`);

  const { data, error } = await supabase
    .from("sources")
    .upsert(
      {
        type: "telegram_channel",
        telegram_peer_id: peerId,
        title,
        username
      },
      {
        onConflict: "telegram_peer_id"
      }
    )
    .select("*")
    .single();

  if (error || !data) {
    console.error("Failed to upsert source:", error);
    throw new Error("Failed to upsert source");
  }

  return data as SourceRow;
}

async function upsertTelegramMessage(
  source: SourceRow,
  message: Api.Message
): Promise<TelegramMessageRow> {
  const text = (message.message as string) || null;
  const hasMedia =
    message.media instanceof Api.MessageMediaPhoto ||
    message.media instanceof Api.MessageMediaDocument;

  const permalink =
    source.username != null
      ? `https://t.me/${source.username}/${message.id}`
      : null;

  const { data, error } = await supabase
    .from("telegram_messages")
    .upsert(
      {
        source_id: source.id,
        message_id: message.id,
        grouped_id: (message as any).groupedId ?? null,
        posted_at: new Date((message.date as any) * 1000).toISOString(),
        text_raw: text,
        permalink,
        has_media: hasMedia,
        media_count: hasMedia ? 1 : 0
      },
      {
        onConflict: "source_id,message_id"
      }
    )
    .select("*")
    .single();

  if (error || !data) {
    console.error("upsertTelegramMessage error:", error);
    throw new Error("Failed to upsert telegram_messages");
  }

  return data as TelegramMessageRow;
}

async function upsertListingFromMessage(
  source: SourceRow,
  message: Api.Message,
  messageRow: TelegramMessageRow
): Promise<{ listingId: string }> {
  const text = (message.message as string) || null;
  const listingKey =
    (message as any).groupedId != null
      ? String((message as any).groupedId)
      : String(message.id);
  const permalink =
    source.username != null
      ? `https://t.me/${source.username}/${message.id}`
      : null;

  const { data, error } = await supabase
    .from("listings")
    .upsert(
      {
        source_id: source.id,
        message_id: message.id,
        listing_key: listingKey,
        posted_at: new Date((message.date as any) * 1000).toISOString(),
        title: null,
        description_raw: text,
        permalink
      },
      {
        onConflict: "source_id,listing_key"
      }
    )
    .select("id")
    .single();

  if (error || !data) {
    console.error("upsertListingFromMessage error:", error);
    throw new Error("Failed to upsert listings");
  }

  return { listingId: data.id as string };
}

async function processMediaForMessage(
  source: SourceRow,
  message: Api.Message,
  messageRow: TelegramMessageRow,
  listingId: string
) {
  const client = await getTelegramClient();

  const hasPhoto =
    message.media instanceof Api.MessageMediaPhoto ||
    (message as any).photo;

  if (!hasPhoto) return;

  try {
    const buffer = (await client.downloadMedia(message)) as Buffer;

    if (!buffer || buffer.length === 0) {
      console.warn(`No buffer for message ${message.id}`);
      return;
    }

    const path = `${source.id}/${message.id}/0.jpg`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(config.supabaseStorageBucket)
      .upload(path, buffer, {
        contentType: "image/jpeg",
        upsert: true
      });

    if (uploadError) {
      console.error("Supabase storage upload error:", uploadError);
      return;
    }

    const { data: publicData } = supabase.storage
      .from(config.supabaseStorageBucket)
      .getPublicUrl(uploadData.path);

    const publicUrl = publicData.publicUrl;

    const { data: mediaRow, error: mediaError } = await supabase
      .from("telegram_media")
      .insert({
        message_row_id: messageRow.id,
        telegram_file_id: null,
        type: "photo",
        width: null,
        height: null,
        storage_bucket: config.supabaseStorageBucket,
        storage_path: uploadData.path,
        cdn_url: publicUrl,
        position: 0
      })
      .select("*")
      .single();

    if (mediaError) {
      console.error("telegram_media insert error:", mediaError);
      return;
    }

    const { error: listingImageError } = await supabase
      .from("listing_images")
      .upsert({
        listing_id: listingId,
        telegram_media_id: mediaRow.id,
        url: publicUrl,
        position: message.id
      }, {
        onConflict: "listing_id,position"
      });

    if (listingImageError) {
      console.error("listing_images insert error:", listingImageError);
    }
  } catch (err) {
    console.error(`Error processing media for message ${message.id}:`, err);
  }
}

async function processMessage(source: SourceRow, message: Api.Message): Promise<string | null> {
  if (!(message instanceof Api.Message)) return null;
  if (!message.id || !message.date) return null;

  try {
    const listingKey =
      (message as any).groupedId != null
        ? String((message as any).groupedId)
        : String(message.id);
    const { data: excluded } = await supabase
      .from("excluded_listings")
      .select("id")
      .eq("source_id", source.id)
      .eq("listing_key", listingKey)
      .maybeSingle();
    if (excluded) {
      console.log(`Skipping excluded listing ${listingKey}`);
      return null;
    }
    const msgRow = await upsertTelegramMessage(source, message);
    const { listingId } = await upsertListingFromMessage(source, message, msgRow);
    await processMediaForMessage(source, message, msgRow, listingId);
    return listingId;
  } catch (err) {
    console.error(`Error processing message ${message.id}:`, err);
    return null;
  }
}

async function cleanupListingMedia(listingId: string) {
  const { data: images } = await supabase
    .from("listing_images")
    .select("telegram_media_id")
    .eq("listing_id", listingId);

  const mediaIds = (images || [])
    .map((row: any) => row.telegram_media_id)
    .filter(Boolean) as string[];

  if (mediaIds.length) {
    const { data: mediaRows } = await supabase
      .from("telegram_media")
      .select("id, storage_bucket, storage_path")
      .in("id", mediaIds);

    if (mediaRows && mediaRows.length) {
      const byBucket = new Map<string, string[]>();
      for (const row of mediaRows as any[]) {
        if (!row.storage_bucket || !row.storage_path) continue;
        const paths = byBucket.get(row.storage_bucket) || [];
        paths.push(row.storage_path);
        byBucket.set(row.storage_bucket, paths);
      }

      for (const [bucket, paths] of byBucket.entries()) {
        if (paths.length) {
          await supabase.storage.from(bucket).remove(paths);
        }
      }
    }

    await supabase.from("listing_images").delete().eq("listing_id", listingId);
    await supabase.from("telegram_media").delete().in("id", mediaIds);
  }
}

async function excludeAndDeleteListing(listing: ListingRow, reason: string) {
  await supabase.from("excluded_listings").upsert(
    {
      source_id: listing.source_id,
      listing_key: listing.listing_key,
      message_id: listing.message_id,
      permalink: listing.permalink,
      reason,
      deleted_by: null
    },
    { onConflict: "source_id,listing_key" }
  );

  try {
    await cleanupListingMedia(listing.id);
  } catch (err) {
    console.error(`Failed to cleanup media for listing ${listing.id}:`, err);
  }
  await supabase.from("listings").delete().eq("id", listing.id);
}

export async function runBackfill() {
  console.log("Starting backfill for last 3 months...\n");

  const client = await getTelegramClient();
  const source = await ensureSource();

  const channel = await client.getEntity(config.telegramChannelUsername);
  const now = Date.now();
  const threeMonthsAgo = now - THREE_MONTHS_MS;

  let maxMessageId = source.last_message_id ?? 0;
  let processedCount = 0;

  console.log(`Fetching messages from ${new Date(threeMonthsAgo).toISOString()} to now...\n`);

  try {
    for await (const message of client.iterMessages(channel, {
      limit: 0 // unlimited, we break manually by date
    })) {
      if (!(message instanceof Api.Message)) continue;
      
      const msgDateMs = (message.date as any) * 1000;
      if (msgDateMs < threeMonthsAgo) {
        console.log(`\nReached 3-month cutoff at message ${message.id}`);
        break;
      }

      await processMessage(source, message);
      processedCount++;

      if (message.id > maxMessageId) {
        maxMessageId = message.id;
      }

      if (processedCount % 10 === 0) {
        process.stdout.write(`\rProcessed ${processedCount} messages...`);
      }
    }
  } catch (err) {
    console.error("\nError during iteration:", err);
  }

  console.log(`\n\nProcessed ${processedCount} messages`);

  const { error } = await supabase
    .from("sources")
    .update({ last_message_id: maxMessageId })
    .eq("id", source.id);

  if (error) {
    console.error("Failed to update last_message_id:", error);
  } else {
    console.log(`Updated last_message_id to ${maxMessageId}`);
  }

  await disconnectTelegramClient();
}

export async function runDeletedCheck() {
  console.log("Starting old-listings deleted-post check...\n");

  const client = await getTelegramClient();
  const source = await ensureSource();
  const channel = await client.getEntity(config.telegramChannelUsername);

  const { data: listings, error } = await supabase
    .from("listings")
    .select("id, source_id, listing_key, message_id, permalink")
    .eq("source_id", source.id);

  if (error) {
    console.error("Failed to load listings for deleted check:", error);
    await disconnectTelegramClient();
    throw new Error("Failed to load listings");
  }

  const allListings = (listings || []) as ListingRow[];
  if (allListings.length === 0) {
    console.log("No listings to check.");
    await disconnectTelegramClient();
    return;
  }

  console.log(`Checking ${allListings.length} listings against Telegram messages...\n`);

  const missingCandidates: ListingRow[] = [];

  for (let i = 0; i < allListings.length; i += MESSAGE_CHECK_BATCH_SIZE) {
    const batch = allListings.slice(i, i + MESSAGE_CHECK_BATCH_SIZE);
    const batchMessageIds = batch.map((row) => row.message_id);

    try {
      const messages = (await client.getMessages(channel, {
        ids: batchMessageIds
      })) as any[];

      const existingIds = new Set<number>();
      for (const msg of messages || []) {
        if (msg instanceof Api.Message && msg.id) {
          existingIds.add(Number(msg.id));
        }
      }

      for (const listing of batch) {
        if (!existingIds.has(Number(listing.message_id))) {
          missingCandidates.push(listing);
        }
      }
    } catch (err) {
      console.error(`Deleted-check batch failed at offset ${i}:`, err);
    }

    if ((i / MESSAGE_CHECK_BATCH_SIZE + 1) % 10 === 0) {
      process.stdout.write(
        `\rChecked ${Math.min(i + MESSAGE_CHECK_BATCH_SIZE, allListings.length)} / ${allListings.length}...`
      );
    }
  }

  console.log(`\nPotentially missing in Telegram: ${missingCandidates.length}`);

  const suspicious =
    allListings.length >= MIN_LISTINGS_FOR_RATIO_GUARD &&
    missingCandidates.length / allListings.length > MAX_SUSPICIOUS_MISSING_RATIO;

  if (suspicious) {
    console.error(
      "Aborting deletion: suspiciously high missing ratio. Check Telegram access/channel settings."
    );
    await disconnectTelegramClient();
    throw new Error("Deleted-check aborted by safety guard");
  }

  let deletedCount = 0;
  for (const listing of missingCandidates) {
    try {
      await excludeAndDeleteListing(listing, "telegram_deleted");
      deletedCount++;
    } catch (err) {
      console.error(`Failed to exclude/delete listing ${listing.id}:`, err);
    }
  }

  console.log(`Deleted from site because removed in Telegram: ${deletedCount}`);
  await disconnectTelegramClient();
}

export async function runIncremental(): Promise<{ processedCount: number; listingIds: string[] }> {
  console.log("Starting incremental sync...\n");

  const client = await getTelegramClient();
  const source = await ensureSource();
  const channel = await client.getEntity(config.telegramChannelUsername);

  const lastId = source.last_message_id ?? 0;
  let maxMessageId = lastId;
  let processedCount = 0;
  const touchedListingIds = new Set<string>();

  console.log(`Fetching messages after ID ${lastId}...\n`);

  try {
    for await (const message of client.iterMessages(channel, {
      limit: 0,
      minId: lastId
    })) {
      if (!(message instanceof Api.Message)) continue;
      const listingId = await processMessage(source, message);
      processedCount++;
      if (listingId) touchedListingIds.add(listingId);
      if (message.id > maxMessageId) maxMessageId = message.id;
    }
  } catch (err) {
    console.error("Error during incremental sync:", err);
  }

  console.log(`Processed ${processedCount} new messages`);

  if (maxMessageId !== lastId) {
    const { error } = await supabase
      .from("sources")
      .update({ last_message_id: maxMessageId })
      .eq("id", source.id);

    if (error) {
      console.error("Failed to update last_message_id:", error);
    } else {
      console.log(`Updated last_message_id to ${maxMessageId}`);
    }
  }

  await disconnectTelegramClient();
  return {
    processedCount,
    listingIds: Array.from(touchedListingIds)
  };
}

if (require.main === module) {
  const mode = process.argv[2] || "backfill";

  (async () => {
    try {
      if (mode === "backfill") {
        await runBackfill();
      } else if (mode === "incremental") {
        await runIncremental();
      } else if (mode === "check_deleted") {
        await runDeletedCheck();
      } else {
        console.error('Unknown mode. Use "backfill", "incremental" or "check_deleted".');
        process.exit(1);
      }
      console.log("\n✅ Done!");
      process.exit(0);
    } catch (err) {
      console.error("\n❌ Error:", err);
      await disconnectTelegramClient();
      process.exit(1);
    }
  })();
}

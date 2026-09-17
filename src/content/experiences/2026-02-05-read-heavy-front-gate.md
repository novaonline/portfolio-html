---
type: article
title: Heavy Reads Belong at the Front Gate
description: Why I want the supported API to handle heavy historical reads,
  without moving interpretation rules into analytics.
slug: 2026-02-05-read-heavy-front-gate
date: 2026-02-05
tags:
  - Architecture
  - APIs
  - Cassandra
  - Telemetry data
  - Replayability
status: draft
concepts: []
unlisted: false
noindex: false
rss: true
---
I bias towards read-heavy data pipelines because most of the data I work with is [telemetry](#context-1)[^context-1] and time series data, where the value shows up when someone queries, enriches or aggregates it. I prefer spending time optimizing for fast and heavy reads over write performance and minimizing backlog.

I expect investing in an API that supports heavy reads to pay off in the long run. If the API cannot handle the volume, a direct database copy becomes an attractive workaround, which I tend to avoid.

That investment has a tradeoff: optimizing for heavy reads sometimes means accepting slower writes or a larger backlog, within reasonable limits for the service. For the telemetry and time series data I work with, I am generally willing to accept that cost.

## Here is the scenario

> An analytics team keeps hourly temperature averages and discards the individual readings. Now it needs to count one-minute readings above 28°C for each device, including recent history. The averages cannot recover those spikes, so the team needs individual readings from the telemetry service's available 90-day window. The team will retain individual readings from here on so it can support this calculation and future ones.

Consider telemetry readings of [24°C](shape:box/blue), [27°C](shape:box/purple) and [86 ?](shape:box/amber/missing). The incomplete reading ([86 ?](shape:box/amber/missing)) has a value but no stored unit, reflecting the imperfect data that can arrive from upstream systems. Historical device configuration establishes [86°F](shape:box/amber), which becomes [30°C](shape:box/amber).

A database copy leaves analytics responsible for that interpretation. In this scenario, the API is the team's established front gate for many downstream consumers, from internal teams to end users. It must own the device rules and return consistent Celsius readings. The incomplete reading needs resolving either way; the difference is which team owns that work.

Let's take a look at a direct database copy, assuming a configured [cross-database link](#context-2)[^context-2]. The visual uses one illustrative batch of 50,000 readings. Analytics receives the stored values and must resolve the missing unit before calculating:

```sql
-- Assumes analytics can query telemetry through a configured cross-database link.
-- That capability depends on the data technology and deployment.
INSERT INTO analytics.raw_backfill_readings
  (reading_id, device_id, event_time, value, unit)
SELECT
  reading_id,
  device_id,
  event_time,
  value,
  unit
FROM telemetry.device_readings
WHERE event_time >= TIMESTAMPTZ '2025-11-07T00:00:00Z'
  AND event_time < TIMESTAMPTZ '2026-02-05T00:00:00Z';
```

[visual:backfill-database]

Analytics still needs to resolve the missing unit before comparing that reading with 28°C. It can do that in SQL or application code, but it now maintains another copy of the producer's rules.

Now let's look at what I prefer: retrieving the same history through the API contract that already resolves those readings. The visual splits the same 50,000 readings into five pages of 10,000:

```csharp
// Illustrative C# client, not a built-in .NET API.
// Follows cursors, reads Parquet pages, and stages individual readings locally.
await readingsClient
    .Fetch(
        from: "2025-11-07T00:00:00Z",
        until: "2026-02-05T00:00:00Z",
        fields: new[]
        {
            "reading_id", "device_id", "event_time", "value_celsius"
        },
        format: Parquet)
    .AsPages(size: 10_000)
    // CSV or JSON can suit smaller consumers.
    .WriteToAsync("analytics.backfill_readings");
```

[visual:backfill-api]

Most importantly, this assumes an API explicitly designed to handle extremely large reads, with bounded pages and agreed capacity. It might use a dedicated replica set for large batch operations, separate from small, very low-latency reads, to keep them from competing for compute. Analytics retains the individual readings and counts the one-minute readings above 28°C for each device. The API owns the unit interpretation and conversion to Celsius. Stable reading IDs support deduplication, and the teams must preserve the historical window while the backfill runs.

Direct database access can make sense when the producer deliberately makes a well-transformed [gold layer](#context-3)[^context-3] its front gate: curated data that downstream consumers can query directly, without an API. Beyond that exception, I would rather have the API support heavy reads than require another team to reproduce interpretation rules just to retrieve the history.

[^context-1]: Here, I mean metered readings and events collected from devices or systems, such as temperature measurements or usage events. Telemetry is also often associated with observability data, including metrics and logs; my focus here is the data consumers use for their own calculations.

[^context-2]: A way for one database to query data held in another, without going through the producer's application API. The mechanism varies: ClickHouse can read PostgreSQL through its [PostgreSQL table function](https://clickhouse.com/docs/reference/functions/table-functions/postgresql); BigQuery can use a configured connection and [`EXTERNAL_QUERY`](https://docs.cloud.google.com/bigquery/docs/reference/standard-sql/federated_query_functions) for supported external databases; PostgreSQL can expose remote PostgreSQL tables locally through [`postgres_fdw`](https://www.postgresql.org/docs/current/postgres-fdw.html). Connections, permissions and SQL differ, so the snippet illustrates the copy rather than portable setup instructions.

[^context-3]: In [medallion architecture](https://docs.databricks.com/gcp/en/lakehouse/medallion), bronze holds raw ingested data, silver holds cleaned and validated data, and gold holds curated data shaped for business use, often with aggregations. Here, gold means the producer has already applied the interpretation rules and made the result suitable for downstream consumers.
